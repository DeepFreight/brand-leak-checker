# Brand-leak checker — launch prep

App: `/workspace/brand-leak-checker`  
Public URL (planned): `https://check.weareoffcut.com`  
Nothing below deploys, creates paid accounts, edits DNS, or fires webhooks until Fin says go.

---

## 1. What already works on the box

```bash
cd /workspace/brand-leak-checker
cp .env.example .env.local   # leave SERPAPI_KEY and UPSTASH_* empty
npm install
npm run dev                  # http://localhost:3100
```

- Empty `SERPAPI_KEY` → mock/example results (banner on results page).
- Empty `UPSTASH_*` → caps + leads stored in `data/store.json`.
- Caps: `MONTHLY_CAP=400`, `DAILY_CAP_PER_USER=3` (email and IP).

Smoke (mock):

```bash
npm run build && npm start &
# then:
curl -s -X POST http://localhost:3100/api/check \
  -H 'content-type: application/json' \
  -d '{"brand":"Ocean Bottle","url":"oceanbottle.co","country":"gb","email":"test@example.com"}'
```

Expect JSON with `"mock": true` and competitor ads.

---

## 2. Env vars (Vercel + local)

| Var | Required on Vercel? | Notes |
|-----|---------------------|-------|
| `SERPAPI_KEY` | Yes for live checks | Free plan = 250 searches/mo; paid plan Fin approved up to $25/mo |
| `UPSTASH_REDIS_REST_URL` | Yes | From Upstash console → REST API |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Same |
| `GHL_WEBHOOK_URL` | Yes for leads | Inbound webhook from GHL workflow |
| `NEXT_PUBLIC_BOOKING_URL` | Recommended | Default `https://weareoffcut.com/#book` |
| `MONTHLY_CAP` | Optional | Default `400` |
| `DAILY_CAP_PER_USER` | Optional | Default `3` |
| `FRAME_ANCESTORS` | Optional | Default allows embed on weareoffcut.com / `*.weareoffcut.com` |

---

## 3. Vercel deploy steps (do not run until Fin logs in)

Prefer **not** deploying from this box until Fin owns the Vercel project under OFFCUT.

1. Fin creates/logs into Vercel (Hobby is fine for MVP).
2. Import this repo / upload the `brand-leak-checker` folder, framework **Next.js**.
3. Region: `lhr1` (London) is set in `vercel.json`.
4. Project → Settings → Environment Variables → add every row in the table above (Production + Preview).
5. Deploy. Note the `*.vercel.app` URL.
6. Project → Settings → Domains → add `check.weareoffcut.com` (Vercel will show the CNAME target; usually `cname.vercel-dns.com`).

CLI alternative (after Fin authorises):

```bash
cd /workspace/brand-leak-checker
npx vercel link          # pick Fin's team/project
npx vercel env add …     # or set in dashboard
npx vercel --prod        # only after Fin's explicit go-live yes
```

---

## 4. Upstash Redis (free tier)

1. Fin creates an account at https://upstash.com (free DB is enough).
2. Create a Redis database, region close to Vercel (`eu-west-1` / London if available).
3. Copy **UPSTASH_REDIS_REST_URL** and **UPSTASH_REDIS_REST_TOKEN** into Vercel env.
4. No code change needed — the app switches automatically when both are set.

---

## 5. DNS checklist (paste for whoever manages weareoffcut.com)

**Do not touch root `@` or `www` — GoHighLevel hosts the main site.**

Only add the subdomain:

| Type | Host / name | Value / target | TTL |
|------|-------------|----------------|-----|
| CNAME | `check` | `cname.vercel-dns.com` | Auto / 300 |

- Full hostname: `check.weareoffcut.com`
- If Vercel's Domains panel shows a different target after you add the domain, use **that** target instead of `cname.vercel-dns.com`.
- Wait for DNS propagation, then confirm HTTPS on `https://check.weareoffcut.com`.
- Optional: embed the checker in a GHL page via iframe pointing at `https://check.weareoffcut.com` (CSP already allows weareoffcut.com frames).

Checklist:

- [ ] Vercel project created and domain `check.weareoffcut.com` added
- [ ] CNAME `check` → Vercel target only (root/www untouched)
- [ ] HTTPS green on the subdomain
- [ ] One real check succeeds with SerpApi key set

---

## 6. GoHighLevel inbound webhook

**Create (in GHL — Fin or whoever owns the workspace):**

1. Automation → Workflows → Create workflow.
2. Trigger: **Inbound Webhook** (copy the webhook URL).
3. Add actions as needed (Create/Update Contact, tag `brand-leak-checker`, notify Slack, etc.).
4. Map JSON fields from the payload below.
5. Paste the webhook URL into Vercel as `GHL_WEBHOOK_URL`.
6. Publish the workflow.

**JSON the app POSTs** (`Content-Type: application/json`):

```json
{
  "brand": "Ocean Bottle",
  "url": "oceanbottle.co",
  "domain": "oceanbottle.co",
  "country": "gb",
  "email": "founder@example.com",
  "ip": "1.2.3.4",
  "at": "2026-10-26T18:00:00.000Z",
  "source": "brand-leak-checker"
}
```

| Field | Use in GHL |
|-------|------------|
| `email` | Contact email |
| `brand` | Custom field / note |
| `url` / `domain` | Website / custom field |
| `country` | Country code (gb, us, …) |
| `ip` | Optional fraud/debug |
| `at` | ISO timestamp |
| `source` | Always `brand-leak-checker` |

The app fires the webhook **before** the SERP check (fire-and-forget). Leave `GHL_WEBHOOK_URL` empty until the workflow is live — no calls are made when unset. Do not test against a live GHL webhook from this prep until Fin says yes.

---

## 7. Still blocked on Fin

1. **SerpApi** — create free account / paste `SERPAPI_KEY` (card only when moving to $25 plan).
2. **Vercel** — Fin login + project ownership (do not deploy under a personal/agent account).
3. **Upstash** — create free Redis DB; paste REST URL + token.
4. **DNS** — CNAME `check` → Vercel (root/www untouched).
5. **GHL** — inbound webhook URL → `GHL_WEBHOOK_URL`.
6. **Booking link** — real URL when ready (Growth Lead); placeholder is fine for launch.

Suggested go-live order: SerpApi key (one real check on the box) → Upstash → Vercel env + deploy → DNS → GHL webhook → announce.
