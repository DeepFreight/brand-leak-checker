import { store } from './store';
export const COUNTRIES = { gb: 'United Kingdom', us: 'United States', ie: 'Ireland', au: 'Australia', ca: 'Canada', de: 'Germany', fr: 'France', nl: 'Netherlands' };

// Country → Google domain + a city-level location so ads/organic match what people see locally.
const SERP_LOCALE = {
  gb: { google_domain: 'google.co.uk', location: 'London, England, United Kingdom' },
  us: { google_domain: 'google.com', location: 'New York, New York, United States' },
  ie: { google_domain: 'google.ie', location: 'Dublin, County Dublin, Ireland' },
  au: { google_domain: 'google.com.au', location: 'Sydney, New South Wales, Australia' },
  ca: { google_domain: 'google.ca', location: 'Toronto, Ontario, Canada' },
  de: { google_domain: 'google.de', location: 'Berlin, Germany' },
  fr: { google_domain: 'google.fr', location: 'Paris, France' },
  nl: { google_domain: 'google.nl', location: 'Amsterdam, Netherlands' },
};

export const isMock = () => !process.env.SERPAPI_KEY;

/** Normalize a URL or Google displayed_link ("https://www.brand.com › path") to a bare hostname. */
export function host(u) {
  if (!u) return '';
  try {
    let s = String(u).trim();
    // Google ads often use " › " breadcrumbs in displayed_link — keep the first segment only.
    s = s.split(/\s*[\u203a>]\s*/)[0].trim();
    s = s.replace(/^https?:\/\//i, '');
    s = s.split('/')[0].split('?')[0].split('#')[0];
    s = s.replace(/^www\./i, '').toLowerCase();
    // Reject junk that isn't a hostname
    if (!s || !s.includes('.') || /\s/.test(s)) return '';
    return s;
  } catch {
    return '';
  }
}

const owns = (link, dom) => {
  const h = host(link || '');
  return !!h && !!dom && (h === dom || h.endsWith('.' + dom));
};

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
  const locale = SERP_LOCALE[gl] || { google_domain: 'google.com', location: COUNTRIES[gl] || 'United States' };
  // v2 in cache key busts the bad pre-locale cache entries.
  const key = `serp:v2:${gl}:${locale.google_domain}:${q.toLowerCase()}`;
  const hit = await store.get(key); if (hit) return { data: hit, cached: true };
  const u = new URL('https://serpapi.com/search.json');
  const params = {
    engine: 'google',
    q,
    gl,
    hl: 'en',
    num: '10',
    google_domain: locale.google_domain,
    location: locale.location,
    api_key: process.env.SERPAPI_KEY,
  };
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u, { cache: 'no-store' }); if (!r.ok) throw new Error(`SerpApi ${r.status}`);
  const data = await r.json(); if (data.error) throw new Error(data.error);
  await store.set(key, data, 86400); return { data, cached: false };
}

export function analyse(d, dom) {
  const ads = (d.ads || []).map(a => ({
    pos: a.block_position || 'top',
    domain: host(a.link || a.tracking_link || a.displayed_link || ''),
    headline: a.title,
    own: owns(a.link, dom) || owns(a.displayed_link, dom) || owns(a.source, dom) || host(a.source || '') === dom.split('.')[0],
  }));
  // Also treat source "Ocean Bottle" matching brand domain slug as own when link is google tracking only — already covered via link.
  const shop = [...(d.shopping_results || []), ...(d.inline_shopping_results || []), ...(d.immersive_products || [])];
  const ownShop = shop.some(p => owns(p.link || p.product_link, dom) || host(p.source || '') === dom || (p.source || '').toLowerCase().replace(/\s/g, '') === dom.split('.')[0]);
  const org = (d.organic_results || []).sort((a, b) => (a.position || 99) - (b.position || 99));
  const ownPos = org.findIndex(o => owns(o.link, dom));
  return {
    competitorAds: ads.filter(a => !a.own && a.domain),
    ownAd: ads.some(a => a.own),
    inShopping: ownShop,
    shoppingCount: shop.length,
    rank1: ownPos === 0,
    ownOrganicPosition: ownPos >= 0 ? ownPos + 1 : null,
    top1: org[0] ? host(org[0].link) : null,
  };
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
