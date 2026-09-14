# Current handoff — split hosting locked (2026-09-14)

Owner locked **Vercel frontend + EC2 backend**. Frontend API/media URLs now resolve to `https://api.marketingstudioie.site`, every fetch includes credentials, backend credentialed CORS accepts only `https://www.marketingstudioie.site`, and the API binds to localhost behind Caddy. Google OAuth keeps the registered `https://www.marketingstudioie.site/callback`; that page forwards the code/state to the API. The two hostnames are different origins but the same site, so the API's host-only Secure `SameSite=Lax` cookie is sent when frontend fetches use `credentials: include`.

Commit `83614b9e9bd8bc947e69fa63dd04afcbab6c8223` is pushed. GitHub Actions passed, Vercel deployed the frontend, and EC2 installed that exact backend revision. `/health` passes; the API listens only on `127.0.0.1:3001`; Caddy is active on 80/443 and will obtain TLS automatically once DNS resolves. 34 backend tests, both typechecks and the frontend production build pass. DNS is the only current external blocker: friend controls Hostinger and must add `A api -> 13.49.134.103`, keeping existing `www` and `@` Vercel records. Public HTTPS, Google login and two-account live isolation remain unverified until then. Personal `.commandcode`, `.gitignore` and `.agent-logs` changes remain untouched.

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

**Database hardening applied by owner and verified live:** all 12 tables deny anon access and allow the backend service role; usage RPC verified. New SQL: `supabase/migrations/20260914160000_tenant_hardening.sql`. Direct SQL password failed, but REST works. Production checks require this migration before serving. **33 backend tests passed.** Details, migration commands, verification and remaining deployment checks: [docs/SECURITY-HARDENING.md](docs/SECURITY-HARDENING.md). Do not automatically assign legacy anonymous data to a user. No paid generation or worker/server deployment.

---

# Active handoff — Hosting: one AWS box (2026-09-14)

Owner scope: **one month**, new AWS account, **$100 credit**. Lock: **one AWS Lightsail instance ($5/mo, 1 GB Ubuntu) serves the API and the built SPA from a single origin** behind Caddy TLS, systemd `Restart=always`, `DATA_DIR` on the instance disk. Full runbook incl. smoke order and teardown: [docs/DEPLOY.md](docs/DEPLOY.md).

**Same-origin is mandatory, not a preference.** `apps/frontend/src/auth.ts:13` and `studio.ts:53` use bare `fetch()` on relative `/api/…` (defaults to `credentials: "same-origin"`), and the session cookie is `SameSite=Lax` with no `Domain` (`google-auth.ts:260`). Split the origins and login silently reads as logged out. `apps/frontend/vercel.json` also has **no `/api` rewrite**, so Vercel would 404 the API. One code change needed: `express.static(apps/frontend/dist)` + SPA fallback, registered **last**, excluding `/api/`, `/mcp/`, `/health`.

Do not: host the backend on RunPod (~$21/mo and the pod-id proxy URL changes on rebuild, breaking the Google redirect + SwichNow callback); use EC2 at this size (~$21/mo, mostly the $0.005/hr public-IPv4 charge); proxy `/api` through a Vercel rewrite (17 MB media exceeds its limits); size the host for libx264 — the five heavy encoders in `ffmpeg-local.ts` have **zero callers** and export is cloud-only. Keep media on R2, never S3 (R2 egress is $0). **Teardown is in scope:** delete the instance *and* release the static IP.

Spec 24 written (not implemented): [spec/24-r2-artifacts.md](spec/24-r2-artifacts.md) — artifacts to R2, 302 to a 5-min presigned URL, ownership checked before presigning. Removes the `readFileSync`→`send` OOM risk and all backend media egress. Easiest first win: `swap-runner.ts:182-185` already holds the worker's `output_key`.

---

# Active handoff — Supabase multi-user (2026-09-14)

