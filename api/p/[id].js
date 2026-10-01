import { createClient } from '@supabase/supabase-js';

function env(name, fallbacks = []) {
  for (const key of [name, ...fallbacks]) if (process.env[key]) return process.env[key];
  return '';
}
function esc(v='') { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function arr(v) { return Array.isArray(v) ? v.filter(Boolean) : []; }
function cleanUrl(v='') { const s=String(v||'').trim(); return /^https:\/\//i.test(s) ? s : ''; }
function pill(x){ return `<span class="pill">${esc(x)}</span>`; }

export default async function handler(req, res) {
  const url = env('SUPABASE_URL', ['VITE_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_URL']);
  const key = env('SUPABASE_SERVICE_ROLE_KEY', ['SUPABASE_SERVICE_KEY']);
  if (!url || !key) return res.status(500).send('Profile service is not configured.');
  const id = String(req.query?.id || '').trim();
  if (!id) return res.status(400).send('Member not found.');

  const admin = createClient(url, key, { auth:{ autoRefreshToken:false, persistSession:false } });
  const [{ data:p, error:pe }, { data:d }] = await Promise.all([
    admin.from('profiles').select('id,full_name,avatar_url,gender').eq('id',id).maybeSingle(),
    admin.from('member_details').select('age,city,area,profession,bio,interests,photos,looking_for,icebreaker,prompts').eq('user_id',id).maybeSingle()
  ]);
  if (pe || !p) return res.status(404).send('Member profile not found.');

  const name = String(p.full_name || 'Glasswings Member').trim();
  const avatar = cleanUrl(p.avatar_url);
  const photos = arr(d?.photos).map(cleanUrl).filter(Boolean);
  const previewImage = avatar || photos[0] || '';
  const place = [d?.area, d?.city].filter(Boolean).join(', ');
  const age = d?.age ? `${d.age}` : '';
  const profession = String(d?.profession || '').trim();
  const bio = String(d?.bio || '').trim();
  const looking = String(d?.looking_for || '').trim();
  const ice = String(d?.icebreaker || '').trim();
  const interests = arr(d?.interests).map(String).filter(Boolean);
  const prompts = arr(d?.prompts).filter(x => x && String(x.a||'').trim());
  const summaryBits = [profession, place, bio].filter(Boolean);
  const description = (summaryBits.join(' · ') || 'View this member on Glasswings').slice(0, 190);
  const canonical = `https://glass-wings.com/api/p/${encodeURIComponent(id)}`;
  const appLink = `https://glass-wings.com/?profile=${encodeURIComponent(id)}`;

  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=600');
  res.status(200).send(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(name)} · Glasswings</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="profile">
<meta property="og:site_name" content="Glasswings">
<meta property="og:title" content="${esc(name)} on Glasswings">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
${previewImage ? `<meta property="og:image" content="${esc(previewImage)}"><meta property="og:image:alt" content="${esc(name)} profile photo">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(name)} on Glasswings">
<meta name="twitter:description" content="${esc(description)}">
${previewImage ? `<meta name="twitter:image" content="${esc(previewImage)}">` : ''}
<style>
*{box-sizing:border-box} body{margin:0;background:#f6f8f8;color:#111b21;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif} .wrap{max-width:760px;margin:auto;padding:20px 14px 52px}.brand{font-weight:950;font-size:19px;color:#008069;margin:4px 2px 14px}.card{background:#fff;border:1px solid #e7ecec;border-radius:24px;overflow:hidden;box-shadow:0 12px 38px rgba(17,27,33,.08)}.hero{position:relative;background:linear-gradient(135deg,#e8fff8,#efe9ff);aspect-ratio:1.35/1;max-height:560px;display:flex;align-items:center;justify-content:center}.hero img{width:100%;height:100%;object-fit:cover}.fallback{font-size:86px}.content{padding:20px}.name{font-size:30px;font-weight:950;line-height:1.1}.sub{font-size:14px;color:#667781;margin-top:7px;line-height:1.45}.work{font-size:15px;font-weight:800;color:#334155;margin-top:8px}.bio{font-size:16px;line-height:1.6;margin-top:18px;white-space:pre-wrap}.section{margin-top:20px}.label{font-size:11px;font-weight:900;letter-spacing:.08em;color:#7c3aed;text-transform:uppercase;margin-bottom:8px}.pills{display:flex;gap:7px;flex-wrap:wrap}.pill{background:#f4f1ff;color:#5b21b6;border:1px solid #e7ddff;border-radius:999px;padding:7px 11px;font-size:13px;font-weight:750}.ask,.prompt{background:#fafafa;border:1px solid #edf0f1;border-radius:16px;padding:13px 14px;margin-top:9px}.q{font-size:12px;color:#667781;font-weight:800}.a{font-size:15px;line-height:1.5;margin-top:4px;font-weight:650}.gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.gallery img{width:100%;aspect-ratio:.82/1;object-fit:cover;border-radius:12px;background:#eee}.cta{display:block;margin-top:22px;text-decoration:none;text-align:center;background:linear-gradient(95deg,#008069,#6d28d9);color:#fff;padding:14px;border-radius:14px;font-weight:900;font-size:15px}.privacy{font-size:11px;color:#8696a0;text-align:center;line-height:1.5;margin-top:14px}@media(max-width:520px){.wrap{padding:0 0 40px}.brand{padding:14px;margin:0}.card{border-radius:0;border-left:0;border-right:0}.content{padding:18px}.name{font-size:26px}.gallery{grid-template-columns:repeat(2,1fr)}}
</style></head><body><main class="wrap"><div class="brand">Glasswings</div><article class="card">
<div class="hero">${previewImage ? `<img src="${esc(previewImage)}" alt="${esc(name)}">` : `<div class="fallback">${p.gender==='female'?'👩':p.gender==='male'?'👨':'🙂'}</div>`}</div>
<div class="content"><div class="name">${esc(name)}${age ? `, ${esc(age)}` : ''}</div>
${place ? `<div class="sub">📍 ${esc(place)}</div>` : ''}${profession ? `<div class="work">💼 ${esc(profession)}</div>` : ''}
${bio ? `<div class="bio">${esc(bio)}</div>` : ''}
${looking ? `<div class="section"><div class="label">Here for</div><div class="pills">${pill(looking)}</div></div>` : ''}
${ice ? `<div class="section"><div class="label">Ask me about</div><div class="ask"><div class="a">${esc(ice)}</div></div></div>` : ''}
${interests.length ? `<div class="section"><div class="label">Interests</div><div class="pills">${interests.map(pill).join('')}</div></div>` : ''}
${prompts.length ? `<div class="section"><div class="label">A little more about ${esc(name.split(' ')[0]||name)}</div>${prompts.map(x=>`<div class="prompt"><div class="q">${esc(x.q||'')}</div><div class="a">${esc(x.a||'')}</div></div>`).join('')}</div>` : ''}
${photos.length ? `<div class="section"><div class="label">Photos</div><div class="gallery">${photos.map(u=>`<img src="${esc(u)}" alt="${esc(name)}">`).join('')}</div></div>` : ''}
<a class="cta" href="${esc(appLink)}">Open in Glasswings</a><div class="privacy">This share page displays only the member-facing profile information. Private contact and admin information are not shown.</div>
</div></article></main></body></html>`);
}
