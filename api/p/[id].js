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
  const genderLabel = p.gender === 'female' ? 'Woman' : p.gender === 'male' ? 'Man' : '';
  const firstName = name.split(' ')[0] || name;
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
*{box-sizing:border-box}
:root{--ink:#111827;--soft:#64748b;--teal:#0f766e;--violet:#6d28d9;--pink:#be185d;--line:#e5e7eb}
body{margin:0;background:linear-gradient(135deg,#ecfeff 0%,#f5f3ff 45%,#fdf2f8 100%);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.wrap{max-width:780px;margin:auto;padding:18px 14px 52px}
.brandbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:2px 2px 14px}
.brand{font-weight:950;font-size:20px;color:#0f766e;letter-spacing:-.3px}
.brandnote{font-size:12px;color:var(--soft);font-weight:700}
.card{background:#fff;border:1px solid rgba(148,163,184,.24);border-radius:28px;overflow:hidden;box-shadow:0 22px 60px rgba(51,65,85,.14)}
.hero{position:relative;background:linear-gradient(135deg,#ccfbf1,#ede9fe,#fce7f3);aspect-ratio:4/5;max-height:610px;display:flex;align-items:center;justify-content:center;overflow:hidden}
.hero img{width:100%;height:100%;object-fit:cover}
.hero:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 46%,rgba(15,23,42,.82) 100%)}
.fallback{font-size:94px}
.heroText{position:absolute;z-index:2;left:18px;right:18px;bottom:18px;color:#fff}
.name{font-size:32px;font-weight:950;line-height:1.05;text-shadow:0 2px 14px rgba(0,0,0,.28)}
.heroSub{font-size:14px;opacity:.96;margin-top:8px;font-weight:650}
.content{padding:20px 20px 28px;background:linear-gradient(180deg,#fff 0%,#fcfcff 52%,#f8fafc 100%)}
.badges{display:flex;gap:7px;flex-wrap:wrap}
.badge{border-radius:999px;padding:6px 10px;font-size:12px;font-weight:850;border:1px solid}
.badge.member{background:#ecfdf5;color:#047857;border-color:#d1fae5}
.badge.gender{background:#eff6ff;color:#1d4ed8;border-color:#dbeafe}
.quick{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:14px}
.quickCard{border-radius:16px;padding:13px 14px;border:1px solid}
.quickCard.work{background:linear-gradient(135deg,#ecfeff,#f0fdfa);border-color:#ccfbf1}
.quickCard.here{background:linear-gradient(135deg,#f5f3ff,#fdf2f8);border-color:#e9d5ff}
.k{font-size:10.5px;font-weight:950;letter-spacing:.07em;text-transform:uppercase}
.v{font-size:14.5px;font-weight:850;margin-top:5px;line-height:1.35}
.section{margin-top:16px;border-radius:18px;padding:15px 16px;border:1px solid}
.section.about{background:linear-gradient(135deg,#fff7ed,#fff1f2);border-color:#fed7aa}
.section.ask{background:linear-gradient(135deg,#fdf2f8,#f5f3ff);border-color:#f5d0fe}
.section.interests{background:linear-gradient(135deg,#f5f3ff,#eff6ff);border-color:#ddd6fe}
.section.prompts{background:#fff;border-color:#eef2f7}
.label{font-size:10.5px;font-weight:950;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px}
.about .label{color:#c2410c}.ask .label{color:#7c3aed}.interests .label{color:#6d28d9}.prompts .label{color:#0f766e}
.bio{font-size:15.5px;line-height:1.65;white-space:pre-wrap;font-weight:540}
.pills{display:flex;gap:7px;flex-wrap:wrap}
.pill{background:#fff;color:#5b21b6;border:1px solid #e9d5ff;border-radius:999px;padding:7px 11px;font-size:12.5px;font-weight:800}
.prompt{border-radius:15px;padding:13px 14px;margin-top:9px;border:1px solid rgba(148,163,184,.2)}
.prompt:nth-child(2n){background:linear-gradient(135deg,#eff6ff,#f5f3ff)}
.prompt:nth-child(2n+1){background:linear-gradient(135deg,#ecfdf5,#ecfeff)}
.q{font-size:11px;color:#6d28d9;font-weight:900;letter-spacing:.02em}
.a{font-size:15px;line-height:1.5;margin-top:5px;font-weight:650}
.galleryTitle{font-size:10.5px;font-weight:950;letter-spacing:.08em;color:#0f766e;text-transform:uppercase;margin:18px 0 8px}
.gallery{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
.gallery img{width:100%;aspect-ratio:.95/1;object-fit:cover;border-radius:16px;background:#eee;box-shadow:0 5px 14px rgba(15,23,42,.07)}
.actions{display:grid;grid-template-columns:1fr;gap:9px;margin-top:22px}
.cta{display:block;text-decoration:none;text-align:center;background:linear-gradient(95deg,#0f766e,#6d28d9 60%,#be185d);color:#fff;padding:15px 16px;border-radius:15px;font-weight:950;font-size:15px;box-shadow:0 8px 24px rgba(109,40,217,.18)}
.secondary{display:block;text-decoration:none;text-align:center;background:#fff;color:#0f766e;padding:13px 16px;border-radius:15px;font-weight:850;font-size:14px;border:1px solid #a7f3d0}
.privacy{font-size:11px;color:#8696a0;text-align:center;line-height:1.55;margin-top:15px}
@media(max-width:520px){.wrap{padding:0 0 40px}.brandbar{padding:13px 14px;margin:0}.card{border-radius:0;border-left:0;border-right:0}.content{padding:18px}.name{font-size:28px}.quick{grid-template-columns:1fr}.hero{max-height:none}}
</style></head><body>
<main class="wrap">
  <div class="brandbar"><div class="brand">🪽 Glasswings</div><div class="brandnote">Community member profile</div></div>
  <article class="card">
    <div class="hero">
      ${previewImage ? `<img src="${esc(previewImage)}" alt="${esc(name)}">` : `<div class="fallback">${p.gender==='female'?'👩':p.gender==='male'?'👨':'🙂'}</div>`}
      <div class="heroText">
        <div class="name">${esc(name)}${age ? `, ${esc(age)}` : ''}</div>
        <div class="heroSub">${[place ? `📍 ${esc(place)}` : '', profession ? `💼 ${esc(profession)}` : ''].filter(Boolean).join(' · ')}</div>
      </div>
    </div>
    <div class="content">
      <div class="badges">
        <span class="badge member">🪽 Glasswings member</span>
        ${genderLabel ? `<span class="badge gender">${p.gender==='female'?'♀':'♂'} ${esc(genderLabel)}</span>` : ''}
      </div>

      ${(profession || looking) ? `<div class="quick">
        ${profession ? `<div class="quickCard work"><div class="k" style="color:#0f766e">Profession</div><div class="v">💼 ${esc(profession)}</div></div>` : ''}
        ${looking ? `<div class="quickCard here"><div class="k" style="color:#7c3aed">Here for</div><div class="v">✨ ${esc(looking)}</div></div>` : ''}
      </div>` : ''}

      ${bio ? `<div class="section about"><div class="label">About me</div><div class="bio">${esc(bio)}</div></div>` : ''}
      ${ice ? `<div class="section ask"><div class="label">💬 Easy conversation starter</div><div class="bio" style="font-weight:700">${esc(ice)}</div></div>` : ''}
      ${interests.length ? `<div class="section interests"><div class="label">Interests & vibes</div><div class="pills">${interests.map(x=>`<span class="pill">✦ ${esc(x)}</span>`).join('')}</div></div>` : ''}
      ${prompts.length ? `<div class="section prompts"><div class="label">A little more about ${esc(firstName)}</div>${prompts.map(x=>`<div class="prompt"><div class="q">${esc(x.q||'')}</div><div class="a">${esc(x.a||'')}</div></div>`).join('')}</div>` : ''}
      ${photos.length ? `<div class="galleryTitle">More photos</div><div class="gallery">${photos.map(u=>`<img src="${esc(u)}" alt="${esc(name)}">`).join('')}</div>` : ''}

      <div class="actions">
        <a class="cta" href="${esc(appLink)}">Open ${esc(firstName)}'s profile in Glasswings</a>
        <a class="secondary" href="https://glass-wings.com">Explore Glasswings</a>
      </div>
      <div class="privacy">Only member-facing profile information is shown here. Phone, email and admin-only information are never displayed on this public share page.</div>
    </div>
  </article>
</main>
</body></html>`);
}
