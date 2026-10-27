import { store } from './store';
export const COUNTRIES = { gb: 'United Kingdom', us: 'United States', ie: 'Ireland', au: 'Australia', ca: 'Canada', de: 'Germany', fr: 'France', nl: 'Netherlands' };
export const isMock = () => !process.env.SERPAPI_KEY;
export function host(u) { try { return new URL(/^https?:/i.test(u) ? u : 'https://' + u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } }
const owns = (link, dom) => { const h = host(link || ''); return !!h && (h === dom || h.endsWith('.' + dom)); };

function mockSerp(q, brand, dom) {
  const s = brand.toLowerCase().replace(/[^a-z0-9]/g, '') || 'brand';
  const comp = [['glowhaus.co', `Better Than ${brand}? | Try GlowHaus Free`], ['rivalgoods.com', `${brand} Alternative - 30% Off Today`], ['dealsdirect.io', `${brand} Discount Codes | Verified Today`]];
  const disc = /discount|code/i.test(q);
  const ads = [];
  if (!disc) ads.push({ block_position: 'top', title: `${brand}® Official Site | Free UK Delivery`, link: `https://${dom}/`, displayed_link: dom });
  ads.push(...comp.slice(disc ? 1 : 0, disc ? 3 : 2).map(([d, t], i) => ({ block_position: i ? 'bottom' : 'top', title: t, link: `https://www.${d}/lp`, displayed_link: `www.${d}` })));
  return {
    ads,
    shopping_results: disc ? [{ title: `${brand} bundle`, source: 'Dealsdirect', link: 'https://dealsdirect.io/p/1' }]
      : [{ title: `${brand} Starter Kit`, source: brand, link: `https://${dom}/products/starter` }, { title: 'GlowHaus Kit', source: 'GlowHaus', link: 'https://glowhaus.co/kit' }],
    organic_results: disc ? [{ position: 1, link: `https://www.vouchercodes.co.uk/${s}`, title: `${brand} Discount Codes` }, { position: 2, link: `https://${dom}/pages/offers`, title: 'Offers' }]
      : [{ position: 1, link: `https://${dom}/`, title: `${brand} | Official` }, { position: 2, link: `https://www.trustpilot.com/review/${dom}`, title: 'Reviews' }],
  };
}

async function fetchSerp(q, gl) {
  const key = `serp:${gl}:${q.toLowerCase()}`;
  const hit = await store.get(key); if (hit) return { data: hit, cached: true };
  const u = new URL('https://serpapi.com/search.json');
  Object.entries({ engine: 'google', q, gl, hl: 'en', num: '10', api_key: process.env.SERPAPI_KEY }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u, { cache: 'no-store' }); if (!r.ok) throw new Error(`SerpApi ${r.status}`);
  const data = await r.json(); if (data.error) throw new Error(data.error);
  await store.set(key, data, 86400); return { data, cached: false };
}

export function analyse(d, dom) {
  const ads = (d.ads || []).map(a => ({ pos: a.block_position || 'top', domain: host(a.link || a.tracking_link || a.displayed_link || ''), headline: a.title, own: owns(a.link, dom) || owns(a.displayed_link, dom) }));
  const shop = [...(d.shopping_results || []), ...(d.inline_shopping_results || []), ...(d.immersive_products || [])];
  const ownShop = shop.some(p => owns(p.link || p.product_link, dom) || host(p.source || '') === dom || (p.source || '').toLowerCase().replace(/\s/g, '') === dom.split('.')[0]);
  const org = (d.organic_results || []).sort((a, b) => (a.position || 99) - (b.position || 99));
  const ownPos = org.findIndex(o => owns(o.link, dom));
  return { competitorAds: ads.filter(a => !a.own), ownAd: ads.some(a => a.own), inShopping: ownShop, shoppingCount: shop.length, rank1: ownPos === 0, ownOrganicPosition: ownPos >= 0 ? ownPos + 1 : null, top1: org[0] ? host(org[0].link) : null };
}

export async function runChecks(brand, storeUrl, gl) {
  const dom = host(storeUrl); const mock = isMock();
  const terms = [brand, `${brand} discount code`];
  const out = [];
  for (const t of terms) {
    const { data, cached } = mock ? { data: mockSerp(t, brand, dom), cached: false } : await fetchSerp(t, gl);
    out.push({ term: t, cached, ...analyse(data, dom) });
  }
  return { domain: dom, mock, terms: out, at: new Date().toISOString() };
}
