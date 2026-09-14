# Current handoff — split hosting locked (2026-09-14)

Owner locked **Vercel frontend + EC2 backend**. Frontend uses `https://api.marketingstudioie.site` with credentialed requests; backend accepts the Vercel origin and binds to localhost behind Caddy. Google OAuth keeps `https://www.marketingstudioie.site/callback`. Local verification: 34 backend tests and the frontend production build pass.

Commit `83614b9` passed GitHub Actions, Vercel deployed the frontend, and EC2 installed the matching backend revision. API localhost health passes; Caddy is active on 80/443. Friend controls Hostinger DNS. Remaining DNS action: keep `www` and `@` on Vercel and add only `A api -> 13.49.134.103`. Public TLS/login and two-account isolation cannot be verified until that resolves. Shared CPU timeline-v1 export remains a separate gate.

---

# Superseded handoff — EC2 running; hosting decision pending (2026-09-14)

Commit `332319e1ee375ff2ab0f175d03a08657087fe4fb` is pushed to main. GitHub Actions run `34850249715` passed all checks (33 backend tests, backend/frontend typechecks, frontend build), published the deployment release, and EC2 installed it successfully. `/health` on server localhost returned that revision; ms-backend is running, approximately 118 MB at startup. Node 24/Caddy/FFmpeg and 2 GB swap installed. Runtime credentials filtered from local .env and installed securely; no secrets in GitHub. ms-deploy.timer is enabled and active, polling releases every two minutes. First install verified; subsequent automatic update/rollback and full user/generation smokes are not yet verified.

Host `13.49.134.103`, SSH `ec2-user`, key path `/home/farhann-saleem/Downloads/marketing-studioo.pem` (mode 600); Amazon Linux 2023 x86_64, approximately 2 GB RAM, 20 GB root disk. App paths and systemd deployment instructions are in docs/DEPLOY.md. Caddy configuration is installed/validated and service enabled but not started; DNS still points to Vercel. Do not claim public HTTPS/login is live on EC2.

Owner now asks whether Vercel frontend + EC2 backend is possible and wants short answers/conserved credits. It IS possible with API URL, credentialed CORS/fetch and cookie/origin/OAuth configuration changes (prefer api subdomain under the same site); current implemented deployment serves both on EC2. Await owner's hosting choice before changing architecture or DNS. No authorization to infer a final split-host choice from this question. Shared CPU timeline-v1 export remains a separate deployment gate. Personal .commandcode and .agent-logs modifications remain untouched/uncommitted.

---

# Active handoff — EC2 deployment and automatic updates (2026-09-14)

Owner supplied EC2 access and authorized automatic deployment on GitHub pushes. Actual instance is Amazon Linux 2023 x86_64 with approximately 2 GB RAM and one 20 GB root disk (the earlier t3.micro request is superseded by observed hardware). Node 24, Caddy, FFmpeg and 2 GB swap installed. Same-origin EC2 serves both frontend and API; Vercel is no longer the production host. DNS still points to Vercel and needs A records for `www` and `@` to `13.49.134.103`.

Automation: GitHub Actions tests/builds main and publishes an allowlisted release; EC2 polls public releases every two minutes, checks checksum, installs dependencies as msapp, restarts and checks revision health, with rollback. Secrets/data stay in `/opt/marketing-studio/shared`; neither enters GitHub releases. First release, service startup and live HTTPS smoke are pending. 33 backend tests previously passed; final regression rerun in progress. CPU timeline-v1 export and two-account live smoke remain gates. See docs/DEPLOY.md.

---

# Active handoff — Multi-user isolation + same-origin/R2 fixes (2026-09-14)

Owner GO: fix deployment, media memory/egress and cross-user data access. Implemented Express SPA serving, private GET/HEAD + owner checks, Studio source ownership, audio clone/dictionary ownership, browser-bound OAuth state, async error handling, multipart quota ordering, MCP metering, and R2 authorised redirects with streaming legacy fallback. Artifact key manifests persist on avatar/identity/audio payloads; CPU outputs and Studio uploads use existing R2 keys. Local cache is retained through migration; no claim of scratch-only disk or a 1 GB load test.

