# Status — 2026-09-14

Capture: Cursor and Codex desktop verified. Two desktop canary pairs are saved (first recovered, second automatically exported); persistent user service active. Internal review sessions excluded. See [CAPTURE-TEST.md](../CAPTURE-TEST.md). No CLI required; no product changes.

## UI polish — 2026-09-14

Owner-approved film board redesign and shared visual consistency shipped. Four steps and navy topic workspace use the SVG logo; Your films stays below. Responsive nav, balanced Audio/Avatar columns, restored MCP cards, lime focus, reduced motion and Lightbox keyboard focus.

**Compact desks (owner 2026-09-14):** Avatar and MCP use 16px html (same idea as Mix). Script and Cast/scenes are denser — shorter narration fields, tighter scene rows, smaller cast shot tiles. Topic, shelf, Mix, and Audio stay as they were. See CONTEXT top.

## Pricing + SwichNow — 2026-09-14

Owner-approved Free / Pro / Premium pricing shipped. Tiers: Free $0 (3 avatars, 10 image recreations, 3 videos, 20 documentaries, 6 req/min), Pro $20/mo (×10, 30 req/min, PKR 5,600), Premium $150/mo (×100, 60 req/min, PKR 42,000). Constants in `apps/backend/src/plans.ts`. SwichNow hosted checkout (Landing Page PWA, PKR) with HMAC callback at `GET /api/webhooks/swich`; success grants the tier for 30 days. Checkout needs a mobile number (Swich requirement). Quota/rate-limit 429s on generation routes; GET/polling never throttled. `/pricing` page with usage bars; legal pages `/terms`, `/refund`, `/delivery`, `/cancellation` (copy adapted from `payment-gateway/Policies.pdf`). Recurring auto-debit not wired (30-day grants). Spec: [../spec/19-credits-swichnow.md](../spec/19-credits-swichnow.md). Tests: `apps/backend/billing.test.ts`.

## Aim

