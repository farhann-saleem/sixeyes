# 19 — Credits and SwichNow (Pakistan)

**Phase E — last.** Do not design checkout or pack prices now. **Do** meter every job (`duration_ms`, `estimated_usd`) from the first generate so prices can be real later.

Users buy credits and spend a fixed amount per action (image / video / template render). Pixovid did this with Razorpay (INR). We do **not**.

## Owner lock (2026-09-12)

Payment gateway is **SwichNow** (Pakistan). Merchant portal: https://portal.swichnow.com/  
API docs: https://api-docs.swichnow.com/

Channels Swich documents: cards (3-D Secure), hosted landing page, JazzCash / Easypaisa, 1Bill, bank, QR, Raast/RTP. Sandbox: `https://sandbox-api.swichnow.com`.

## Product rules (keep Pixovid’s credit UX, swap the processor)

- `User.credits` + `CreditTransaction` ledger + `Payment` rows.
- Fixed `CREDITS_PER_IMAGE` / `CREDITS_PER_VIDEO` / `CREDITS_PER_TEMPLATE_RENDER`.
- Charge **before** the job; refund on `FAILED` (idempotent).
- **Authentic prices:** do not invent credit costs. Every generate (image, video, swap, stitch, template) must record `duration_ms` and `estimated_usd` (worker seconds × that GPU/CPU’s RunPod rate, plus Modal/OpenRouter if used). Pack prices in PKR are derived from those measurements later, with a margin. Pixovid’s flat `CREDITS_PER_*` is a placeholder until we have N real jobs.
- Admin bake/export is not charged (authoring).
- Frontend: balance in nav, `/billing`, packs.

## Backend (Cursor, when told)

- Do not copy `src/lib/razorpay.ts`. New `src/lib/swichnow.ts` against Swich’s auth + Pay In.
- Prefer **hosted checkout / landing page** unless the owner has Direct API credentials and wants wallets on-site.
- Webhook (or inquire) is the backstop so a closed tab still grants credits.
- Currency is **PKR**, not INR. **Billing is last** (owner). Do not invent pack prices or checkout UI until the owner says we are on payments. When we do: three packs in PKR, SwichNow sandbox keys already exist.