Owner GO: multi-user on Supabase Postgres. Google login stays; upserts `profiles` + `sessions`. Jobs/projects/identities/billing scoped by `owner_email`. Runtime: PostgREST (`apps/backend/src/db.ts`) with `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. File JSON fallback for tests only. Schema SQL applied via SQL Editor (2026-09-14) — 11/11 tables live; profile smoke OK. Host Express separately (not Neon/Supabase Functions) — ~~Railway/Render~~ **superseded same day: one AWS Lightsail box, see the handoff above**. Next: restart backend, Google sign-in, confirm your row in Table Editor → `profiles`.

---

# Active handoff — Repo READMEs (2026-09-14)

Owner GO: proper structured documentation across all four repos, READMEs only, **no code change**, plus a credential sweep. Done: [README.md](README.md) (root, reviewer-facing, 8x assignment framing, architecture, job/host matrix, decisions with the money behind them, async job contract, setup, env names, tests, deploy, security, known gaps, docs index) and one matching README in each of `Krea-2-Turbo`, `Qwen-and-QwenEdit`, `Faceswap-and-FF`. All four cross-link. Detail in [docs/STATUS.md](docs/STATUS.md) § READMEs.

Sweep result: **no credential in any tracked file or git history** in the four repos. Blocked push `7bc7dd73` is dangling locally only — remote `main` has the redacted rewrite. Endpoint ids stay in the READMEs (not secrets); examples read `RUNPOD_API_KEY` from the environment. **Still to do (owner):** rotate the Google OAuth client secret in `client_secret_*.json` sitting in the parent projects folder (gitignored, never committed, but it is a live secret on disk), rotate the RunPod key once pasted in chat, and raise the worker `runpod` pins to `>=1.10.1,<2`.

---

# Active handoff — Pricing tiers + SwichNow (2026-09-14)

Owner GO: Free / **Pro ($20/mo)** / **Premium ($150/mo)** pricing, monthly quotas, per-minute rate limits, and **SwichNow hosted checkout** wired. Policy pages shipped.

- Tiers live in `apps/backend/src/plans.ts` — PKR amounts (Pro **5,600**, Premium **42,000**) are constants there. Everyone defaults to **Free**; a successful Swich payment grants the tier for **30 days**.
- Quotas per month: Free 3 avatars / 10 images / 3 videos / 20 documentaries; Pro ×10; Premium ×100. Rate limits 6 / 30 / 60 requests per minute. Quota/limit → 429 with an upgrade message.
- Counted actions: avatar generate, image/video recreate, library→Studio edit (video), new topic documentary. Audio and export are not quota-metered (not in the owner table).
- Swich flow (doc §5 + §16, hosted PWA GET, PKR): `POST /api/billing/checkout` `{tier, msisdn}` → redirect to Swich. Checkout requires a **mobile number** (Swich makes it mandatory). Callback `GET /api/webhooks/swich` (public) verifies HMAC `SWCallback:...` and grants the tier idempotently. Missing keys → 503.
- UI: `/pricing` (nav + footer) with usage bars; legal pages `/terms`, `/refund`, `/delivery`, `/cancellation` (Policies.pdf copy adapted from Medigify, footer phone `+92-300-4084760`).
- Recurring auto-debit (doc §15) is **not** wired — 30-day one-time grants for now. Spec: [spec/19-credits-swichnow.md](spec/19-credits-swichnow.md). Tests: `apps/backend/billing.test.ts`.

---

# Active handoff — Compact Avatar / MCP / Script / Scenes (2026-09-14)

Owner GO: Reduce type and chrome on **Avatar**, **MCPs**, **02 Script**, and **03 Cast / scenes** so they fit the available screen the way Mix already does. Root stays 24px elsewhere. Avatar/MCP drop to 16px html; Script and Scenes keep cream/navy but smaller headings, fields, scene cards. Topic, Your films, Mix, Audio unchanged. FaceFusion wrap. No login. No generation/export.

---

# Active handoff — Compact Avatar / MCP / Script / Scenes (2026-09-14)

Owner GO: Avatar, MCP, Script, and Cast/Scenes desks use **smaller type and tighter padding** so they fit the available screen (same idea as Mix compact chrome). Scene edit rows and cast cards are denser — shorter narration fields, smaller shot tiles. Topic / Your films stay as-is. FaceFusion wrap. No login.

---

# Active handoff — Studio editor viewport (2026-09-14)

Owner GO: Mix/Studio is a **screen-height workspace**. Preview, transport, and timeline stay on one screen. **Start a film** is unchanged (hero, topic form, Your films, footer). Opening Mix hides the film shelf, page head, and footer; returning to Topic restores them. Compact NLE chrome. FaceFusion wrap. No login. No generation/export.

---

# Active handoff — Shared UI polish + film board (2026-09-14)

Owner GO after inspection: preserve cream/navy/lime and existing copy; implement consistency fixes and redesign the film box, with **Your films below**. `/projects` now has a unified navy board, four-step rail, SVG brand introduction and inset topic controls. Existing script/cast/mix behavior, length choices and prompt guards retained. Shared navbar uses the SVG; wraps before items collide. Audio/Avatar are balanced columns; MCP cards restored, URLs wrap. Consistent focus/depth/press states, reduced-motion support; Lightbox receives/traps/restores keyboard focus. Audio no longer flashes “ffmpeg missing” before health resolves.

Styles: `apps/frontend/src/product-polish.css` loads last to resolve legacy page/global specificity. Logo: `public/brand/marketing-studio-logo.svg`. Frontend typecheck and production build passed; browser checked film desktop/mobile plus Audio/MCP/Avatar. No generation/export/deploy performed. Preserve concurrent Cursor backend edits. CPU timeline-v1 deployment lock still applies.

---

# Active handoff — Film length + prompt guard (2026-09-14)

Owner GO: New documentary has a **How long** control — **30 / 45 / 60 / 90 seconds** (default 60). Timeline hard cap stays 90s. Coffee presets scale to the pick. **Every prompt box** (topic, script, VO, stock query, audio TTS/dialogue/SFX/Suno, studio overlay) is prompt-guarded: hidden chars stripped, jailbreak / role-override refused, topic wrapped as data for OpenRouter. MCP `create_documentary` takes optional `duration_sec`. FaceFusion wrap. No login.

---

# Active handoff — Documentary desk (2026-09-14)

Owner GO: `/projects` keeps the **four cards as a navbar** (01 Topic · 02 Script · 03 Cast · 04 Mix). The **stage below** is full-width (Topic is navy + cream type, not a left sliver). Story / Cast / Mix open there. **Your films** stay under the stage. Film stills crop, no black letterbox. Script no longer fails the whole job on a short stock query — we pad/clip to 3–6 words. FaceFusion wrap. No login.

---

# Active handoff — Avatar desk readable (2026-09-14)

Owner GO: Avatar model picker is **cards with tags**, not a tiny select. Same two-column desk as Audio (form left, result + identities right). If there are **no saved identities**, ask to create an avatar first (looks + library empty). FaceFusion wrap. No login.

---

# Active handoff — MCP desk + contrast (2026-09-14)

Owner GO: Lightbox close (and Download) were cream-page ink on a dark overlay — force lime/navy on `.lightbox`. Stage tags and library badges stay light-on-dark. **MCPs is live** (`/mcp` setup desk + `POST :3001/mcp` JSON-RPC). Tools wrap documentaries, catalogs, identities, library, async `generate_look`. Optional `MCP_TOKEN`. Not 30 models. Not lip-sync. FaceFusion internal. No login.

---

# Active handoff — Library grid + bigger type (2026-09-14)

Owner GO: Product type is larger (**24px** root). Navbar stays **smaller than page headings** (14px items, 20px brand, 64px bar). Page titles + ledes are **centered** with space under the nav. No horizontal page scroll. **Avatars** is first in the nav. **Library** sits on the **right** of the bar (next to the CTA), not in the middle. Library is a **4-column grid** with navy cards and lime buttons — captions must be readable. Effects packs sit **two categories side by side**; video tiles are larger (3-col wall). New documentary has **Also keep this film in Library** (`in_library` on the project). FaceFusion stays wrapped. No login.

---

# Active handoff — Masonry + documentary desk (2026-09-14)

Owner GO: Catalog tiles are **column masonry** (no equal-row black gutters). Caption overlays the still. **Documentaries** is the hero product: `/projects` is a left start-form + right messy film wall, not a centered stack. **Library** is a top-level nav item (`/library`). Compose-panel copy is light-on-navy (`.studio section` was wiping the navy panel). Nav labels stay light on navy. Audio is a cream desk with pill tabs, navy form, result + history on the right. FaceFusion stays wrapped. No login.

---

# Active handoff — Cream / navy product (2026-09-14)

Owner GO: Product pages use the landing **beige + navy** blend (cream canvas, navy cards, lime hairline). Tiles show the **whole still** (no empty 16:10 letterbox). Videos **autoplay** muted. Avatar desk: big preview, Remove/Replace, Gemini-style generate veil. Images dropdown: Create avatar + Text to Image → `/avatar`, Image to Image → `/images-templates`. Audio is a two-column desk. Your Films cards use a real project still/clip, not a purple wash. FaceFusion stays wrapped. No login.

---

# Active handoff — Shared nav + generate wrap (2026-09-14)

Owner GO: **FaceFusion is internal only.** User-facing copy on landing **and** product is prompt generation (text to image / image to image / text to video / image to video). Do not say swap, FaceFusion, Recreate, or “put yourself in the shot.” APIs (`/api/faceswaps`) stay.

**Nav is one chrome on every page** (`Nav.tsx` in `Shell`, including `/`). Dropdowns are grouped panels with a short hint per desk — not a 3-link list. **Audio** lists the shipped studio: Speak (TTS / Dialogue / Clone), Change (Voice Change / Translate — no lip-sync / Isolate / STT), Make (Suno / SFX), Library (voices / dictionary). Images T2I+I2I, Videos T2V+I2V+Effects, Documentaries, Studio, Effects packs, **MCPs coming soon**. Deep-link `/audio?desk=`. Landing dropped its private `hf-header`.

Landing T2V tiles play **documentary studio-upload clips** (`public/landing/docs/`), not effects T2V. Audio cards have logo covers (`public/landing/audio/*.svg`). Hero keeps **MARKETING STUDIO** + **Your Imagination Engine**. **What’s inside** (`#why-us`): documentary block is **Coffee shop morning only** — hero cycle + four scene tiles (dawn / baristas / friends / cups). Copy: type a topic, edit the script, pick shots, mix voice. Do not mix Coastal village / seagulls. Lime squiggle above Looks. No login. No MCP product.

**Projects documentary (still true):** topic → text script → per-scene 2–3 Pexels picks → same-id Studio timeline → RunPod CPU stitch. No GPU B-roll. Spec: [spec/22-brief-stock-documentary.md](spec/22-brief-stock-documentary.md).

---

# Active handoff — Projects documentary (2026-09-13)

Owner GO: **Projects own the whole documentary**: topic → text script → per-scene 2–3 Pexels picks → same-id Studio timeline → RunPod CPU stitch. `/projects` is Projects home; `/projects/:id/script|cast|studio` are steps on **one id**. `/` is the Sentry landing (2026-09-14). No GPU B-roll. Avatar, Audio, templates and Library remain available. Spec: [spec/22-brief-stock-documentary.md](spec/22-brief-stock-documentary.md).

**Shipped (app):** async script (OpenRouter text only), script review, Pexels fetch (official video URL + User-Agent; Vimeo CDN allowed), pick/skip, assemble onto the same project (TTS via existing `/api/audio/tts`), Studio NLE gated until assemble. Uploads scoped by `project_id`. Tests: `apps/backend/{projects,missing-keys,stock}.test.ts`.

**Studio UI (usable, not Stitch polish):** Mix is a screen-height workspace: preview, transport, and timeline stay together. **Start a film** keeps the normal page and film shelf. Global `main.studio` compose padding no longer shrinks the NLE. Hard-refresh Mix if the editor still sits under Your films.

**Audio on the timeline:** Play was silent because preview sought the narration mp3 every frame and stock B-roll was unmuted. Narration is A1 (select the green **Narration** clip, not a picture). Music/SFX: Studio **Audio** bin lists completed jobs from `/audio` (Suno music + sound effects). Drag onto A2. No Pexels-style stock-music catalog — generate in Audio studio or upload an mp3.

**Not live yet:** CPU worker **timeline v1**. Export ping requires `timeline_version: 1`. Artifact: `scripts/cpu-timeline/`. Do not deploy that worker until the owner says go (FaceFusion endpoint is shared). Do not compile the film on the laptop.

Preserve Avatar/Audio work and capture hooks. No login. No LTX/Krea/Qwen for B-roll.

Earlier handoffs follow.

---

# Marketing Studio — context lock

Capture: Cursor and Codex desktop verified. Two desktop canary pairs are saved (first recovered, second automatically exported); persistent user service active. Internal review sessions excluded. See [CAPTURE-TEST.md](CAPTURE-TEST.md). No CLI required; no product changes.

This file is the decisions lock. Other agents start at [AGENTS.md](AGENTS.md). Live snapshot: [docs/STATUS.md](docs/STATUS.md). RunPod lessons (no secrets): [docs/RUNPOD.md](docs/RUNPOD.md). Specs: `spec/`. If something is missing, ask — do not invent.

Knowledge stays in these markdown files. After any decision, update `docs/STATUS.md` and this file in the same turn. Chat is not the source of truth.

Last updated: 2026-09-14 (Pricing tiers + SwichNow shipped: Free/Pro/Premium, monthly quotas, 6/30/60 per-minute rate limits, hosted checkout, `/pricing` + legal pages. Google login live. Payment now wired — recurring auto-debit still open. Earlier: film length 30/45/60/90 on Topic; prompt-guard on all prompt boxes. `.agent-logs/` stays in git for the 8x assignment; live keys in those files are redacted. Values stay in `.env` only. Shared dropdown nav; FaceFusion wrapped; T2V landing uses documentary clips; `/projects` remains Projects home; CPU timeline-v1 export not deployed).

---

## Handoff (read this first — 2026-09-13)

Next: **Video studio is in** (`/studio`, spec 22). Empty CapCut-style timeline. Test with `video-template/` clips. Export = local ffmpeg prepare + RunPod CPU `op=stitch` (still first product smoke). **Audio studio is shipped** (`/audio`, spec 21). Avatar I2I default remains OpenRouter FLUX.2 Klein 4B (`openrouter-flux`). Generate does **not** auto-save. Owner names the result and hits **Save avatar**. OpenRouter Krea 2 Medium Turbo is off the picker. Muse geo-blocked. Qwen/RunPod Krea still **do not generate while throttled**. Seedream still the ai33pro path (do not resubmit a stuck task). Named identities (`GET /api/identities`) pick on image/video/effects (`avatar_id`). **Effects** (`/effects`, spec 02): packs by name (Incline, Stop World, Clones, …), same Recreate + saved-avatar flow. CPU swap, no LTX. LTX generate is **not** this slice. No login. No Supabase. No Stitch. Meter every job. **Do not invent another extra feature.** Do **not** claim lip-sync. Ask if a fact is not below.

**Owner lock (2026-09-13, this chat)**

| Item | Decision |
| --- | --- |
| Supabase / Prisma | **End.** Not required for MVP. Job store can be local until then. |
| Stitch UI | **End.** Polished frontend last, with login/pay. Do not wait on a Stitch export to start MVP. |
| Login | **None for now.** Do not block routes on Google. |
| Video | **LTX I2V 5s** is still the generate lock — **not this slice.** **FaceFusion video swap** (same CPU `op=swap`, `source_key` = clip) **is** this slice. |
| Avatar (now) | Upload one face photo. Locked prompt. **Generate → name → Save avatar** (`POST /api/identities`). Pick that saved avatar on image/video/**effects** (`avatar_id`). Default model: **OpenRouter `black-forest-labs/flux.2-klein-4b`**. Muse geo-blocked. Still **Qwen** and **ai33pro Seedream 4.5** when those vendors work. |
| UX sources | **Both.** `docs/sources/` (reference walkthrough) = **MVP**. [higgsfield.ai](https://higgsfield.ai/) = **destination product**. **Owner override 2026-09-14:** scrape Higgsfield **Effects examples** that FaceFusion can reuse (still person, world moves). Catalog is grouped by effect name on `/effects`. Local `effects-template/`, R2 `templates/effects/`. Do not hotlink their CDN. Morph effects (werewolf, hair, eyes-in) stay out. Landing wall remains spec 17. |
| GPU | Do not burn H200 or Krea while the provider is dummy. |
| This slice | **User video studio** (`/studio`, spec 22): empty NLE, template/library/audio media, RunPod stitch export. **Audio studio** already shipped (spec 21). Function first; **UI polish later.** Test face: `avatar.jpeg`. Do not start LTX generate / Stitch polish / login. **No lip-sync.** |

**Infra that exists**

| Piece | Fact |
| --- | --- |
| Modal workspace | **`farhansaleem-342-g`** (old `chaudaryfarhann` unused). Budget **$25**. Metered today **$3.22** (credits; billed $0). |
| App | **`marketing-studio-ltx` deployed**. Code: `apps/modal/ltx_video.py`. |
| GPU lock | **`["H200", "B200"]`**, `.to("cuda")`, **20 steps**, no sequential offload. H100 80GB **OOM**. Offload was **1233s**. H200 5s smoke **72s**. |
| Volumes | `marketing-studio-ltx-models` (HF cache on disk), `marketing-studio-ltx-outputs`. |
| Secrets | `huggingface`, `r2-credentials`. |
| Warm | `scaledown_window` **10 min**. `modal run` is usually **cold**. Deployed class stays warm if called again within 10 min. |
| Timing | H200 5s I2V measured **72s**. |
| Krea / Qwen | Live EU-RO-1: `i3fvrhucaici89`, `ko6zewns6wj3mj`. |
| CPU | Folder `../ms-runpod-cpu`, GitHub `farhann-saleem/Faceswap-and-FF`, env id `rydclpv4ta6u4p`. Ping **ready** (`facefusion_ready`, `ALLOW_GENERATE`). Still swap **~8s**. Catalog 720p/30s video swap **~456s**. Product wire: `POST /api/faceswaps` (R2 `source_key` = still **or** clip, `target_face_key` = face). `DELETE /api/faceswaps/:id` removes the library row + local files. Stitch **not** smoked. |
| `.env` | HF, R2, RunPod, ai33pro, `MODAL_TOKEN_*` filled. OpenRouter key **valid** (GET `/key` 200, limit $2, remaining $2). Backend must `dotenv` **override** so a stale shell key does not win. Muse generate still **region-blocked** (`This model is not available in your region`, job `c960197e`, ~2s, not billed). Supabase / Google / SwichNow **empty**. |

**Do not**

- H100 + `enable_sequential_cpu_offload` (21 min / $1.46 per 5s).
- R2 `comfy-models/ltx-2.5/` (Comfy distilled, slideshow).
- `Path(__file__).parents[2]` for `.env` on Modal (crash-loop).
- Wikimedia seed URLs (403).
- Distilled LTX sigmas.
- Invent an extra feature. Login last. Payment last.
- Spend GPU on curiosity generates.

**Not built:** Prisma, Stitch UI, landing R2 copy, auth, pay. **Avatar MVP + Audio studio + user video studio exist.** First Qwen smoke (8×8 PNG) FAILED: Comfy 300s timeout, ~5.5 min, ~$0.063. Need a real face photo from the owner.

**Seedream resume (2026-09-13):** if a job already has `provider_job_id`, restart **only polls** `GET /v1/task/:id`. Do not call generate-image again. Persist vendor status/progress/last check so the UI is not just wall-clock. Done images are `metadata.result_images[].imageUrl`. The red chip is RunPod `throttled`, not paywall. Do not Qwen-generate while `throttled > 0`. **Stop** asks ai33pro `POST /v1/task/delete` (or RunPod cancel) and ends our poll. Refund only if the vendor treats it as failed — do not promise credits back.

Qwen already proved on this endpoint (Claude cat-hat ~150s / ~$0.03). Throttle came from later handler timeouts, not from picking RunPod. Owner pasted a RunPod API key in chat — rotate it in the dashboard and put the new value only in `.env`.

Full Modal lock: [docs/MODAL.md](docs/MODAL.md).

---

## Product

- **Name:** Marketing Studio
- **Tagline:** Your Imagination Engine (not “intelligence”)
- **Domain:** `marketingstudioie.site`
- **Landing (Stitch, owner 2026-09-13):** cinema lobby, not a SaaS marketing site. Full lock: [spec/16-frontend-overhaul.md](spec/16-frontend-overhaul.md) § Landing. Headline: **Imagine it. Then be in it.** CTA: **Start creating**. Clip action: **Remix**. No pricing, login, feature grid, model names, or lip-sync on this page.
- **This repo:** `/home/farhann-saleem/Desktop/github/projects/hiigsfiled/marketing-studio-ie`
- **What we are cloning:** Higgsfield-style generative-media SaaS.
- **MVP source:** `docs/sources/` (reference walkthrough + pitfalls). Product surface from those specs.
- **Destination product:** [higgsfield.ai](https://higgsfield.ai/) — match that feel later. Do not copy their assets or hosted stack.

---

## Assignment framing

- Hiring assignment. Owner mentioned **ATX** in kickoff. There is **no written brief in this repo**. Do not ask for an ATX PDF or a YouTube URL again unless the owner volunteers them. **MVP** follows the reference product + `docs/sources/`. **Later** we aim at live Higgsfield.
- Revenue is one-time.
- **“One step further”:** not chosen yet. We will pick an extra feature later. Do not invent one.
- **Feature scope:** all the reference feature set — video, image, face-swap, avatars, Premiere-style templates, landing, credits.

---

## Priority (owner 2026-09-12, order restated same evening)

1. **A — set:** RunPod Krea T2I + Qwen Edit I2I.
2. **B:** RunPod CPU FaceFusion + ffmpeg — **still swap wired** on Images Templates; stitch open.
3. **C — set (infra):** Modal LTX-2.5 on H200. $25 cap.
4. **D0 MVP (owner 2026-09-13):** **Avatar first** — photo → identity portrait (Qwen + ai33pro Seedream 4.5). Express + rough UI. No login / Supabase / Stitch. Then video.
5. Avatar reference sheet — later, owner spec. Do not invent.
6. Extra feature — **Audio studio shipped** (spec 21). Do not invent another. **Stitch UI, login, Supabase, payment last.**

---

## Roles and tools

| Who | Role |
| --- | --- |
| Owner (Farhann) | Product calls, credentials. **Stitch / polished UI at the end.** |
| Cursor (this agent) | Orchestrator. Backend when told. Keeps this file accurate. Does not act on its own. |
| ChatGPT Pro, Devin Pro, Cursor | Extra hands. |

---

## Specs (current working copies)

**Path:** this repo `spec/`. Start at `spec/README.md` — that is the workflow + build-order guide. the reference product **code** is read-only reference.

---

## Stack

**Locked**

- Frontend: owner via **Stitch**.
- Backend: this agent (when owner says go).
- DB: **Supabase** Postgres (Prisma).
- Storage: **Cloudflare R2**.
- Image generation: **RunPod serverless GPU**. **Krea-2-Turbo = text-to-image.** **Qwen Image Edit 2511 = image-to-image.** Two GitHub repos, two endpoints. Public remotes are OK (secrets on the RunPod endpoint, not git). OpenRouter (`meta/muse-image`) = option + fallback. Spec 20.
- Video generation: **Modal LTX-2.5** ($25 cap). Port `youtube/automation/avatar-docs/modal/ltx_video.py`. **H200** (B200 fallback), `.to("cuda")`, 20 steps — measured **72s** for 5s. Volume `marketing-studio-ltx-models`. OpenRouter (`bytedance/seedance-1-5-pro`) = option + fallback. Lock: [docs/MODAL.md](docs/MODAL.md).
- Long-form template stitch: **ffmpeg** on **RunPod serverless CPU** (same CPU worker as FaceFusion). Not the laptop. Not a GPU. Not Modal’s $30.
- Voice: **ai33pro** (owner lock). Same product as **OpenSpeaker** (`ai33.pro` / `openspeaker.ai`). Chatterbox exists in the goldmine but is not the default. Higgsfield-like Audio tab + extra OpenSpeaker tools: [spec/21-audio-studio.md](spec/21-audio-studio.md). **Library** is CapCut-style (cover preview, **+** to use). Voices play catalog **`preview_url`** (0 credits). SFX/Suno have no preview catalog. Mapping: [docs/sources/FROM-HIGGSFIELD-AUDIO.md](docs/sources/FROM-HIGGSFIELD-AUDIO.md). **No video lip-sync.** Do not spend the $30 LTX budget on TTS.
- Hugging Face: owner has **accepted LTX-2.5 and Krea-2 licenses**.
- Goldmine (GPU contracts): `/home/farhann-saleem/Desktop/github/youtube/automation` — [docs/sources/FROM-AUTOMATION.md](docs/sources/FROM-AUTOMATION.md).
- Goldmine (Higgsfield walkthrough): [docs/sources/reference-walkthrough.md](docs/sources/reference-walkthrough.md) → [docs/sources/FROM-REFERENCE-VIDEO.md](docs/sources/FROM-REFERENCE-VIDEO.md). YouTube: https://www.youtube.com/watch?v=LuCXiNxZ1Dw (the reference product). Product UX + pitfalls. **Not** our stack.
- Owner vendor notes: [docs/apis/](docs/apis/README.md) (ai33pro, OpenRouter, CPU worker). Read before wiring.
- Landing wall: Higgsfield catalog via the reference `landing_videos.json`. **Download mp4s once to R2.** Spec 17.
- Payments: **SwichNow**, **PKR**. Spec 19. Wire it last. Sandbox keys exist (paste later; never commit). Pack amounts not set.
- Auth: exists (Google). Details last.
- Domain: `marketingstudioie.site`
- FaceFusion: HTTP `POST /swap` (or queue `job_type=swap`). **Host = RunPod serverless CPU**, min workers 0. Same CPU git worker as ffmpeg stitch. Not a GPU. Spec 02.

**Open / later**

- Extra feature (“one step further”) — **Audio studio shipped** 2026-09-13 (spec 21). Do not invent another.
- OpenRouter **$1.50** — not the image farm. Cheapest paid image model today: **`meta/muse-image` at $0.01/image**. No free image-gen models on OpenRouter. Details below.
- PKR pack prices and SwichNow hosted vs wallets — **when billing is in scope**, not now. Pack prices must be derived from **measured** job cost+time (see metering), not invented.
- CPU stitch (`op=stitch`) — not smoked. Product routes still phase D.

**Architecture that stays**

- Generation is **async** (job + poll).
- Template export reuses baked clips (spec 14).
- **Meter every job.** Store wall-clock time and estimated USD (GPU-seconds × that GPU’s RunPod rate, plus OpenRouter/Modal if used). Credit prices later come from those measurements, not guesses. Spec 19.

---

## RunPod layout (owner 2026-09-12, lessons locked same day)

You have **$100** on RunPod. That money is for **image GPUs**. CPU FaceFusion + ffmpeg is cheap leftover. **Min workers = 0** on every endpoint. Do not park pods. **Max workers = 1** unless the owner says otherwise.

Canonical hard-won notes (read before any Docker / handler / endpoint change):

- `hiigsfiled/ms-runpod-krea/RUNPOD_LESSONS.md`
- `hiigsfiled/ms-runpod-qwen/RUNPOD_LESSONS.md` (same infra issues, plus Qwen graph issues 7–10)

Those files may contain secrets. **Never copy keys, account IDs, or `.env` values into this repo or into chat dumps.**

| Endpoint | Compute | Local folder | GitHub | Job |
| --- | --- | --- | --- | --- |
| Krea-2-Turbo | 24GB GPU | `hiigsfiled/ms-runpod-krea` | `farhann-saleem/Krea-2-Turbo` | **Text → image** |
| Qwen Image Edit 2511 | 24GB / 32GB Pro GPU | `hiigsfiled/ms-runpod-qwen` | `farhann-saleem/Qwen-and-QwenEdit` | **Image → image** |
| FaceFusion + ffmpeg | **CPU serverless** | `hiigsfiled/ms-runpod-cpu` | `farhann-saleem/Faceswap-and-FF` | `op=swap` or `op=stitch` |

**Live endpoints (no keys in this file). Retired: `r59jmvkgw3a5m3`.**

| Name | Endpoint id | DC | Status |
| --- | --- | --- | --- |
| Krea-2-Turbo | `i3fvrhucaici89` | **EU-RO-1** | Live T2I. Warm ~10s, ~$0.002/image. Cold ~90s (Triton). |
| Qwen Image Edit 2511 | `ko6zewns6wj3mj` | **EU-RO-1** | Live I2I (verified 2026-09-12). Cold ~150s, ~$0.03; warm ~$0.01 est. |
| FaceFusion + ffmpeg | `rydclpv4ta6u4p` | (check DC) | Ping + still + 720p video swap **verified 2026-09-13**. Stitch not smoked. Health showed **3 idle** workers — lock is max 1. |

R2 prefixes (bucket `comfy`, reuse — do not re-download from HF):

| Worker | Prefix | Size |
| --- | --- | --- |
| Krea | `comfy-models/krea2-turbo/` | ~18 GB (13.14 + 5.24 + 0.25) |
| Qwen Edit | `comfy-models/qwen-image-edit-2511/` | ~30 GB (20.53 + 9.38 + 0.25) |

**Two image repos, two GPU endpoints.** Do not load Qwen and Krea on one worker — they will not share VRAM. Separate repos so each GitHub **release** rebuilds only that model (RunPod does not redeploy on every push). Docker **build timeout 30 min**, image **≤ 80 GB** — **do not COPY model weights into the image**. Docs: [GitHub integration](https://docs.runpod.io/serverless/workers/github-integration).

### RunPod workflow gates (never skip)

**Build completed ≠ worker ready.** Initializing with empty logs is image pull + volume mount. Wait up to ~15 min. Past that, assume DC mismatch, not “needs another generate.”

1. **Volume DC = endpoint DC, only that DC.** Volume in `EUR-IS-3` while GPUs spawn elsewhere → workers stuck **Initializing**, no logs, silent crash. Select **only** the volume’s datacenter (live: **EU-RO-1**). Never “all datacenters” with a network volume. Attaching storage does **not** remount on a running/paused worker.
2. **Use `/runpod-volume` only if `os.path.ismount`.** An empty `/runpod-volume` dir is not a mount. Without a mount, rootfs is ~5 GB → `Errno 28` / `free_gb ≈ 5`. Ping must show `volume_mounted: true` and `free_gb` **>> model size** (Krea ≳ 22 GB free, Qwen ≳ 35 GB). Do not “fix” this with a huge container disk — wiped on scale-to-zero.
3. **Health before ping; ping before generate.** `GET /v2/{id}/health` does not start a GPU. Ping **does** wake a worker. If `throttled > 0`, **stop**. Do not spam jobs.
4. **Generate via `/run` + poll `/status/{jobId}`**, not `/runsync`. Cold start (weight pull + Comfy + Triton) exceeds runsync. First-run execution timeout **600s**.
5. **After any image rebuild, volume attach, or DC change:** purge queue (`POST /v2/{id}/purge-queue`), idle-out or stop old workers, confirm the **worker id changed**. Running workers keep the old image until they die. FlashBoot pause does **not** pick up a new image or a newly attached volume.
6. **Throttled after crashes is account-level.** It survives endpoint deletion. Fix the crash first, new endpoint, purge queue, wait 10–15 min. Never retry-loop a crashing handler.

### Docker / Comfy lock (Krea, Qwen, any Triton worker)

- Base: `pytorch/pytorch:2.7.0-cuda12.8-cudnn9-devel` (**not** 2.6.0). ComfyUI v0.35.x `list[int]` hints break `torch.library.infer_schema` on 2.6.
- ComfyUI: `git clone --branch v0.35.1 --depth 1 https://github.com/Comfy-Org/ComfyUI.git` — **pin a tag**, never HEAD. Canonical org is `Comfy-Org`, not `comfyanonymous`.
- Install `gcc g++ build-essential` and `ENV CC=gcc CXX=g++`. Triton JIT needs gcc; runtime/devel images do not guarantee it.
- `pip install 'runpod>=1.10.1,<2'` (1.7.11–1.10.0 corrupts job tracking on network-volume endpoints).
- Heavy init (`ensure_weights()`, `ensure_comfy()`) **before** `runpod.serverless.start()`. Worker stays Initializing longer; warm jobs ~5–10s instead of ~100s. Ping on a ready worker is cheap; a cold ping still pays GPU for init.
- Debug: `print(..., flush=True)` at import/start; try/except on imports; fail the process if `runpod` cannot import.

### Comfy graphs (do not invent)

**Krea T2I:** `UNETLoader` fp8 + `CLIPLoader` `type=krea2` + VAE + `EmptySD3LatentImage` + KSampler **4 steps, cfg 1.0, euler/simple**. Defaults 1280×720.

**Qwen Image Edit 2511** — specialized nodes only. Start from a known-working workflow / `/object_info`; never guess input names:

- `CLIPLoader` type **`qwen_image`** (not `qwen2_5vl`)
- `TextEncodeQwenImageEditPlus` (input `prompt`, plus CLIP + VAE + source image) — **not** `CLIPTextEncode`
- `UNETLoader` → `ModelSamplingAuraFlow(shift=8.0)` → `CFGNorm(strength=1.0)` → KSampler
- `ImageScaleToTotalPixels` requires `resolution_steps` (e.g. `64`)
- Defaults: 1024×1024, **20 steps**, cfg **4.0**; `image_b64` required. Send I2I from Python, not curl (payload too large).

### Endpoint settings checklist

- Network volume in **EU-RO-1**, endpoint Data Centers = **EU-RO-1 only**
- GPU 24GB (Qwen may use 32GB Pro)
- Min 0, max 1
- Idle: **5s** when saving money; **60s+** while iterating on a worker
- FlashBoot **on** (paused = free) — still recycle workers after rebuild/volume/DC changes
- Execution timeout **600s**
- Env on the endpoint only: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_BUCKET` (or `R2_BUCKET_NAME`). Values live in this repo’s `.env` / goldmine `config/.env` — never here.

FaceFusion on CPU: seconds-to-minutes per still, billed per second, scale to zero. Cents, not dollars, if you do not leave a worker idle. **Do not put FaceFusion on an A5000/4090.** GPU swap is faster but it eats the $100 that Qwen/Krea need.

ffmpeg on that same CPU worker: template long-form is **not a video model**. Clips already exist on R2. The worker downloads keys, runs ffmpeg (scale/pad/concat/audio mix — the reference `stitchTimeline`), uploads the mp4. A 3–4 min 720p stitch is typically **under a few minutes of CPU**. Execution timeout **≥ 10 min**. Laptop CPU is out of the path.

If a live demo ever needs GPU FaceFusion: cheapest 8GB+ community GPU, start/stop, cap ~$5. Default stays CPU serverless.

---

## Cloudflare R2 (listed 2026-09-12)

Credentials: this repo `.env` (gitignored) and `youtube/automation/config/.env`. **Never commit or paste keys.** This file names env var keys only.

| Bucket | What’s in it |
| --- | --- |
| `yt-auto-practice` | Empty |
| `comfy` | **~295 GB**, 407 objects |

**Already on `comfy` (reuse — do not re-download):**

| For us | Prefix | Notes |
| --- | --- | --- |
| Krea-2-Turbo | `comfy-models/krea2-turbo/` | ~18 GB. Comfy **fp8** (`krea2_turbo_fp8_scaled.safetensors` + Qwen3-VL 4B encoder + VAE). Not the official `krea-ai/krea-2` `turbo.safetensors`. |
| Qwen Image 2512 | `comfy-models/qwen-image-2512/` | ~30 GB. fp8 unet + Qwen2.5-VL 7B + VAE. |
| Qwen Image Edit 2511 | `comfy-models/qwen-image-edit-2511/` | ~30 GB. Same encoder/VAE family. |
| LTX-2.5 (Comfy) | `comfy-models/ltx-2.5/` | **~70 GB distilled Comfy**. **Do not load on Modal.** Product video is Diffusers on volume `marketing-studio-ltx-models` (**cache already pulled** 2026-09-13). Distilled sigmas freeze clips. |
| Chatterbox | `comfy-models/chatterbox/` + `chatterbox-base/` | TTS. Voice default is still **ai33pro**. |
| Qwen3-VL-30B | `models/qwen3-vl-30b/` | ~50 GB. Not the image worker. |

Also on the bucket (farm leftovers, not Marketing Studio defaults): Hunyuan Foley, ControlFoley, ACE-Step 1.5, MMAudio, Whisper large-v3, OpenVoice v2, `voices/`. **No FaceFusion** weights in R2.

Cheap path: copy `comfy-models/krea2-turbo` and `comfy-models/qwen-image-edit-2511` onto the **EU-RO-1** network volume. Do not pull Hugging Face again. Qwen Image 2512 on R2 is T2I leftover — not the I2I worker.

---

## OpenRouter image prices (live 2026-09-13)

Catalog: `GET https://openrouter.ai/api/v1/images/models` + per-model `/endpoints`. Still **no `:free` image-generation model**. Muse (`$0.01`) is cheapest on paper but **geo-blocked from this IP** — do not retry.

Cheapest **usable** I2I after Muse (all accept `input_references`):

| Model | Listed cost (I2I) | Images per **$1** | On our **$1.50** |
| --- | --- | --- | --- |
| `black-forest-labs/flux.2-klein-4b` | **$0.014 / first megapixel** (~1K) | ~71 | ~107 |
| `krea/krea-2-medium-turbo` | $0.015 T2I / **$0.0175** with 1 ref | **Tried, identity miss — removed from Avatar picker** (job `b46a91d6`). | — |
| `sourceful/riverflow-v2.5-fast` | $0.019 / image (1K) | ~52 | ~78 |
| `qwen/qwen-image-3` | $0.03 output + $0.003 / ref | ~30 | ~45 |
| `bytedance-seed/seedream-5-0-lite` | $0.035 / image | ~28 | ~42 |
| `bytedance-seed/seedream-4.5` | $0.04 / image | 25 | 37 |

Gemini / GPT-image are **per output token**, not a flat fee. Typical 1K Gemini Flash still lands around **~$0.02–$0.04**. Do not pick those to save money.

**Call:** Avatar OpenRouter default is **`flux.2-klein-4b`**. Do not put `krea/krea-2-medium-turbo` back on the picker. Do not invent another id. Do not blow the $1.50 on Seedream/Gemini via OpenRouter. Primary image path is still RunPod (Krea T2I ~$0.002 when not throttled; Qwen I2I ~$0.03 warm).

---

## OpenRouter video prices (live 2026-09-12)

Catalog: `GET https://openrouter.ai/api/v1/videos/models`. **Text-to-video only** (ignored FLUX Video Edit / upscale). No free video models. Cost is almost always **per second**, so shortest + lowest resolution + **no audio** is the floor.

Cheapest **generated clip** (silent, lowest res, shortest duration the model allows):

| Model | Floor rate | Shortest clip | Cost of that clip | Clips / **$1** | On **$1.50** |
| --- | --- | --- | --- | --- | --- |
| **`bytedance/seedance-1-5-pro`** | **$0.01153/sec** 480p, no audio | 4s | **~$0.046** | **~21** | **~32** |
| `x-ai/grok-imagine-video` | $0.05/sec 480p | 1s | $0.05 | 20 | 30 |
| `alibaba/wan-3.0` | $0.0425/sec 480p (15% off list $0.05) | 2s | ~$0.085 | ~12 | ~17 |
| `google/veo-3.1-lite` | $0.03/sec 720p, no audio | 4s | $0.12 | ~8 | ~12 |
| `bytedance/seedance-2.0-mini` | $0.03363/sec 480p | 4s | ~$0.135 | ~7 | ~11 |
| `alibaba/wan-2.6` | $0.04/sec 480p T2V | 5s | $0.20 | 5 | 7 |
| `kwaivgi/kling-v3.0-std` | $0.084/sec | 3s | $0.25 | 4 | 6 |
| `google/veo-3.1` | $0.20/sec no audio | 4s | $0.80 | ~1 | 1 |
| `openai/sora-2-pro` | $0.30/sec 720p | 4s | $1.20 | 0.8 | **1 clip eats most of $1.50** |

Seedance 1.5 Pro tokens: `(height * width * duration * 24) / 1024`, billed $1.20/M without audio. 480p lands at that $0.01153/sec floor.

A 4s 720p/1080p clip with audio is several times more. Kling/Veo/Sora will empty the $1.50 in 1–6 clips.

**Call:** OpenRouter video is only for a **smoke test**. If we spend the $1.50 on video at all: **`bytedance/seedance-1-5-pro`**, 480p, **no audio**, 4 seconds. Product video stays Modal (LTX). Do not use Veo/Sora on this balance.

---

## Operating rules

1. Keep this file and `docs/STATUS.md` accurate. Decisions go into markdown, not only chat.
2. Do not scaffold, copy the reference code, install, commit, or spend credits until the owner says go.
3. Frontend: wait for Stitch. Backend: write only when told.
4. Never commit `.env` or keys. Never paste RunPod/R2 secrets into markdown.
5. If unknown, ask. Do not nag login or payment.
6. After any new dump, update this file and `docs/STATUS.md` before other work.
7. Before any RunPod worker/endpoint change: follow **RunPod workflow gates** and [docs/RUNPOD.md](docs/RUNPOD.md). Do not retry-loop Initializing or throttled workers.

---

## What the locked stack can do (keep in mind)

Jobs we can **compose**. Identity is **FaceFusion after** generate, not “the model knows your face.”

| Job | Engine | Input | Output |
| --- | --- | --- | --- |
| Avatar portrait | Qwen Edit or ai33pro Seedream 4.5 | one face photo + locked prompt | identity still |
| Text → image | Krea (Muse fallback) | prompt | still |
| Image → image | Qwen Edit | one image + prompt | still |
| Image + text → video | LTX-2.5 | **one start frame** + motion prompt | ~5s clip (we measured 72s on H200) |
| Text → video | Seedance 1.5 Pro **fallback only** | prompt | short silent 480p. **Not** default. |
| Face swap | FaceFusion CPU | identity **face photo** + image **or video** | same media, largest face replaced |
| Stitch | ffmpeg CPU | many clips (+ optional audio) | one timeline mp4 |
| Voice | ai33pro | text | speech. Not on the $25 LTX budget. |

**Swap is not “anything.”** It needs a **detectable face** (front-ish). Largest face only. No multi-person tracking. A sheet grid is a bad swap target — **crop one face**. Side/back/tiny/occluded faces fail.

**Useful chains (no new models):**

1. Text → Krea person → **swap your face** → still avatar.
2. Photo → Qwen Edit (pose/clothes) → **swap** → still.
3. That still → LTX (move) → **swap again on the mp4** (LTX often drifts the face).
4. Several clips → ffmpeg stitch (+ ai33pro bed later).

**LTX job (locked 2026-09-13):** **animate a still that already is the shot.** Official I2V: describe **what changes** (camera + one action + audio), not a new world. Goldmine: Krea/Qwen still first, LTX motion second. Our app: one start frame, ~5s, single take. Official product also has T2V / last-frame / multi-shot / Dub-It — **we did not wire those.**

| Use LTX | Do not use LTX |
| --- | --- |
| Slow push / pan / track on a composed still | New location, outfit, or story from a portrait |
| Hair, cloth, wind, fire, product turn | Villagers, gorilla, 8-scene vlog in one prompt |
| One person, one light, ~5s | Identity / casting (that is FaceFusion) |
| Ambience + short quoted line | Exact logos, captions, chaotic physics |

Prompt shape: `shot + one action + camera + Audio: …` (4–8 sentences). Re-describing the photo makes the face drift. Portrait into 16:9 without a real 16:9 still → extra limbs (we saw this).

We did **not** ship: LTX text-only video, LTX keyframes/multi-ref, lipsync-from-audio, native character-sheet identity, upscale.

---

## Reference sheets vs our models (owner asked 2026-09-13)

A **sheet** (grid of poses / costume / angles) is **not** a native “identity bible” on our locked APIs. Closest uses:

| Model | What it actually takes | Sheet? |
| --- | --- | --- |
| **Krea-2-Turbo** | Text → one image | Can **draw** a sheet from a text prompt. Cannot *read* a sheet as identity. |
| **Qwen Image Edit 2511** | **One** `image_b64` + prompt (`TextEncodeQwenImageEditPlus`) | Can **edit** a sheet image, or edit a photo *into* a sheet look. Worker does **not** take a pack of extra ref images today. |
| **FLUX.2 Klein 4B** (`black-forest-labs/flux.2-klein-4b`) | OpenRouter **I2I** via `POST /api/v1/images` + `input_references`. Job `876f7ef5` **COMPLETED** 11.8s / $0.016. Kept the `avatar-full.png` face. | **Default** Avatar fallback. Provider `openrouter-flux`. |
| **Krea 2 Medium Turbo** (`krea/krea-2-medium-turbo`) | Same prompt + `avatar-full.png` as Flux. Job `b46a91d6` **COMPLETED** 12.6s / $0.015. **Did not keep** the source face. | **Removed from Avatar picker** (owner 2026-09-13). Not RunPod Krea-2-Turbo. |
| **Muse** (`meta/muse-image`) | Same `/images` path. ~$0.01. | Geo-blocked from this IP (job `c960197e`). Do not retry. |
| **LTX-2.5** (our app) | **One** start frame + motion prompt → video | Sheet (or a crop) can be the **first frame**. It will animate that picture. It will **not** keep identity across later clips from a sheet the way Seedance `@<image1` or InstantID does. Official LTX product has keyframes/refs; **we did not wire those.** |
| **Seedance 1.5 Pro** (OpenRouter fallback) | T2V, 480p silent | Text (and some hosts allow `@image`). Not our default. 2.5 YouMind prompts are **not** this model. |
| **FaceFusion** | One **face** photo → swap | Use a **face crop** from the sheet, not the whole grid. |

To *make* a sheet: Krea or Qwen Edit (photo → grid). To *use* a sheet as identity everywhere: **not supported as-is**. Options later (owner decides): crop face → FaceFusion; one still → LTX I2V; or add a real multi-ref model (not chosen).

---

## Open questions (short)

1. Extra feature — **Audio studio shipped.** Do not invent another.
2. Avatar **reference-sheet** product rules — owner will specify in the next chat.
3. CPU `op=stitch` not smoked. Endpoint health showed 3 idle workers (lock: max 1).
4. **MVP editor:** **User NLE shipped** at `/studio` (spec 22) — empty project, template clips, trim/split/text/audio, export via RunPod `op=stitch`. Admin template author (specs 04–15 bake/slots) still later. Stitch worker itself was **not smoked** before this slice; first export is the smoke.
5. **MVP UI:** Stitch is last. Who builds the first page (owner rough UI vs Cursor stub vs API-only)?

---

## Current status

- **A set.** **C infra set** (H200 LTX). **B still-swap wired** (Images Templates → FaceFusion). Stitch **wired from `/studio` export** (first product smoke). **Audio studio shipped.** **User video studio shipped** (`/studio`). **Pricing + SwichNow shipped** (Free/Pro/Premium, quotas, rate limits, `/pricing`). **E mostly done** — recurring auto-debit is the open payment item.
- Markdown: [AGENTS.md](AGENTS.md), [docs/STATUS.md](docs/STATUS.md), [docs/apis/](docs/apis/README.md), [docs/sources/](docs/sources/README.md).

Capture observation (2026-09-13): one Codex canary prompt now exists (session `01a09a27`, `gpt-5.1-codex-max`), but no response at inspection. Two complete session pairs and desktop capture remain unverified. See CAPTURE-TEST.md.

Seedream diagnostic (2026-09-13 ~10:09 UTC): existing avatar job remains `doing` at ai33pro (HTTP 200, no progress/output, 986 credits reported), matching local `IN_PROGRESS`. No resubmission or backend restart. Restart recovery can duplicate Seedream jobs; fix before restarting an active paid job. Details: docs/COST.md (COST.md from docs/).
