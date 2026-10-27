// KV store: Upstash Redis when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
// are set; otherwise a local JSON file so mock mode still works on the box.
import fs from 'fs';
import path from 'path';

const FILE = process.env.STORE_FILE || path.join(process.cwd(), 'data', 'store.json');
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
const useRedis = !!(url && token);

let redis = null;
async function getRedis() {
  if (redis) return redis;
  const { Redis } = await import('@upstash/redis');
  redis = new Redis({ url, token });
  return redis;
}

// --- local file backend ---
function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return { kv: {}, leads: [] };
  }
}
function save(d) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
}
const live = (e) => e && (!e.exp || e.exp > Date.now());

const local = {
  async get(k) {
    const e = load().kv[k];
    return live(e) ? e.v : null;
  },
  async set(k, v, ttlSec) {
    const d = load();
    d.kv[k] = { v, exp: ttlSec ? Date.now() + ttlSec * 1000 : 0 };
    save(d);
  },
  async incr(k, ttlSec) {
    const d = load();
    const e = d.kv[k];
    const n = (live(e) ? e.v : 0) + 1;
    d.kv[k] = {
      v: n,
      exp: live(e) && e.exp ? e.exp : ttlSec ? Date.now() + ttlSec * 1000 : 0,
    };
    save(d);
    return n;
  },
  async addLead(l) {
    const d = load();
    d.leads.push(l);
    save(d);
  },
};

// --- Upstash Redis backend ---
// Keys mirror the local store: plain values for caps/cache, list "leads" for submissions.
const remote = {
  async get(k) {
    const r = await getRedis();
    const v = await r.get(k);
    return v === undefined || v === null ? null : v;
  },
  async set(k, v, ttlSec) {
    const r = await getRedis();
    if (ttlSec) await r.set(k, v, { ex: ttlSec });
    else await r.set(k, v);
  },
  async incr(k, ttlSec) {
    const r = await getRedis();
    // Set TTL only on first create so monthly/daily windows don't reset on every hit.
    const exists = await r.exists(k);
    const n = await r.incr(k);
    if (!exists && ttlSec) await r.expire(k, ttlSec);
    return n;
  },
  async addLead(l) {
    const r = await getRedis();
    await r.rpush('leads', JSON.stringify(l));
  },
};

export const store = useRedis ? remote : local;
export const storeBackend = useRedis ? 'upstash' : 'local';