**Database hardening applied by owner and verified live:** all 12 tables deny anon access and allow the backend service role; usage RPC verified. New SQL: `supabase/migrations/20260914160000_tenant_hardening.sql`. Direct SQL password failed, but REST works. Production checks require this migration before serving. **33 backend tests passed.** Details, migration commands, verification and remaining deployment checks: [SECURITY-HARDENING.md](SECURITY-HARDENING.md). Do not automatically assign legacy anonymous data to a user. No paid generation or worker/server deployment.

---

# Status — 2026-09-14

## Hosting decided — 2026-09-14

Owner scope: **one month only**, new AWS account with **$100 credit**. Lock: **one AWS Lightsail box ($5/mo, 1 GB) serving the API and the built SPA from one origin** — not Vercel + split backend. Runbook: [DEPLOY.md](DEPLOY.md).

Forced by code, not preference: the frontend calls relative `/api/…` with bare `fetch()` (`apps/frontend/src/auth.ts:13`, `studio.ts:53`), which defaults to `credentials: "same-origin"`, and the session cookie is `SameSite=Lax` with no `Domain` (`google-auth.ts:260`). A split-origin deploy logs users in and then reads as logged out. Also `apps/frontend/vercel.json` has **no `/api` rewrite** — it only keeps `/api/` out of the SPA fallback, so nothing would serve the API on Vercel. One required code change: `express.static(apps/frontend/dist)` + SPA fallback registered **last** and excluding `/api/`, `/mcp/`, `/health`.

Rejected with reasons: RunPod CPU pod (~$21/mo, and the pod-id proxy URL changes on rebuild, breaking the Google redirect + SwichNow callback); EC2 (~$21/mo, mostly the $0.005/hr public-IPv4 charge); Vercel rewrite proxy (17 MB media responses exceed its limits); any sleeping free tier (survivable — `index.ts:785-789` resumes all five job types on boot — but no persistent disk). Oracle Always Free is the better long-term answer if this outlives the month.

Sizing note: the backend does **no** video encoding. All five heavy encoders in `ffmpeg-local.ts` (`trimVideoSegment`, `burnTexts`, `mixAudioBeds`, `makeStillVideo`, `makeBlackVideo`) have **zero callers** — export is cloud-only (`studio-render.ts:135`). Remaining ffmpeg use is `ffprobe`, an audio-only mp3 transcode, a `-c:v copy` mux and one-frame posters. Do not size a host for libx264.

**Teardown is part of the scope:** delete the instance *and* release the static IP (unattached IPs bill).

## Artifacts → R2 — spec 24 — 2026-09-14

Spec written, not implemented: [../spec/24-r2-artifacts.md](../spec/24-r2-artifacts.md). Nine of thirteen media handlers `readFileSync` then `res.send`, buffering whole files (a swapped clip is ~17 MB) — an OOM risk on 1 GB. Target: `r2Put` on produce, key on the row, **302 to a 5-minute presigned URL** on read; ownership check before presigning. R2 egress is $0, so this removes the media bill and makes the host disposable. Easiest first win: `swap-runner.ts:182-185` already has the worker's `output_key` and needlessly `r2Get`s + writes a local copy. Needs `@aws-sdk/s3-request-presigner`; no new env names.

## Supabase multi-user — 2026-09-14

Code wired: Google login upserts profiles/sessions; stores async + `owner_email`; PostgREST client in `apps/backend/src/db.ts`; Prisma schema + SQL migration in-repo. Billing/projects tests pass on file fallback. **Schema applied** (owner SQL Editor 2026-09-14): all 11 tables REST-OK; profile upsert smoke passed. Env catalog: [ENV.md](ENV.md). Neon/Supabase are Postgres only — Express is hosted separately. **Superseded 2026-09-14:** that host is now one AWS Lightsail box serving API + SPA on one origin, not Railway/Render. See § Hosting decided and [DEPLOY.md](DEPLOY.md).

