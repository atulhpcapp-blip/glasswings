// Admin-only Glasswings profile-update reminder via an approved AiSensy API campaign.
// NEVER accepts a destination phone or campaign name from the browser.
import { createClient } from '@supabase/supabase-js';

const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const API_KEY = process.env.AISENSY_API_KEY || process.env.AISENSY_KEY || '';
const CAMPAIGN = process.env.GW_PROFILE_UPDATE_CAMPAIGN || '';
const AIM_URL = 'https://backend.aisensy.com/campaign/t1/api/v2';
const clean = x => String(x ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150);
const normalize = p => {
  let v = String(p || '').replace(/\D/g, '');
  if (v.length === 10) v = '91' + v;
  // AiSensy destination is a country-code-prefixed number without '+'.
  return /^91[6-9]\d{9}$/.test(v) ? v : '';
};

function getBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}
function isAdmin(p) {
  const roles = [p?.role, ...(Array.isArray(p?.roles) ? p.roles : [])].filter(Boolean);
  return roles.includes('superadmin') || roles.includes('admin');
}
async function isFlagged(sb, token, memberId, p) {
  if (clean(p?.review_flag)) return true;
  // Several Glasswings deployments store Meet Me flags on member_details.
  const { data: info } = await sb.from('member_details').select('*').eq('user_id', memberId).maybeSingle();
  if (clean(info?.review_flag)) return true;
  // Fall back to the existing Meet Me RPC under the real staff user's JWT.
  const caller = createClient(SB_URL, SB_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: meet, error } = await caller.rpc('meet_list');
  if (!error && Array.isArray(meet)) return meet.some(m => String(m.id) === String(memberId) && !!m.review_flag);
  return false;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  // Secure read-only history for Glasswings admins. Do NOT expose the service role key
  // in the browser or weaken gw_profile_reminder_log's RLS protections.
  if (req.method === 'GET') {
    if (!SB_URL || !SB_KEY) return res.status(503).json({ error: 'Reminder history is not configured.' });
    const authHeader = String(req.headers.authorization || '');
    const token = /^Bearer\s+(.+)$/i.exec(authHeader)?.[1]?.trim() || '';
    if (!token) return res.status(401).json({ error: 'Please sign in to view reminder history.' });
    try {
      const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: auth, error: authErr } = await sb.auth.getUser(token);
      if (authErr || !auth?.user?.id) return res.status(401).json({ error: 'Please sign in again.' });
      const { data: admin, error: adminErr } = await sb.from('profiles').select('*').eq('id', auth.user.id).single();
      if (adminErr || !isAdmin(admin)) return res.status(403).json({ error: 'Only Glasswings admins can view profile-reminder history.' });
      const { data: logs, error: logErr } = await sb.from('gw_profile_reminder_log')
        .select('id,member_id,campaign,reason,status,error_text,created_at,submitted_at')
        .order('created_at', { ascending: false }).limit(200);
      if (logErr) {
        console.error('GW reminder history query:', logErr.code, logErr.message);
        return res.status(503).json({ error: 'Could not load reminder history. Check the gw_profile_reminder_log table.' });
      }
      const memberIds = [...new Set((logs || []).map(x => x.member_id).filter(Boolean))];
      const names = new Map();
      // Small batches avoid oversized PostgREST URLs for active communities.
      for (let i = 0; i < memberIds.length; i += 50) {
        const batch = memberIds.slice(i, i + 50);
        const { data: members, error: membersErr } = await sb.from('profiles')
          .select('*').in('id', batch);
        if (membersErr) console.error('GW reminder history name lookup:', membersErr.code, membersErr.message);
        else (members || []).forEach(m => names.set(String(m.id), clean(m.full_name || m.name || m.display_name || '')));
      }
      // Only send the minimum fields required for the admin history UI.
      return res.status(200).json({ ok: true, logs: (logs || []).map(item => ({
        id: item.id,
        member_id: item.member_id,
        member_name: names.get(String(item.member_id)) || '',
        campaign: item.campaign,
        reason: item.reason,
        status: item.status,
        error_text: item.error_text,
        created_at: item.created_at,
        submitted_at: item.submitted_at,
      })) });
    } catch (e) {
      console.error('GW reminder history:', e?.message || String(e));
      return res.status(500).json({ error: 'Could not load reminder history. Check Vercel logs.' });
    }
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST only' });
  if (!SB_URL || !SB_KEY || !API_KEY || !CAMPAIGN) return res.status(503).json({ error: 'Profile reminder campaign is not configured. Set GW_PROFILE_UPDATE_CAMPAIGN and activate the AiSensy campaign.' });
  const body = getBody(req);
  const token = String(body.access_token || '');
  const memberId = String(body.member_id || '');
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(memberId)) return res.status(400).json({ error: 'Invalid member ID' });
  if (body.consent_confirmed !== true) return res.status(400).json({ error: 'WhatsApp opt-in confirmation is required.' });
  try {
    const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth, error: authErr } = await sb.auth.getUser(token);
    if (authErr || !auth?.user?.id) return res.status(401).json({ error: 'Please sign in again.' });
    const { data: admin, error: adminErr } = await sb.from('profiles').select('*').eq('id', auth.user.id).single();
    if (adminErr || !isAdmin(admin)) return res.status(403).json({ error: 'Only Glasswings admins can send profile reminders.' });
    const { data: member, error: memberErr } = await sb.from('profiles').select('*').eq('id', memberId).single();
    if (memberErr || !member) return res.status(404).json({ error: 'Member not found.' });
    if (!(await isFlagged(sb, token, memberId, member))) return res.status(409).json({ error: 'This member does not currently have a verified Meet Me flag. Refresh the list.' });
    // Respect known explicit opt-outs when such fields exist.
    for (const key of ['whatsapp_opt_in', 'wa_opt_in', 'whatsapp_consent', 'allow_whatsapp']) {
      if (Object.prototype.hasOwnProperty.call(member, key) && member[key] === false) return res.status(409).json({ error: 'This member has opted out of WhatsApp messages.' });
    }
    // Glasswings stores the registered contact separately in public.member_phone.
    // profiles.phone may be empty even for members with a valid saved number.
    // Never use a phone supplied by the browser for this privileged send.
    const { data: registered, error: phoneErr } = await sb.from('member_phone')
      .select('phone').eq('user_id', memberId).maybeSingle();
    if (phoneErr) {
      console.error('GW profile reminder member_phone lookup:', phoneErr.code, phoneErr.message);
      return res.status(503).json({ error: 'Could not retrieve the registered member phone. Please retry after checking member_phone access.' });
    }
    const phone = [registered?.phone, member.phone, member.mobile, member.phone_number]
      .map(normalize).find(Boolean) || '';
    if (!phone) return res.status(422).json({ error: 'No valid Indian mobile is saved for this member in Glasswings. Ask them to update their phone through the app or contact them by another channel.' });
    const name = clean(member.full_name || member.name || 'Member');
    const reason = clean(member.review_flag || 'profile photo and phone number');
    const log = { member_id: memberId, actor_id: auth.user.id, campaign: CAMPAIGN, reason, status: 'pending', opt_in_confirmed: true };
    const { data: inserted, error: logErr } = await sb.from('gw_profile_reminder_log').insert(log).select('id').single();
    if (logErr) {
      if (logErr.code === '23505') return res.status(409).json({ error: 'A profile-update reminder has already been attempted for this member today. No duplicate was sent.' });
      console.error('GW profile reminder log:', logErr.code, logErr.message);
      return res.status(503).json({ error: 'Reminder logging unavailable. Install the supplied SQL first.' });
    }
    const payload = { apiKey: API_KEY, campaignName: CAMPAIGN, destination: phone, userName: name, source: 'glasswings-profile-review', templateParams: [name, reason, 'https://www.glass-wings.com/'] };
    let ok = false; let detail = '';
    try {
      const r = await fetch(AIM_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000) });
      const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = null; }
      ok = r.ok && !(j && (j.success === false || j.success === 'false' || j.status === 'error' || j.error || j.errorMessage));
      detail = clean((j && (j.errorMessage || j.error || j.message)) || t || `HTTP ${r.status}`).slice(0, 400);
    } catch (e) { detail = clean(e?.message || 'AiSensy request could not be confirmed'); }
    const { error: updErr } = await sb.from('gw_profile_reminder_log').update({ status: ok ? 'submitted' : 'needs_review', error_text: ok ? null : detail, submitted_at: ok ? new Date().toISOString() : null }).eq('id', inserted.id);
    if (updErr) console.error('GW profile reminder log update:', updErr.code, updErr.message);
    return res.status(ok ? 200 : 502).json({ ok, detail: ok ? 'AiSensy accepted request; delivery not confirmed.' : detail || 'AiSensy did not accept the request.' });
  } catch (e) {
    console.error('GW profile reminder:', e?.message || String(e));
    return res.status(500).json({ error: 'Could not process the reminder. Check Vercel logs.' });
  }
}
