# 19 — Pricing tiers and SwichNow (Pakistan)

**Shipped 2026-09-14.** Free / Pro / Premium tiers, monthly quotas, per-minute rate limits, SwichNow hosted checkout (Landing Page / PWA flow), and legal policy pages. Metering (`duration_ms`, `estimated_usd`) on every job continues unchanged.

## Tier table (owner update 2026-09-17)

| | Free | Pro | Premium |
| --- | --- | --- | --- |
| Price | $0 | $20 / mo | $150 / mo |
| Swich amount | — | **PKR 5,600** | **PKR 42,000** |
| Rate limit | 6 req/min | 30 req/min | 60 req/min |
| Avatars | 1 | 30 | 300 |
| Image recreations | 5 | 100 | 1,000 |
| Videos | 3 | 30 | 300 |
| Documentaries | 10 | 200 | 2,000 |
| Audio credits | 300 | 5,000 | 50,000 |
| Bulk requests, all tools | — | Coming soon | Coming soon |

PKR constants live in `apps/backend/src/plans.ts` (`price_pkr`) — change there, not in the UI. Everyone defaults to **Free**. A successful Swich payment grants the paid tier for **30 days**; when it expires the account returns to Free. Usage windows are calendar months (`YYYY-MM`), so a mid-month upgrade keeps the month's counters.

## Quota mapping (what counts as what)

- **avatars** → `POST /api/avatars` (avatar generate; saving an identity is free)
- **images** → `POST /api/faceswaps` with an image template (`kind=image`)
- **videos** → `POST /api/faceswaps` with a video template or effect (`kind=video`) + `POST /api/studio/projects` with `from.type === "library"` (edit a library clip in Studio)
- **documentaries** → `POST /api/studio/projects` with a `topic` (new documentary)
- **audio** → TTS / dialogue / clone / voice change / dub / isolate / STT / SFX / music (one accepted generation = one audio credit). Audio usage currently persists in `DATA_DIR/audio-usage.json`, not Supabase. Studio export is not monthly quota-metered.

Enforcement: quota exceeded → 429 `{ error: "<Tier> allows N <kind> per month. Upgrade on the Pricing page." }`. Rate limit → 429 + `Retry-After`. Both apply only to POST job-creating routes; GET/polling is never throttled. Code: `apps/backend/src/billing-guard.ts`, store: `billing-store.ts` (Supabase profiles and `record_usage` RPC in production, JSON fallback in tests; audio has a separate disk ledger).

## SwichNow integration (from `payment-gateway/API Plugin.docx`)

Hosted checkout, **Landing Page / PWA (GET)** flow (doc §5), channel `0`, currency PKR:

- Checkout checksum: HMAC-SHA256 over `Swich:{customerTransactionId}:{item}:{amount}` with `SWICHNOW_SECRET`.
- Callback (doc §16): `GET /api/webhooks/swich`, public (mounted before `requireAuth`). Verify HMAC-SHA256 over `SWCallback:{CustomerTransactionId}:{OrderId}:{Amount}:{Status}`. Answer exactly `{"status":"success"}`. On `success` status the order grants the tier once (idempotent — duplicate callbacks never double-grant).
- `successRedirectUrl` = `{FRONTEND_URL}/pricing?paid=1&order=<order-id>`; Swich redirects only on success.
- Checkout requires a mobile number (`03xxxxxxxxx`) — Swich makes `msisdn` mandatory on the landing page. Name/email come from the Google profile.
- Env (values only in `.env`): `SWICHNOW_API_KEY` (clientId), `SWICHNOW_SECRET` (HMAC secret key), `SWICHNOW_BASE_URL` (sandbox vs prod picks the PWA host), optional `SWICHNOW_PWA_URL` override. Missing keys → `/api/billing/checkout` returns 503.

Routes: `GET /api/billing/plan` (tier, usage, quotas, rate), `POST /api/billing/checkout` (`{tier, msisdn}` → `{order_id, url}`), `GET /api/billing/order/:id` (status backstop after redirect).

## Product rules

- Pricing page: `/pricing` (nav + footer). Shows the three cards, the current plan's usage bars, and the upgrade form. Policy pages: `/terms`, `/refund`, `/delivery`, `/cancellation` — copy adapted from `payment-gateway/Policies.pdf` (Medigify → Marketing Studio), footer phone `+92-300-4084760`.
- Recurring **auto-debit** (doc §15, instrument tokens, IP whitelisting) is **not wired** — payments are 30-day one-time grants for now. Recurring cards are the follow-up when the owner says go.
- Swich Inquire API (`/gateway/payin/v2.0/inquire`) is documented but unused; the callback is the backstop.

## Do not

Invent quotas for products not in the owner table (export). Invent a fourth tier. Commit `SWICHNOW_SECRET` or `.env`. Put the webhook behind `requireAuth`.

## Owner update — 2026-09-17

- Pro/Premium prices, quotas and all existing RPM limits stay unchanged. Removed multiplier claims because the new Free quotas are no longer proportional.
- Bulk requests for **all tools** are advertised as **coming soon** on Pro/Premium. Owner explicitly requested copy only; no bulk backend or submission UI.
- Upgrade copy says allow **up to 24 hours**, with activation only after processed/verified payment. No artificial 24-hour delay: existing verified webhook grants immediately. The return page verifies the owner-scoped order, never trusts `paid=1` as payment proof, and stops polling when resolved. Successful callbacks must match the stored amount.
- Rate-limit responses give retry seconds and the relevant upgrade. CPU unavailability asks users to wait; it does not claim their account RPM was used or that an unaccepted job is queued. Actual RunPod `IN_QUEUE` swap jobs display queued feedback.
- Startup, lazy routes and pricing fetches show loading feedback, respecting reduced motion. Vercel Analytics uses the React entry point because the frontend is Vite, not Next.js.
- Public catalogs and guest pricing have a 15-second browser cache with concurrent-request deduplication and failed-response eviction. Private plans, orders and job polling bypass it; backend private responses remain `private, no-store`.

### Viewing usage in Supabase

No database migration is needed for the revised Free limits. Table Editor → `profiles` already contains `month_key`, `usage_avatars`, `usage_images`, `usage_videos`, `usage_documentaries`, `tier`, and `tier_expires_at`. Read counters against `month_key`: old-month counters are treated as zero by the app until the next write resets them. `billing_orders` records payment status and grants. Audio counts need a separate migration/backfill from the server ledger before they can be reported reliably in Supabase. Owner asked this as a question; no database change was made.

### Validation (2026-09-17)

Validation: frontend and backend typechecks passed; frontend production build passed. Billing/CPU/cache tests passed. Full backend suite passed 9/10 files in sandbox; security tests passed all 9 checks with localhost networking enabled. Local browser verified public pricing values, bulk coming-soon copy, 24-hour notice and loading state using an isolated mock API. No real payment, generation, or production deployment. Analytics 2.0.1 was reused from an existing local installation with matching npm lockfile metadata because registry access failed; a fresh registry install was not verified.

### Owner-run allowance SQL

Owner reports SQL applied (2026-09-17); migration reference: `supabase/migrations/20260917080000_plan_credit_limits.sql`. Stores the three plan allowances and exposes a service-role/admin-only balance view. Uses existing non-audio counters and UTC calendar months; audio used/remaining stay NULL pending ledger migration. Application still uses `plans.ts` for limits; SQL table is a reporting mirror, not a new enforcement source. Owner ran the full SQL manually in SQL Editor after a SELECT-only attempt reported the view missing. Application code and deployment do not auto-apply this migration.