## READMEs — 2026-09-14

All four repo READMEs rewritten reviewer-facing for the **8x assignment**, one structure each: role → architecture → where each job runs → design decisions → API → setup/build → deploy → env (names only) → troubleshooting → security → known gaps → docs index. Root [README.md](../README.md) is the entry point and cross-links the three worker repos; each worker README links back to `sixeyes` and to its two siblings. **Docs only — no code, no spec, no lock changed.** Facts sourced from CONTEXT / STATUS / RUNPOD / MODAL / COST / spec and the handlers themselves; nothing invented.

Security sweep same pass: no credential in any tracked file or git history in any of the four repos; `.env` never committed. Endpoint ids kept (not secrets, useless without `RUNPOD_API_KEY`); every example reads the key from the environment. Open items flagged in the READMEs: rotate the Google OAuth client secret sitting as `client_secret_*.json` in the parent folder (gitignored, never committed), rotate the RunPod key that was once pasted in chat, and raise the worker `runpod` SDK pins to `>=1.10.1` (krea/qwen say `>=1.7.0`, CPU pins `1.7.13` — inside the bad 1.7.11–1.10.0 range).

Capture: Cursor and Codex desktop verified. Two desktop canary pairs are saved (first recovered, second automatically exported); persistent user service active. Internal review sessions excluded. See [CAPTURE-TEST.md](../CAPTURE-TEST.md). No CLI required; no product changes.

## Multi-user store await + owner scope — 2026-09-14

Backend store APIs are async (Promises). Call sites await them. `app.use(attachUser)` runs early so `currentUser(req)` works. User-facing list/get pass `currentUser(req)?.email`; creates set `owner_email` (or nest under project owner). Internal runners still `get*(id)` without owner. Mutate routes 404 when ownership miss.

## UI polish — 2026-09-14

Owner-approved film board redesign and shared visual consistency shipped. Four steps and navy topic workspace use the SVG logo; Your films stays below. Responsive nav, balanced Audio/Avatar columns, restored MCP cards, lime focus, reduced motion and Lightbox keyboard focus.

**Compact desks (owner 2026-09-14):** Avatar and MCP use 16px html (same idea as Mix). Script and Cast/scenes are denser — shorter narration fields, tighter scene rows, smaller cast shot tiles. Topic, shelf, Mix, and Audio stay as they were. See CONTEXT top.

## Pricing + SwichNow — 2026-09-14

Owner-approved Free / Pro / Premium pricing shipped. Tiers: Free $0 (3 avatars, 10 image recreations, 3 videos, 20 documentaries, 6 req/min), Pro $20/mo (×10, 30 req/min, PKR 5,600), Premium $150/mo (×100, 60 req/min, PKR 42,000). Constants in `apps/backend/src/plans.ts`. SwichNow hosted checkout (Landing Page PWA, PKR) with HMAC callback at `GET /api/webhooks/swich`; success grants the tier for 30 days. Checkout needs a mobile number (Swich requirement). Quota/rate-limit 429s on generation routes; GET/polling never throttled. `/pricing` page with usage bars; legal pages `/terms`, `/refund`, `/delivery`, `/cancellation` (copy adapted from `payment-gateway/Policies.pdf`). Recurring auto-debit not wired (30-day grants). Spec: [../spec/19-credits-swichnow.md](../spec/19-credits-swichnow.md). Tests: `apps/backend/billing.test.ts`.

## Aim

