import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient.js';
import './SupplierDirectory.css';
const categories = ['Catering', 'Bouncers', 'Artists', 'DJs', 'Cabs', 'Influencers', 'Party suppliers', 'Venues', 'Photography', 'Other'];
const icons = ['🍽️', '🛡️', '🎤', '🎧', '🚕', '📱', '🎉', '🏛️', '📷', '☎️'];
const blank = { name: '', company: '', category: 'Catering', city: '', phone: '', whatsapp: '', instagram: '', notes: '' };
export function directoryPhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = '91' + digits;
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : '';
}
export function directoryInstagram(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const handle = raw.replace(/^@/, '');
  if (/^[A-Za-z0-9._]{1,30}$/.test(handle)) return 'https://www.instagram.com/' + handle + '/';
  try { const url = new URL(raw); if (url.protocol === 'https:' && ['instagram.com', 'www.instagram.com'].includes(url.hostname) && !url.username && !url.password) return url.href; } catch {}
  return null;
}
export default function SupplierDirectory() {
  const [rows, setRows] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [query, setQuery] = useState(''), [category, setCategory] = useState('All'), [city, setCity] = useState('All');
  const [form, setForm] = useState(null), [saving, setSaving] = useState(false), [deleting, setDeleting] = useState(null);
  const [message, setMessage] = useState('');
  async function load() {
    setLoading(true); setError('');
    try { const { data, error } = await supabase.from('event_supplier_directory').select('*').order('name'); if (error) throw error; setRows(data || []); }
    catch (e) { setError(e.code === 'PGRST205' || e.code === '42P01' ? 'Directory setup is pending. Ask the admin to run the supplied directory SQL setup once.' : 'Could not load contacts: ' + e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  async function save(e) {
    e.preventDefault(); if (saving) return;
    setError(''); setMessage('');
    const phone = directoryPhone(form.phone), whatsapp = form.whatsapp.trim() ? directoryPhone(form.whatsapp) : '';
    const instagram = directoryInstagram(form.instagram);
    if (!phone || (form.whatsapp.trim() && !whatsapp)) return setError('Enter a valid phone number. Use the country code for numbers outside India.');
    if (instagram === null) return setError('Enter an Instagram handle or an https://www.instagram.com/ link.');
    const payload = Object.fromEntries(Object.keys(blank).map(k => [k, form[k].trim()]));
    Object.assign(payload, { phone, whatsapp, instagram });
    setSaving(true);
    try {
      const request = form.id ? supabase.from('event_supplier_directory').update(payload).eq('id', form.id) : supabase.from('event_supplier_directory').insert(payload);
      const { data, error } = await request.select().single(); if (error) throw error;
      setRows(old => [...old.filter(r => r.id !== data.id), data].sort((a,b) => a.name.localeCompare(b.name)));
      setForm(null); setMessage('Contact saved.');
    } catch (e) { setError('Could not save contact: ' + e.message); } finally { setSaving(false); }
  }
  async function remove(row) {
    if (!window.confirm('Delete ' + row.name + ' from the shared directory?')) return;
    setDeleting(row.id); setError('');
    try { const { data, error } = await supabase.from('event_supplier_directory').delete().eq('id', row.id).select('id'); if (error) throw error; if (!data?.length) throw new Error('Contact was not deleted. Refresh and try again.'); setRows(old => old.filter(r => r.id !== row.id)); setMessage('Contact deleted.'); }
    catch (e) { setError(e.message); } finally { setDeleting(null); }
  }
  const q = query.trim().toLowerCase();
  const visible = rows.filter(r => (category === 'All' || r.category === category) && (city === 'All' || r.city === city) && (!q || [r.name,r.company,r.phone,r.city,r.notes].join(' ').toLowerCase().includes(q)));
  return <section className="gw-directory">
    <header className="gwd-hero"><div><div className="gwd-eyebrow">THE EVENT TEAM'S LITTLE BLACK BOOK</div><h2>☎️ Event directory</h2><p>Your people. One tap away.</p><small>Shared with admins and organisers · {rows.length} contacts</small></div><button onClick={() => { setForm({...blank}); setError(''); }}>＋ Add contact</button></header>
    {error && <div className="gwd-error" role="alert">{error} {!form && <button onClick={load}>Retry</button>}</div>}
    {message && <p role="status" className="gwd-success">{message}</p>}
    {form && <form onSubmit={save} className="gwd-form"><h3>{form.id ? 'Edit contact' : 'Add your go-to person'}</h3><div className="gwd-fields">
      {['name','company','city','phone','whatsapp','instagram'].map(k => <label key={k}>{({name:'Contact name *',company:'Business / team',city:'City',phone:'Phone *',whatsapp:'WhatsApp number (optional)',instagram:'Instagram handle or link'})[k]}<input required={k==='name'||k==='phone'} maxLength={k==='instagram'?200:100} type={['phone','whatsapp'].includes(k)?'tel':'text'} value={form[k]} placeholder={k==='phone'?'+91…':k==='instagram'?'@username':''} onChange={e=>setForm({...form,[k]:e.target.value})} /></label>)}
      <label>Category<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
      <label>Notes<textarea maxLength={1500} value={form.notes} placeholder="Service area, rates, availability, specialities…" onChange={e=>setForm({...form,notes:e.target.value})}/></label></div>
      <small>Add a WhatsApp number only if this contact uses WhatsApp.</small><div className="gwd-actions"><button disabled={saving} type="submit">{saving?'Saving…':'Save contact'}</button><button disabled={saving} type="button" className="gwd-secondary" onClick={()=>{setForm(null);setError('');}}>Cancel</button></div></form>}
    <div className="gwd-filters"><input aria-label="Search contacts" placeholder="Search name, business, phone or notes…" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="Filter by city" value={city} onChange={e=>setCity(e.target.value)}><option value="All">All cities</option>{[...new Set(rows.map(r=>r.city).filter(Boolean))].sort().map(c=><option key={c}>{c}</option>)}</select></div>
    <div className="gwd-categories">{['All',...categories].map((c,i)=><button aria-pressed={category===c} className={category===c?'selected':''} key={c} onClick={()=>setCategory(c)}>{i?icons[i-1]:'✦'} {c}</button>)}</div>
    {loading ? <p role="status">Loading contacts…</p> : !error && !visible.length ? <div className="gwd-empty"><h3>{rows.length?'No matching contacts':'Build your event dream team'}</h3><p>{rows.length?'Try another category, city or search.':'Add your caterer, DJ, security team and other trusted suppliers to get started.'}</p></div> : <><p className="gwd-count">{visible.length} contacts</p><div className="gwd-grid">{visible.map(r=><article className="gwd-card" key={r.id}><div className="gwd-card-top"><span className="gwd-icon">{icons[categories.indexOf(r.category)]||'☎️'}</span><div><small>{r.category}</small><h3>{r.name}</h3><p>{r.company}</p></div></div>{r.city&&<p>📍 {r.city}</p>}<p className="gwd-phone">+{r.phone}</p>{r.notes&&<p className="gwd-notes">{r.notes}</p>}<div className="gwd-actions"><a className="gwd-call" href={'tel:+'+directoryPhone(r.phone)}>☎ Call</a>{directoryPhone(r.whatsapp)&&<a className="gwd-whatsapp" href={'https://wa.me/'+directoryPhone(r.whatsapp)} target="_blank" rel="noopener noreferrer">WhatsApp ↗</a>}{directoryInstagram(r.instagram)&&<a className="gwd-instagram" href={directoryInstagram(r.instagram)} target="_blank" rel="noopener noreferrer">Instagram ↗</a>}</div><footer><button className="gwd-secondary" onClick={()=>{setForm({...blank,...r});setError('');window.scrollTo({top:0,behavior:'smooth'});}}>Edit</button><button className="gwd-delete" disabled={deleting===r.id} onClick={()=>remove(r)}>{deleting===r.id?'Deleting…':'Delete'}</button></footer></article>)}</div></>}
  </section>;
}
