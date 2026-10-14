// GLASSWINGS — Member-controlled WhatsApp marketing consent.
// Does not change booking, payment or transactional alert flows.
// Uses existing Supabase member_phone and gw_wa_marketing_optins tables.
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const fail = (res, status, error) => res.status(status).json({ok:false,error});

function indianMobile(raw) {
  const number = String(raw ?? '').replace(/\D/g, '');
  const local = number.length === 12 && number.startsWith('91') ? number.slice(2)
    : number.length === 11 && number.startsWith('0') ? number.slice(1)
    : number.length === 10 ? number : '';
  return /^[6-9][0-9]{9}$/.test(local) ? '91' + local : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'POST only');
  const body = typeof req.body === 'string' ? (() => { try {return JSON.parse(req.body);} catch {return null;} })() : req.body;
  if (!body || typeof body !== 'object') return fail(res, 400, 'Invalid request.');
  const token = String(body.access_token || '');
  if (!token) return fail(res, 401, 'Please log in.');
  try {
    const { data: auth, error: authErr } = await sb.auth.getUser(token);
    if (authErr || !auth?.user?.id) return fail(res, 401, 'Session expired; sign in again.');
    const userId = auth.user.id;
    const { data: memberPhone, error: phoneErr } = await sb.from('member_phone')
      .select('phone').eq('user_id', userId).maybeSingle();
    if (phoneErr) throw Error('Could not read your registered phone: ' + phoneErr.message);
    const phone = indianMobile(memberPhone?.phone);
    const action = String(body.action || 'status');
    if (!['status','set'].includes(action)) return fail(res, 400, 'Unknown action.');
    if (!phone) {
      if (action === 'set') return fail(res, 400, 'Please save a valid Indian mobile number in Profile first.');
      return res.status(200).json({ok:true,has_phone:false,opted_in:false});
    }
    const { data: prior, error: priorErr } = await sb.from('gw_wa_marketing_optins')
      .select('phone,user_id,consented_at,opted_out_at').eq('phone', phone).maybeSingle();
    if (priorErr) throw Error('Could not read marketing consent: ' + priorErr.message);
    if (prior?.user_id && prior.user_id !== userId) {
      return fail(res, 409, 'This phone is linked to another member. Contact support to correct the registered number.');
    }
    if (action === 'status') {
      return res.status(200).json({ok:true,has_phone:true,opted_in:!!prior && !prior.opted_out_at});
    }
    if (typeof body.opt_in !== 'boolean') return fail(res, 400, 'Choose to enable or disable WhatsApp marketing messages.');
    const optedIn = body.opt_in === true;
    if (optedIn && body.consent_acknowledged !== true)
      return fail(res, 400, 'Please confirm you agree to WhatsApp marketing invitations.');
    if (optedIn) {
      // Revoke old-number consent on member phone change, to prevent continued marketing to the old number.
      const { error: oldErr } = await sb.from('gw_wa_marketing_optins')
        .update({ opted_out_at: new Date().toISOString() }).eq('user_id', userId).neq('phone', phone).is('opted_out_at', null);
      if (oldErr) throw oldErr;
      const allowedSource = body.source === 'signup_profile_completion_v1'
        ? 'Self opt-in: Glasswings signup / profile-completion checkbox v1'
        : 'Self opt-in: Glasswings profile WhatsApp marketing switch v1';
      const { error: upsertErr } = await sb.from('gw_wa_marketing_optins').upsert({
        phone, user_id: userId, consented_at: new Date().toISOString(), consent_source: allowedSource,
        opted_out_at: null,
      }, { onConflict: 'phone' });
      if (upsertErr) throw upsertErr;
    } else if (prior) {
      const { error: revokeErr } = await sb.from('gw_wa_marketing_optins')
        .update({opted_out_at:new Date().toISOString(),user_id:userId}).eq('phone', phone);
      if (revokeErr) throw revokeErr;
    }
    return res.status(200).json({ok:true,has_phone:true,opted_in:optedIn});
  } catch(e) {
    console.error('[GW WA consent]',String(e.message||e).slice(0,200));
    return fail(res, 500, 'Could not save WhatsApp preference. Please try again.');
  }
}