Marketing Studio (`marketingstudioie.site`): Higgsfield-style generative-media SaaS. **MVP** follows Pixovid / `docs/sources/`. **Destination** is [higgsfield.ai](https://higgsfield.ai/). Extra feature chosen: **Audio studio** (spec 21). Login shipped; SwichNow pricing shipped; Stitch UI + Supabase last.

Complete guide: [spec/README.md](../spec/README.md). Lock: [CONTEXT.md](../CONTEXT.md). Env names: [ENV.md](ENV.md).

`.env` has HF, R2, RunPod, ai33pro, Modal tokens (`farhansaleem-342-g`). **OpenRouter key replaced** (owner 2026-09-13). Google login keys filled. SwichNow keys filled (`SWICHNOW_API_KEY` clientId, `SWICHNOW_SECRET` HMAC secret). Supabase empty on purpose (end). Never commit `.env`.

## Build order

| Phase | What | Status |
| --- | --- | --- |
| A | RunPod **Krea** T2I + **Qwen Edit** I2I | **Set** (`i3fvrhucaici89`, `ko6zewns6wj3mj`, EU-RO-1) |
| B | RunPod CPU **FaceFusion** + **ffmpeg** | Endpoint `rydclpv4ta6u4p`. **Still swap verified** on Images Templates. **Video swap verified** on Video Templates (15s handheld + `avatar.jpeg`, job `1fab1e69`, **133.7s**). Library **delete** shipped. **Stitch wired** from `/studio` export (product smoke pending first Export). |
| C | Modal **LTX-2.5** video (**$25** cap) | App **deployed** on **H200** (no offload, 20 steps). Fast 5s smoke **72s**. H100 offload path is retired (1233s). |
| D | Express MVP. Avatar, Audio, templates, **Projects documentary** (spec 22-brief). No login. | **Landing** is `/` (Stitch Higgsfield clone). **Projects** is `/projects`. Script → Pexels cast → same-id Studio. Export waits on CPU timeline-v1 deploy. Audio `/audio`. Avatar default **FLUX.2 Klein 4B**. Muse geo-blocked. Costs: [COST.md](COST.md). |
| E | Stitch UI, login, Supabase, SwichNow | **Login shipped** (Google, all `/api` guarded). **Pricing + SwichNow shipped** (Free/Pro/Premium, quotas, rate limits, hosted checkout, `/pricing`). Left: Stitch UI polish, Supabase, recurring auto-debit. |

Images are RunPod, not Modal. Modal is video only.

**Owner now (2026-09-14):** New film has **How long** — 30 / 45 / **60** / 90 seconds (90s hard cap). Prompt boxes are guarded (topic, script, audio, overlay). MCP `create_documentary` accepts `duration_sec`. `.agent-logs/` stays **in git** (8x assignment). The RunPod key inside one dump is **redacted**. Rotate that RunPod key. Product type is **24px** root (was 20). Navbar is **under the page heading** (14px items, 64px bar). No horizontal page scroll. Page heads are **centered** with space under the bar. Documentaries: four cards are **step nav**. Topic / story / cast / mix render in a **full-width panel** under the cards (Topic navy, readable cream type). Films stay below. Headings and body on `/projects` are larger — do not ship 11–14px copy. Cover stills (no black bars). Short stock queries are padded, not a dead script. Avatar desk: large model cards + tags; empty state says create an avatar first. Audio is the same 50/50 left form / right result. Lightbox close is lime, not dim ink. **MCPs is live** — `/mcp` setup + `POST /mcp` JSON-RPC (spec 23). Tools: films, looks, identities, library, async generate. Optional `MCP_TOKEN`. Library 4-col. Avatars first. FaceFusion wrap. **Google login shipped (2026-09-14, owner go):** every page sits behind a sign-in gate (LoginGate), backend guards all of `/api` and `/mcp` (`requireAuth`), endpoints `/api/auth/login|callback|me|logout` in `apps/backend/src/google-auth.ts`, 7-day HttpOnly cookie session in memory, `FRONTEND_URL` + `GOOGLE_CLIENT_*` filled in `.env`, redirect `https://www.marketingstudioie.site/callback` (add `http://localhost:5173/callback` in the Google console for local testing). LoginGate copy: clicking Create / Generate asks Google to authorize. Logout in navbar badge. Sessions reset on backend restart (no DB yet). `apps/frontend/vercel.json` rewrites `/callback` + SPA routes to `index.html` (filesystem first, `/api` + `/mcp` untouched) — must live in the Vercel project root. `/api` still needs a route to the backend host on Vercel before login completes live.

**Owner (2026-09-13):** Designing landing in Stitch (no code from Cursor). Copy lock: headline **Imagine it. Then be in it.** Tagline **Your Imagination Engine**. CTA **Start creating**. Wall + Remix only — [spec/16](../spec/16-frontend-overhaul.md). OpenRouter key **works**. Avatar default **FLUX.2 Klein 4B**. Krea 2 Medium Turbo off the picker. Muse region-blocked. Qwen still `throttled` — do not generate. Do not resubmit a stuck Seedream task. Do not start LTX generate / login. Video studio Export uses CPU `op=stitch` (not GPU). **Effects** (`/effects`): grouped packs (Incline, Stop World, Clones, …). FaceFusion Recreate + saved avatar. Owner scrape lock 2026-09-14.

**Audio studio (2026-09-13, owner go):** Higgsfield-like tab at `/audio` plus extra OpenSpeaker tools. **Library UX (owner 2026-09-13):** CapCut-style bin — cover preview, duration, **+** to use. Voices still play `preview_url` (0 credits). SFX/Suno have no vendor preview catalog. Spec: [../spec/21-audio-studio.md](../spec/21-audio-studio.md).

**LTX lock:** I2V animates a still that already is the shot. A 30s YouMind brief on a studio portrait does **not** become a vlog. See CONTEXT § LTX job.

**Handoff:** [CONTEXT.md](../CONTEXT.md) top section. Modal: [MODAL.md](MODAL.md). Video studio: [../spec/22-video-studio.md](../spec/22-video-studio.md). Project list: **Edit / Rename / Delete**.

## Do not

Invent another extra feature (Audio studio already shipped). Spend GPU on curiosity generates. Copy Pixovid blocking HTTP. Put FaceFusion/ffmpeg on a GPU. Put Krea/Qwen on the Modal $25. H100 LTX offload. Claim lip-sync on Translate.

Capture observation (2026-09-13): one Codex canary prompt now exists (session `01a09a27`, `gpt-5.1-codex-max`), but no response at inspection. Two complete session pairs and desktop capture remain unverified. See CAPTURE-TEST.md.

Seedream (2026-09-13): task `8235f308-…` stayed `doing` with no % / no URL / 986 credits. Restart now **polls that id** (a mid-fix crash marked the job FAILED; reopened the same task, no new charge). Details: [COST.md](COST.md).

## Projects documentary (2026-09-13)

**App shipped.** One project owns script → 2–3 Pexels picks → same-id Studio. Nav **Projects** (`/` and `/projects`). Pexels: video search URL is `https://api.pexels.com/videos/search` (photos still `/v1/search`); send a User-Agent or Pexels 403s; video files may be on `player.vimeo.com`. `PEXELS_API_KEY` is in `.env` (never commit). OpenRouter text default `openai/gpt-4o-mini`. Spec: [../spec/22-brief-stock-documentary.md](../spec/22-brief-stock-documentary.md).

**Studio layout:** Mix/Studio fills leftover viewport (nav + compact step rail only). Preview, transport, and timeline stay on one screen. **Start a film** keeps the normal page, shelf, and footer. Hard-refresh Mix if the editor still scrolls under the films list.

**Audio mix:** Play hears Narration on A1. Music/SFX come from the Studio **Audio** bin (completed `/audio` jobs) or an uploaded mp3 — not a stock-music API.

**Export not live:** CPU stitch still needs `scripts/cpu-timeline/` deployed so ping returns `timeline_version: 1`. Do not treat Export as verified. Do not start LTX.
