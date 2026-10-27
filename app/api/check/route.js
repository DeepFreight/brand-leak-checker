import { NextResponse } from 'next/server';
import { store } from '../../../lib/store';
import { runChecks, COUNTRIES, host } from '../../../lib/serp';
export const dynamic = 'force-dynamic';
const MONTH = +(process.env.MONTHLY_CAP || 400), PER = +(process.env.DAILY_CAP_PER_USER || 3);
const err = (m, s = 400) => NextResponse.json({ error: m }, { status: s });
export async function POST(req) {
  let b; try { b = await req.json(); } catch { return err('Bad request'); }
  const brand = String(b.brand || '').trim(), url = String(b.url || '').trim(), country = String(b.country || '').toLowerCase(), email = String(b.email || '').trim().toLowerCase();
  if (b.company) return err('Bad request'); // honeypot
  if (brand.length < 2 || brand.length > 60 || !/^[\p{L}\p{N} &'.\-]+$/u.test(brand)) return err('Enter a valid brand name.');
  const dom = host(url); if (!dom || !dom.includes('.') || url.length > 200) return err('Enter a valid store URL, e.g. yourbrand.com');
  if (!COUNTRIES[country]) return err('Choose a country.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) return err('Enter a valid email.');
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';
  const day = new Date().toISOString().slice(0, 10), month = day.slice(0, 7);
  const lead = { brand, url, domain: dom, country, email, ip, at: new Date().toISOString(), source: 'brand-leak-checker' };
  await store.addLead(lead);
  if (process.env.GHL_WEBHOOK_URL) fetch(process.env.GHL_WEBHOOK_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(lead) }).catch(() => {});
  if ((await store.get(`cap:m:${month}`) || 0) >= MONTH) return err("We've hit this month's limit of free checks. Book a call and we'll run it for you.", 429);
  if ((await store.get(`cap:e:${email}:${day}`) || 0) >= PER || (await store.get(`cap:i:${ip}:${day}`) || 0) >= PER) return err(`Limit of ${PER} checks per day reached. Try again tomorrow.`, 429);
  let result; try { result = await runChecks(brand, url, country); } catch (e) { console.error(e); return err('Search failed, please try again shortly.', 502); }
  await store.incr(`cap:m:${month}`, 40 * 86400); await store.incr(`cap:e:${email}:${day}`, 86400); await store.incr(`cap:i:${ip}:${day}`, 86400);
  return NextResponse.json({ brand, country: COUNTRIES[country], ...result });
}
