'use client';
import { useState } from 'react';
const COUNTRIES = { gb: 'United Kingdom', us: 'United States', ie: 'Ireland', au: 'Australia', ca: 'Canada', de: 'Germany', fr: 'France', nl: 'Netherlands' };
const BOOK = process.env.NEXT_PUBLIC_BOOKING_URL || 'https://weareoffcut.com/#book';
const Y = ({ v, yes = 'Yes', no = 'No', good = true }) => <span className={v === good ? 'ok' : 'bad'}>{v ? yes : no}</span>;
export default function Page() {
  const [f, setF] = useState({ brand: '', url: '', country: 'gb', email: '', company: '' });
  const [r, setR] = useState(null), [e, setE] = useState(''), [busy, setBusy] = useState(false);
  const on = k => ev => setF({ ...f, [k]: ev.target.value });
  async function go(ev) { ev.preventDefault(); setBusy(true); setE('');
    try { const res = await fetch('/api/check', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f) });
      const j = await res.json(); if (!res.ok) setE(j.error || 'Something went wrong.'); else { setR(j); window.scrollTo(0, 0); } } catch { setE('Network error.'); } setBusy(false); }
  const comp = r ? r.terms.reduce((n, t) => n + t.competitorAds.length, 0) : 0;
  return (<div className="w"><nav><a href="https://weareoffcut.com" target="_top" className="logo" aria-label="OFFCUT"><img src="/logo.png" alt="OFFCUT" height="28" /></a><a href={BOOK} target="_top" className="fine" style={{ fontSize: 14 }}>Book a call →</a></nav>
  {!r ? (<>
    <h1>Who's <em>stealing</em> your brand searches?</h1>
    <p className="lead">Enter your brand and see who's bidding on your name on Google right now, and whether you're showing up in Search and Shopping. Free, takes 30 seconds.</p>
    <form onSubmit={go} noValidate>
      <label>Brand name<input required maxLength={60} value={f.brand} onChange={on('brand')} placeholder="Your brand name" /></label>
      <label>Store URL<input required maxLength={200} value={f.url} onChange={on('url')} placeholder="yourbrand.com" /></label>
      <label>Country<select value={f.country} onChange={on('country')}>{Object.entries(COUNTRIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label>Work email<input required type="email" maxLength={120} value={f.email} onChange={on('email')} placeholder="you@yourbrand.com" /></label>
      <input name="company" value={f.company} onChange={on('company')} style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />
      {e && <div className="err">{e}</div>}
      <button className="btn" disabled={busy}>{busy ? 'Checking Google…' : 'Run my free check'}</button>
      <p className="fine">We'll email you your results and the occasional useful Google Ads note from OFFCUT. No spam, unsubscribe anytime. We never share your data.</p>
    </form></>) : (<>
    {r.mock && <div className="banner">EXAMPLE DATA: mock mode (no SerpApi key). These results are made up for demo purposes.</div>}
    <p className="tag" style={{ marginTop: 40 }}>Brand-leak report · {r.domain} · {r.country}</p>
    <h1>{comp ? <><em>{comp}</em> competitor ad{comp > 1 ? 's' : ''} on your brand terms</> : <>No competitor ads <em>right now</em></>}</h1>
    <div className="sum">
      <div className="card"><div className="n">{comp}</div><p>Competitor ads found</p></div>
      <div className="card"><div className="n">{r.terms.filter(t => t.ownAd).length}/{r.terms.length}</div><p>Terms where you have your own ad</p></div>
      <div className="card"><div className="n">{r.terms.filter(t => t.inShopping).length}/{r.terms.length}</div><p>Terms where you're in Shopping</p></div>
      <div className="card"><div className="n">{r.terms.filter(t => t.rank1).length}/{r.terms.length}</div><p>Terms where you rank #1 organically</p></div></div>
    {r.terms.map(t => <div className="term" key={t.term}><h3>“{t.term}”</h3>
      <div className="chk"><span>Your ad: <Y v={t.ownAd} /></span><span>In Shopping: <Y v={t.inShopping} /></span><span>#1 organic: <Y v={t.rank1} />{!t.rank1 && t.top1 ? ` (#1 is ${t.top1}${t.ownOrganicPosition ? `, you're #${t.ownOrganicPosition}` : ''})` : ''}</span></div>
      {t.competitorAds.length ? <table><thead><tr><th>Advertiser</th><th>Headline</th><th>Position</th></tr></thead><tbody>
        {t.competitorAds.map((a, i) => <tr key={i}><td><b>{a.domain}</b></td><td>{a.headline}</td><td>{a.pos}</td></tr>)}</tbody></table> : <p className="fine">No competitor ads seen for this term.</p>}</div>)}
    <div className="cta"><p style={{ fontSize: 18, margin: '0 0 20px' }}>This is a snapshot from one location at one moment, since ads change through the day. Want the full picture?</p>
      <a className="btn" href={BOOK} target="_top">Book a 20-min call with Fin</a>
      <p className="fine" style={{ color: '#BDBDBD', marginTop: 16 }}>Searched from {r.country} at {new Date(r.at).toLocaleString('en-GB')}.</p></div>
    <p><a href="#" onClick={ev => { ev.preventDefault(); setR(null); }}>← Check another brand</a></p></>)}
  </div>);
}