Marketing Studio (`marketingstudioie.site`): Higgsfield-style generative-media SaaS. **MVP** follows the reference product / `docs/sources/`. **Destination** is [higgsfield.ai](https://higgsfield.ai/). Extra feature chosen: **Audio studio** (spec 21). Login shipped; SwichNow pricing shipped; Stitch UI + Supabase last.

Complete guide: [spec/README.md](../spec/README.md). Lock: [CONTEXT.md](../CONTEXT.md). Env names: [ENV.md](ENV.md).

`.env` has HF, R2, RunPod, ai33pro, Modal tokens (`farhansaleem-342-g`). **OpenRouter key replaced** (owner 2026-09-13). Google login keys filled. SwichNow keys filled (`SWICHNOW_API_KEY` clientId, `SWICHNOW_SECRET` HMAC secret). Supabase URL + anon/service JWTs + `DATABASE_URL`/`DIRECT_URL` filled (pooler); **SQL migration not applied yet**. Never commit `.env`.

## Build order

| Phase | What | Status |
| --- | --- | --- |
| A | RunPod **Krea** T2I + **Qwen Edit** I2I | **Set** (`i3fvrhucaici89`, `ko6zewns6wj3mj`, EU-RO-1) |
| B | RunPod CPU **FaceFusion** + **ffmpeg** | Endpoint `rydclpv4ta6u4p`. **Still swap verified** on Images Templates. **Video swap verified** on Video Templates (15s handheld + `avatar.jpeg`, job `1fab1e69`, **133.7s**). Library **delete** shipped. **Stitch wired** from `/studio` export (product smoke pending first Export). |
| C | Modal **LTX-2.5** video (**$25** cap) | App **deployed** on **H200** (no offload, 20 steps). Fast 5s smoke **72s**. H100 offload path is retired (1233s). |
| D | Express MVP. Avatar, Audio, templates, **Projects documentary** (spec 22-brief). No login. | **Landing** is `/` (Stitch Higgsfield landing). **Projects** is `/projects`. Script → Pexels cast → same-id Studio. Export waits on CPU timeline-v1 deploy. Audio `/audio`. Avatar default **FLUX.2 Klein 4B**. Muse geo-blocked. Costs: [COST.md](COST.md). |
| E | Stitch UI, login, Supabase, SwichNow | **Login shipped.** **Pricing + SwichNow shipped.** **Supabase multi-user code shipped** (SQL apply pending in dashboard). Left: run migration SQL, Stitch polish, recurring auto-debit, host Express. |

Images are RunPod, not Modal. Modal is video only.

**Owner now (2026-09-14):** New film has **How long** — 30 / 45 / **60** / 90 seconds (90s hard cap). Prompt boxes are guarded (topic, script, audio, overlay). MCP `create_documentary` accepts `duration_sec`. `.agent-logs/` stays **in git** (8x assignment). The RunPod key inside one dump is **redacted**. Rotate that RunPod key. Product type is **24px** root (was 20). Navbar is **under the page heading** (14px items, 64px bar). No horizontal page scroll. Page heads are **centered** with space under the bar. Documentaries: four cards are **step nav**. Topic / story / cast / mix render in a **full-width panel** under the cards (Topic navy, readable cream type). Films stay below. Headings and body on `/projects` are larger — do not ship 11–14px copy. Cover stills (no black bars). Short stock queries are padded, not a dead script. Avatar desk: large model cards + tags; empty state says create an avatar first. Audio is the same 50/50 left form / right result. Lightbox close is lime, not dim ink. **MCPs is live** — `/mcp` setup + `POST /mcp` JSON-RPC (spec 23). Tools: films, looks, identities, library, async generate. Optional `MCP_TOKEN`. Library 4-col. Avatars first. FaceFusion wrap. **Google login shipped (2026-09-14, owner go):** every page stays **public for browsing** (all `GET /api/*` open); **Create / Generate asks Google to authorize** (`confirm` + redirect, `ensureAuthed` in TemplateStudio, Avatar, Projects, Audio). Backend: non-GET `/api` and all `/mcp` guarded (`requireAuth`), endpoints `/api/auth/login|callback|me|logout` in `apps/backend/src/google-auth.ts`, 7-day HttpOnly cookie, sessions **persisted to disk** (`data/auth-sessions.json`) so restarts don't log everyone out. `FRONTEND_URL` + `GOOGLE_CLIENT_*` filled in `.env`, redirect `https://www.marketingstudioie.site/callback` (add `http://localhost:5173/callback` in the Google console for local testing). Logout in navbar badge / Sign in button when logged out. `apps/frontend/vercel.json` rewrites `/callback` + SPA routes to `index.html` (filesystem first, `/api` + `/mcp` untouched) — must live in the Vercel project root. `/api` still needs a route to the backend host on Vercel before login completes live.

**Owner (2026-09-13):** Designing landing in Stitch (no code from Cursor). Copy lock: headline **Imagine it. Then be in it.** Tagline **Your Imagination Engine**. CTA **Start creating**. Wall + Remix only — [spec/16](../spec/16-frontend-overhaul.md). OpenRouter key **works**. Avatar default **FLUX.2 Klein 4B**. Krea 2 Medium Turbo off the picker. Muse region-blocked. Qwen still `throttled` — do not generate. Do not resubmit a stuck Seedream task. Do not start LTX generate / login. Video studio Export uses CPU `op=stitch` (not GPU). **Effects** (`/effects`): grouped packs (Incline, Stop World, Clones, …). FaceFusion Recreate + saved avatar. Owner scrape lock 2026-09-14.

**Audio studio (2026-09-13, owner go):** Higgsfield-like tab at `/audio` plus extra OpenSpeaker tools. **Library UX (owner 2026-09-13):** CapCut-style bin — cover preview, duration, **+** to use. Voices still play `preview_url` (0 credits). SFX/Suno have no vendor preview catalog. Spec: [../spec/21-audio-studio.md](../spec/21-audio-studio.md).

**LTX lock:** I2V animates a still that already is the shot. A 30s YouMind brief on a studio portrait does **not** become a vlog. See CONTEXT § LTX job.

**Handoff:** [CONTEXT.md](../CONTEXT.md) top section. Modal: [MODAL.md](MODAL.md). Video studio: [../spec/22-video-studio.md](../spec/22-video-studio.md). Project list: **Edit / Rename / Delete**.

## Do not

Invent another extra feature (Audio studio already shipped). Spend GPU on curiosity generates. Use blocking HTTP generation. Put FaceFusion/ffmpeg on a GPU. Put Krea/Qwen on the Modal $25. H100 LTX offload. Claim lip-sync on Translate.

Capture observation (2026-09-13): one Codex canary prompt now exists (session `01a09a27`, `gpt-5.1-codex-max`), but no response at inspection. Two complete session pairs and desktop capture remain unverified. See CAPTURE-TEST.md.

Seedream (2026-09-13): task `8235f308-…` stayed `doing` with no % / no URL / 986 credits. Restart now **polls that id** (a mid-fix crash marked the job FAILED; reopened the same task, no new charge). Details: [COST.md](COST.md).

## Projects documentary (2026-09-13)

**App shipped.** One project owns script → 2–3 Pexels picks → same-id Studio. Nav **Projects** (`/` and `/projects`). Pexels: video search URL is `https://api.pexels.com/videos/search` (photos still `/v1/search`); send a User-Agent or Pexels 403s; video files may be on `player.vimeo.com`. `PEXELS_API_KEY` is in `.env` (never commit). OpenRouter text default `openai/gpt-4o-mini`. Spec: [../spec/22-brief-stock-documentary.md](../spec/22-brief-stock-documentary.md).

**Studio layout:** Mix/Studio fills leftover viewport (nav + compact step rail only). Preview, transport, and timeline stay on one screen. **Start a film** keeps the normal page, shelf, and footer. Hard-refresh Mix if the editor still scrolls under the films list.

**Audio mix:** Play hears Narration on A1. Music/SFX come from the Studio **Audio** bin (completed `/audio` jobs) or an uploaded mp3 — not a stock-music API.

**Export not live:** CPU stitch still needs `scripts/cpu-timeline/` deployed so ping returns `timeline_version: 1`. Do not treat Export as verified. Do not start LTX.
