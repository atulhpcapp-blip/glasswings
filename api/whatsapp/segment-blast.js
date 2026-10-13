// GLASSWINGS — Saved AiSensy campaigns, reusable image posters and consent-gated segment sending.
// Compatible with previous /api/whatsapp/segment-blast callers; no existing payment APIs are changed.
// Required: AISENSY_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// SQL setup: Glasswings_Reusable_AiSensy_Campaigns.sql (must run before deployment).
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 120 };
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const STAFF = ['admin', 'superadmin', 'subadmin'];
const MAX_MEDIA_BYTES = 5_000_000; // Decimal MB: remain at/below Meta and AiSensy image-header limit.
const LEGACY_BASE64_BYTES = 2 * 1024 * 1024; // Old JSON upload route: Vercel request body is limited to 4.5 MB.
const MAX_SEND = 150; // Bound one synchronous call: larger blasts need a queued campaign worker.
const API = 'https://backend.aisensy.com/campaign/t1/api/v2';

function normPhone(value) {
  const s = String(value || '').replace(/\D/g, '');
  if (s.length === 10) return '91' + s;
  if (s.length === 11 && s.startsWith('0')) return '91' + s.slice(1);
  if (s.length === 12 && s.startsWith('91')) return s;
  if (s.length >= 11 && s.length <= 15 && !s.startsWith('0')) return s;
  return null;
}
function fail(res, status, error) { return res.status(status).json({ ok: false, error }); }
function getLabels(input, count) {
  const labels = Array.isArray(input) ? input : [];
  return Array.from({ length: count }, (_, i) =>
    String(labels[i] ?? '').replace(/\s+/g, ' ').trim().slice(0, 65));
}
function parseParams(p) {
  if (Array.isArray(p)) return p.map(v => String(v).trim());
  return String(p || '').trim() ? String(p).split(',').map(v => v.trim()) : [];
}
async function bodyFrom(req) {
  if (req.body != null) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const chunks = [];
  for await (const part of req) chunks.push(Buffer.from(part));
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}
async function getStaff(token) {
  if (!token) return null;
  const { data: ures, error } = await sb.auth.getUser(token);
  if (error || !ures?.user?.id) return null;
  const { data: member, error: pe } = await sb.from('profiles').select('*').eq('id', ures.user.id).maybeSingle();
  if (pe || !member) return null;
  const roles = [member.role, ...(Array.isArray(member.roles) ? member.roles : [])];
  return roles.some(role => STAFF.includes(role)) ? { id: ures.user.id, phone: normPhone(member.phone || member.mobile || member.phone_number || '') } : null;
}
async function getRecipients(body) {
  let rows, err;
  if (body.audience === 'all') {
    ({ data: rows, error: err } = await sb.rpc('all_member_phones'));
  } else if (body.room_id) {
    ({ data: rows, error: err } = await sb.rpc('room_phones', { p_room: body.room_id }));
  } else if (body.segment_id) {
    ({ data: rows, error: err } = await sb.rpc('segment_phones', { p_segment: body.segment_id }));
  } else {
    throw Error('Choose a Meet Me segment.');
  }
  if (err) throw Error(`Could not read member list: ${err.message}`);
  const found = new Map();
  for (const item of rows || []) {
    const phone = normPhone(item.phone);
    if (phone && !found.has(phone)) found.set(phone, { phone, name: String(item.full_name || 'there').split(/\s+/)[0] });
  }
  return [...found.values()];
}
async function filterOptedIn(recipients) {
  const consent = new Set();
  for (let i = 0; i < recipients.length; i += 150) {
    const phones = recipients.slice(i, i + 150).map(r => r.phone);
    const { data, error } = await sb.from('gw_wa_marketing_optins').select('phone')
      .in('phone', phones).is('opted_out_at', null);
    if (error) throw Error(`WhatsApp consent check failed: ${error.message}`);
    for (const row of data || []) consent.add(row.phone);
  }
  return recipients.filter(r => consent.has(r.phone));
}
async function sendToAiSensy(destination, name, campaign, params, mediaUrl, filename) {
  const fullParams = params.map(p => p.replace(/\{\{name\}\}|\{name\}/gi, name));
  const packet = { apiKey: process.env.AISENSY_API_KEY, campaignName: campaign,
    destination, userName: name, templateParams: fullParams, source: 'glasswings-meetme' };
  if (mediaUrl) packet.media = { url: mediaUrl, filename: filename || 'glasswings-poster.jpg' };
  const resp = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(packet), signal: AbortSignal.timeout(15000) });
  const reply = await resp.text();
  if (!resp.ok) throw Error(`AiSensy HTTP ${resp.status}: ${reply.slice(0, 180)}`);
  // Some AiSensy errors are carried in 200 responses. Do not falsely call them accepted.
  let parsed;
  try { parsed = JSON.parse(reply); } catch {}
  if (parsed?.success === false || parsed?.status === 'error' || parsed?.status === false || parsed?.error) {
    throw Error(String(parsed.message || parsed.error || 'AiSensy rejected the request').slice(0, 180));
  }
  return true; // API acceptance, NOT delivery confirmation.
}
function validateMediaUrl(u) {
  if (!u) return '';
  try {
    const url = new URL(u);
    if (url.protocol !== 'https:' || url.username || url.password) throw Error('bad');
    return url.toString();
  } catch { throw Error('The poster must have a public HTTPS image URL.'); }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'POST only');
  let body;
  try { body = await bodyFrom(req); } catch { return fail(res, 400, 'Invalid request.'); }
  const staff = await getStaff(body?.access_token);
  if (!staff) return fail(res, 403, 'Admin login required.');
  const staffId = staff.id;
  const action = String(body.action || 'send');
  try {
    if (action === 'presets') {
      const { data, error } = await sb.from('gw_wa_campaign_presets').select('id,label,campaign_name,uses_media,param_count,param_labels,created_at').order('label');
      if (error) throw error;
      return res.status(200).json({ ok: true, presets: data || [] });
    }
    if (action === 'save_preset') {
      const label = String(body.label || '').trim().slice(0, 80);
      const campaign = String(body.campaign || '').trim().slice(0, 120);
      const paramCount = Number(body.param_count);
      if (label.length < 2 || campaign.length < 2 || !Number.isInteger(paramCount) || paramCount < 0 || paramCount > 15)
        return fail(res, 400, 'Enter a campaign nickname, exact AiSensy campaign name and the correct template-parameter count.');
      const labels = getLabels(body.param_labels, paramCount);
      if (paramCount && labels.some(x => !x)) return fail(res, 400, 'Give every approved template variable a descriptive label.');
      const { data, error } = await sb.from('gw_wa_campaign_presets').insert({ label, campaign_name: campaign,
        uses_media: !!body.uses_media, param_count: paramCount, param_labels: labels, created_by: staffId })
        .select('id,label,campaign_name,uses_media,param_count,param_labels').single();
      if (error) return fail(res, error.code === '23505' ? 409 : 500, error.code === '23505' ? 'That nickname already exists.' : error.message);
      return res.status(200).json({ ok: true, preset: data });
    }
    if (action === 'update_preset_labels') {
      const presetId = String(body.preset_id || '');
      if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(presetId)) return fail(res, 400, 'Choose a saved campaign first.');
      const { data: previous, error: lookupError } = await sb.from('gw_wa_campaign_presets')
        .select('id,param_count').eq('id', presetId).maybeSingle();
      if (lookupError) throw lookupError;
      if (!previous) return fail(res, 404, 'Saved campaign not found.');
      const count = previous.param_count;
      const labels = getLabels(body.param_labels, count);
      if (labels.some(x => !x)) return fail(res, 400, 'Give every approved template variable a descriptive label.');
      const { data: updated, error } = await sb.from('gw_wa_campaign_presets')
        .update({ param_labels: labels }).eq('id', presetId)
        .select('id,label,campaign_name,uses_media,param_count,param_labels').single();
      if (error) throw error;
      return res.status(200).json({ ok: true, preset: updated });
    }
    if (action === 'delete_preset') {
      const { error } = await sb.from('gw_wa_campaign_presets').delete().eq('id', body.preset_id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    if (action === 'prepare_media_upload') {
      // The image uploads directly from the admin browser to Supabase with a path-bound,
      // short-lived signed token. Avoids the 4.5 MB Vercel JSON body limit entirely.
      const mime = String(body.mime || '').toLowerCase();
      const size = Number(body.size);
      if (!['image/png', 'image/jpeg'].includes(mime)) return fail(res, 400, 'Choose a JPG or PNG image.');
      if (!Number.isInteger(size) || size < 1 || size > MAX_MEDIA_BYTES)
        return fail(res, 400, 'Event poster must be 5 MB or smaller (JPG/PNG).');
      const ext = mime === 'image/png' ? 'png' : 'jpg';
      const path = `${new Date().toISOString().slice(0, 7)}/${staffId}/${crypto.randomUUID()}.${ext}`;
      const { data: ticket, error } = await sb.storage.from('gw_wa_campaign_media').createSignedUploadUrl(path);
      if (error || !ticket?.token) throw Error(`Could not prepare poster upload: ${error?.message || 'missing upload token'}`);
      return res.status(200).json({ ok: true, path, token: ticket.token,
        filename: `glasswings-poster.${ext}`, max_media_bytes: MAX_MEDIA_BYTES });
    }
    // Retained for backwards compatibility with older clients uploading images <= 2 MiB.
    if (action === 'upload_media') {
      const mime = String(body.mime || '');
      if (!['image/png', 'image/jpeg'].includes(mime)) return fail(res, 400, 'Choose a JPG or PNG image.');
      const b64 = String(body.base64 || '').replace(/^data:[^,]+,/, '');
      if (b64.length > 2_900_000 || !/^[A-Za-z0-9+/=]+$/.test(b64)) return fail(res, 400, 'Image is too large or invalid (maximum 2 MB).');
      const bytes = Buffer.from(b64, 'base64');
      if (!bytes.length || bytes.length > LEGACY_BASE64_BYTES) return fail(res, 400, 'This older upload method supports 2 MB. Refresh the app to upload a 5 MB image.');
      const png = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
      const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      if ((mime === 'image/png' && !png) || (mime === 'image/jpeg' && !jpeg)) return fail(res, 400, 'The file does not match its image type.');
      const ext = png ? 'png' : 'jpg';
      const path = `${new Date().toISOString().slice(0,7)}/${staffId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await sb.storage.from('gw_wa_campaign_media').upload(path, bytes, { contentType: mime, cacheControl: '3600', upsert: false });
      if (error) throw Error(`Poster upload failed: ${error.message}`);
      const { data: url } = sb.storage.from('gw_wa_campaign_media').getPublicUrl(path);
      return res.status(200).json({ ok: true, url: url.publicUrl, filename: `glasswings-poster.${ext}` });
    }
    if (action === 'preview') {
      const everyone = await getRecipients(body);
      const eligible = await filterOptedIn(everyone);
      return res.status(200).json({ ok: true, total: everyone.length, eligible: eligible.length, excluded: everyone.length - eligible.length, max_per_send: MAX_SEND });
    }
    if (action !== 'send') return fail(res, 400, 'Unknown campaign action.');
    if (!process.env.AISENSY_API_KEY) return fail(res, 500, 'AISENSY_API_KEY is missing in Vercel.');
    const campaign = String(body.campaign || '').trim();
    const params = parseParams(body.params);
    const mediaUrl = validateMediaUrl(String(body.media_url || '').trim());
    const filename = String(body.media_filename || 'glasswings-poster.jpg').replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 80);
    if (!campaign || campaign.length > 120) return fail(res, 400, 'Select an approved, Live AiSensy campaign.');
    if (body.preset_id) {
      const { data: preset, error } = await sb.from('gw_wa_campaign_presets').select('*').eq('id', body.preset_id).maybeSingle();
      if (error || !preset) return fail(res, 400, 'Saved campaign not found.');
      if (preset.campaign_name !== campaign || preset.param_count !== params.length || (preset.uses_media && !mediaUrl))
        return fail(res, 400, 'This send must match the saved template: campaign, number of values and poster setting.');
    }
    const testPhone = normPhone(body.test_phone);
    if (body.test_phone && !testPhone) return fail(res, 400, 'Enter a valid test phone number.');
    if (testPhone) {
      const approvedTestNumbers = [staff.phone, normPhone(process.env.GW_OWNER_WHATSAPP)].filter(Boolean);
      if (!approvedTestNumbers.includes(testPhone)) return fail(res, 403, 'Test messages may only be sent to your registered staff number or Glasswings owner number.');
      await sendToAiSensy(testPhone, 'Test', campaign, params, mediaUrl, filename);
      return res.status(200).json({ ok: true, sent: 1, failed: 0, total: 1, detail: 'AiSensy accepted test; check your WhatsApp.' });
    }
    if (body.confirmed !== true) return fail(res, 400, 'Review the audience, confirm consent and approve sending first.');
    // Never treat segment membership alone as marketing consent.
    const everyone = await getRecipients(body);
    const eligible = await filterOptedIn(everyone);
    if (!eligible.length) return fail(res, 400, 'No recorded opted-in recipients in this segment. Do not send until consent records are imported.');
    if (eligible.length > MAX_SEND) return fail(res, 400, `This segment has ${eligible.length} eligible recipients. Max ${MAX_SEND} per request; use a queued campaign worker for larger blasts.`);
    const runId = String(body.run_id || '');
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(runId)) return fail(res, 400, 'Missing campaign confirmation ID.');
    const { error: logged } = await sb.from('gw_wa_campaign_runs').insert({ id: runId,
      preset_id: body.preset_id || null, campaign_name: campaign, segment_id: body.segment_id || null,
      audience_count: everyone.length, eligible_count: eligible.length, media_url: mediaUrl || null,
      initiated_by: staffId, status: 'started' });
    if (logged) return fail(res, logged.code === '23505' ? 409 : 500,
      logged.code === '23505' ? 'This send was already started. Review campaign history rather than resending.' : logged.message);
    let sent = 0, failed = 0, detail = '';
    async function sendOne(recipient) {
      try { await sendToAiSensy(recipient.phone, recipient.name, campaign, params, mediaUrl, filename); sent++; }
      catch (e) { failed++; if (!detail) detail = String(e.message || e).slice(0, 230); }
    }
    for (let i = 0; i < eligible.length; i += 10) await Promise.all(eligible.slice(i, i + 10).map(sendOne));
    const { error: updateError } = await sb.from('gw_wa_campaign_runs').update({
      accepted_count: sent, failed_count: failed, status: failed ? 'partial' : 'accepted', finished_at: new Date().toISOString(), error_text: detail || null,
    }).eq('id', runId);
    if (updateError) console.error('[GW-WA-CAMPAIGN] Failed to update run summary', updateError.message);
    return res.status(200).json({ ok: true, sent, failed, total: eligible.length,
      excluded: everyone.length - eligible.length, detail, note: 'Accepted by AiSensy; this is not delivery confirmation.' });
  } catch (e) {
    console.error('[GW-WA-CAMPAIGN] Action failed:', action, String(e.message || e).slice(0, 300));
    return fail(res, 500, e.message || 'WhatsApp campaign request failed.');
  }
}
