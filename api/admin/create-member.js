import { createClient } from '@supabase/supabase-js';

function getEnv(name, fallbacks = []) {
  for (const key of [name, ...fallbacks]) {
    if (process.env[key]) return process.env[key];
  }
  return '';
}

function cleanPhone(v) {
  const raw = String(v || '').trim();
  if (!raw) return '';
  const d = raw.replace(/\D/g, '');
  if (d.length === 10) return '+91' + d;
  return raw.startsWith('+') ? '+' + d : (d ? '+' + d : '');
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  // Open /api/admin/create-member in a browser after deploy to verify the route exists.
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, route: 'create-member', status: 'ready' });
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const url = getEnv('SUPABASE_URL', ['VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL']);
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY', ['SUPABASE_SERVICE_KEY']);
  if (!url || !serviceKey) return res.status(500).json({ ok: false, error: 'Server Supabase admin credentials are not configured.' });

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  try {
    const b = req.body || {};
    const token = String(b.access_token || '').trim();
    if (!token) return res.status(401).json({ ok: false, error: 'Not signed in.' });

    const { data: authData, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !authData?.user?.id) return res.status(401).json({ ok: false, error: 'Session expired. Please sign in again.' });

    const callerId = authData.user.id;
    const { data: caller } = await admin.from('profiles').select('role, roles').eq('id', callerId).maybeSingle();
    const roles = new Set([caller?.role, ...(Array.isArray(caller?.roles) ? caller.roles : [])].filter(Boolean));
    if (![...roles].some(r => ['superadmin', 'admin', 'subadmin'].includes(r))) {
      return res.status(403).json({ ok: false, error: 'Only authorised admin staff can create members.' });
    }

    const fullName = String(b.full_name || '').trim();
    const email = String(b.email || '').trim().toLowerCase();
    if (!fullName) return res.status(400).json({ ok: false, error: 'Full name is required.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ ok: false, error: 'A valid email is required.' });

    const gender = ['male', 'female', 'other'].includes(String(b.gender || '')) ? String(b.gender) : null;
    const age = b.age == null || b.age === '' ? null : Number(b.age);
    if (age != null && (!Number.isFinite(age) || age < 18 || age > 100)) return res.status(400).json({ ok: false, error: 'Enter a valid age.' });

    const { data: invite, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: 'https://glass-wings.com',
      data: { full_name: fullName, gender: gender || undefined },
    });
    if (inviteErr) {
      const msg = inviteErr.message || 'Could not create member.';
      return res.status(400).json({ ok: false, error: /already|registered|exists/i.test(msg) ? 'A Glasswings account already exists with this email.' : msg });
    }

    const uid = invite?.user?.id;
    if (!uid) return res.status(500).json({ ok: false, error: 'Member was invited but no user ID was returned.' });

    let avatarUrl = null;
    const photoData = String(b.photo_data || '');
    if (photoData.startsWith('data:image/')) {
      const m = photoData.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (m) {
        const mime = m[1];
        const ext = mime.includes('png') ? 'png' : 'jpg';
        const bytes = Buffer.from(m[2], 'base64');
        if (bytes.length <= 2 * 1024 * 1024) {
          const path = `${uid}/admin-${Date.now()}.${ext}`;
          const { error: upErr } = await admin.storage.from('avatars').upload(path, bytes, { contentType: mime, upsert: true });
          if (!upErr) avatarUrl = admin.storage.from('avatars').getPublicUrl(path).data.publicUrl;
        }
      }
    }

    const profilePatch = { id: uid, full_name: fullName, profile_completed: true };
    if (gender) profilePatch.gender = gender;
    if (avatarUrl) profilePatch.avatar_url = avatarUrl;
    const { error: pErr } = await admin.from('profiles').upsert(profilePatch, { onConflict: 'id' });
    if (pErr) throw pErr;

    const details = { user_id: uid };
    if (age != null) details.age = age;
    if (String(b.city || '').trim()) details.city = String(b.city).trim();
    if (String(b.area || '').trim()) details.area = String(b.area).trim();
    if (String(b.profession || '').trim()) details.profession = String(b.profession).trim();
    const { error: dErr } = await admin.from('member_details').upsert(details, { onConflict: 'user_id' });
    if (dErr) throw dErr;

    const phone = cleanPhone(b.phone);
    if (phone) {
      const { error: phErr } = await admin.from('member_phone').upsert({ user_id: uid, phone }, { onConflict: 'user_id' });
      if (phErr) throw phErr;
    }

    return res.status(200).json({ ok: true, user_id: uid, email, invite_sent: true });
  } catch (e) {
    console.error('create-member failed', e);
    return res.status(500).json({ ok: false, error: e?.message || 'Could not create member.' });
  }
}
