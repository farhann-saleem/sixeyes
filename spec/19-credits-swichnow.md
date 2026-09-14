# 19 — Pricing tiers and SwichNow (Pakistan)

**Shipped 2026-09-14.** Free / Pro / Premium tiers, monthly quotas, per-minute rate limits, SwichNow hosted checkout (Landing Page / PWA flow), and legal policy pages. Metering (`duration_ms`, `estimated_usd`) on every job continues unchanged.

## Tier table (owner lock 2026-09-14)

| | Free | Pro | Premium |
| --- | --- | --- | --- |
| Price | $0 | $20 / mo | $150 / mo |
| Swich amount | — | **PKR 5,600** | **PKR 42,000** |
| Rate limit | 6 req/min | 30 req/min | 60 req/min |
| Avatars | 3 | 30 | 300 |
| Image recreations | 10 | 100 | 1,000 |
| Videos | 3 | 30 | 300 |
| Documentaries | 20 | 200 | 2,000 |

PKR constants live in `apps/backend/src/plans.ts` (`price_pkr`) — change there, not in the UI. Everyone defaults to **Free**. A successful Swich payment grants the paid tier for **30 days**; when it expires the account returns to Free. Usage windows are calendar months (`YYYY-MM`), so a mid-month upgrade keeps the month's counters.

## Quota mapping (what counts as what)

- **avatars** → `POST /api/avatars` (avatar generate; saving an identity is free)
- **images** → `POST /api/faceswaps` with an image template (`kind=image`)
- **videos** → `POST /api/faceswaps` with a video template or effect (`kind=video`) + `POST /api/studio/projects` with `from.type === "library"` (edit a library clip in Studio)
- **documentaries** → `POST /api/studio/projects` with a `topic` (new documentary)
- Audio jobs (TTS / SFX / Suno / clone) and studio export are **not** quota-metered (not in the owner table) but share the per-minute throttle window.

Enforcement: quota exceeded → 429 `{ error: "<Tier> allows N <kind> per month. Upgrade on the Pricing page." }`. Rate limit → 429 + `Retry-After`. Both apply only to POST job-creating routes; GET/polling is never throttled. Code: `apps/backend/src/billing-guard.ts`, store: `billing-store.ts` (JSON under `apps/backend/data/`, same pattern as the studio store).

## SwichNow integration (from `payment-gateway/API Plugin.docx`)

Hosted checkout, **Landing Page / PWA (GET)** flow (doc §5), channel `0`, currency PKR:

- Checkout checksum: HMAC-SHA256 over `Swich:{customerTransactionId}:{item}:{amount}` with `SWICHNOW_SECRET`.
- Callback (doc §16): `GET /api/webhooks/swich`, public (mounted before `requireAuth`). Verify HMAC-SHA256 over `SWCallback:{CustomerTransactionId}:{OrderId}:{Amount}:{Status}`. Answer exactly `{"status":"success"}`. On `success` status the order grants the tier once (idempotent — duplicate callbacks never double-grant).
- `successRedirectUrl` = `{FRONTEND_URL}/pricing?paid=1`; Swich redirects only on success.
- Checkout requires a mobile number (`03xxxxxxxxx`) — Swich makes `msisdn` mandatory on the landing page. Name/email come from the Google profile.
- Env (values only in `.env`): `SWICHNOW_API_KEY` (clientId), `SWICHNOW_SECRET` (HMAC secret key), `SWICHNOW_BASE_URL` (sandbox vs prod picks the PWA host), optional `SWICHNOW_PWA_URL` override. Missing keys → `/api/billing/checkout` returns 503.

Routes: `GET /api/billing/plan` (tier, usage, quotas, rate), `POST /api/billing/checkout` (`{tier, msisdn}` → `{order_id, url}`), `GET /api/billing/order/:id` (status backstop after redirect).

## Product rules

- Pricing page: `/pricing` (nav + footer). Shows the three cards, the current plan's usage bars, and the upgrade form. Policy pages: `/terms`, `/refund`, `/delivery`, `/cancellation` — copy adapted from `payment-gateway/Policies.pdf` (Medigify → Marketing Studio), footer phone `+92-300-4084760`.
- Recurring **auto-debit** (doc §15, instrument tokens, IP whitelisting) is **not wired** — payments are 30-day one-time grants for now. Recurring cards are the follow-up when the owner says go.
- Swich Inquire API (`/gateway/payin/v2.0/inquire`) is documented but unused; the callback is the backstop.

## Do not

Invent quotas for products not in the owner table (audio, export). Invent a fourth tier. Commit `SWICHNOW_SECRET` or `.env`. Put the webhook behind `requireAuth`.
