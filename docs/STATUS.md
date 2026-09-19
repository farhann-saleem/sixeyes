## Comprehensive Audit Implementation & UI/UX Resolution — 2026-09-19

Owner GO:
- **Full Resolution of `WEBSITE_AUDIT.md` & `FULL_APP_AUDIT.md`:**
  - **Visual & Contrast (AUDIT-01, AUDIT-02, APP-CRIT-02, APP-CRIT-04):** Strictly enforced `#150f23` text color on all parrot/lime green buttons and CTAs (`.btn.lime`, `.hf-btn-lime`, pricing cards, MCP endpoint copy, Library empty state, Audio desk submit buttons). Fixed low-contrast hero headlines on documentaries.
  - **Mobile Responsive Navigation & Drawer (AUDIT-03, APP-HIGH-04):** Implemented hamburger toggle (`.nav-hamburger`) and accessible off-canvas drawer (`.nav-drawer`) for viewports < 768px with full menu hierarchy, links, auth state, and CTA.
  - **Documentaries 2-Column Layout Order (AUDIT-04, APP-HIGH-06):** Corrected CSS column ordering (`order: 1` on Topic/Script, `order: 2` on Story setup).
  - **Effects Pack Deep-Links (AUDIT-05):** Menus now link with `?pack=...` query parameters, and `VideoTemplates.tsx` auto-scrolls to the requested pack.
  - **Static Contact Page Ungated (AUDIT-06, APP-HIGH-05):** Removed Google login redirect; guest visitors can freely view support and contact channels.
  - **Model Engine Persistence (AUDIT-07, APP-MED-02):** Selected engine is passed via `?engine=...` URL parameter and preserved on the detail studio pages.
  - **FOUC Prevention in Template Studio (AUDIT-08, APP-MED-04):** Added loading guard before catalog load to eliminate broken media boxes.
  - **Audio Studio in User Library (AUDIT-09, APP-MED-05):** Unified audio generations in `Library.tsx` with dedicated Sound & Music shelf, inline audio preview playback, download action, and total count.
  - **Dedicated 404 Route (AUDIT-10, APP-MED-06):** Added `{ name: "not-found" }` route and styled 404 Not Found page with return-home CTAs.
  - **Non-Blocking Confirmation Modals (AUDIT-11, APP-LOW-02):** Replaced synchronous `window.confirm` with accessible React confirmation modals.
  - **Styled Auth Gate Card for Private Studios (AUDIT-12, APP-LOW-03):** Replaced unstyled text with branded Google sign-in cards in `DocumentaryFlow.tsx` and `VideoStudio.tsx`.
  - **Audio Tabs Horizontal Scroll (AUDIT-13, APP-LOW-04):** Audio desk tabs scroll horizontally on mobile screens instead of wrapping into multi-row stacks.
  - **Context-Aware Navbar CTA (AUDIT-14, APP-LOW-05):** Dynamically adjusts between "Start Creating", "Create Avatar", and "New documentary".
  - **Backend Protocol & Security Hardening (APP-CRIT-01, APP-CRIT-03, APP-HIGH-01, APP-HIGH-03, APP-MED-01, APP-MED-07, APP-LOW-01):**
    - Unblocked MCP JSON-RPC by mounting before `privateApi` and exempting from CSRF/cookie gates.
    - SwichNow webhook supports POST and urlencoded body payloads (`app.all`).
    - Constant-time HMAC verification using `crypto.timingSafeEqual`.
    - Anonymous rate limiting isolated per IP address `anon:${req.ip}`.
    - Project name safely sanitized and bounded with `assertSafePrompt`.
    - Resilient R2 deletion prevents trapped library jobs.
- **Validation:** 39/39 backend tests pass; backend typecheck clean; frontend production build succeeds in 3.36s with zero errors.

## Documentaries Header & 4-Stage Pipeline Consistency Lock — 2026-09-19

Owner GO:
- **Header Naming & Pipeline Consistency:**
  - Header displays kicker `Documentaries` and H1 `Documentary Studio` (avoiding collision with step 4 NLE Video Studio).
  - Lede updated from the 5-step arrow copy with phantom voice step (`topic → director script → generated scene footage → voice → mix`) to match the real 4-step pipeline: `Full AI pipeline: Topic → Director Script → AI Scene Footage → Timeline Mix.`.
- **Step Numbering Desynchronization Resolved:**
  - Script step eyebrow aligned to `02 / SCRIPT` (matching `02 · Script` in `FilmNav`).
  - Shots step eyebrow aligned to `03 / AI SHOTS` (matching `03 · Shots` in `FilmNav`).
- **Duplicate "01 · Topic" Header Eliminated:** Replaced redundant `<p className="kicker">01 · Topic</p><h2>Start a film</h2>` in the right column with clean `<h2>Story setup</h2>` to balance vertical height and fit the screen cleanly.
- **CSS Contrast & Legacy Cleanup:** Added explicit lime color (`#c2ef4e !important`) to `.films-hero .kicker` to eliminate dark purple unreadable contrast; removed legacy single-grid child rules from `documentary.css`.
- **Validation:** 39/39 backend tests pass; frontend builds in 2.88s; 0 TypeScript errors.

## "Your Imagination Engine" (No IE Letters), Supabase Status & Documentary 2-Column Final Lock — 2026-09-19

Owner GO:
- **"Your Imagination Engine" Clean Tagline:** Kept the tagline "Your Imagination Engine" on the landing page hero without the literal "IE" letters or tags (`<div className="hf-hero-brand-lockup"><span className="hf-badge">MARKETING STUDIO</span><span className="hf-hero-tagline">Your Imagination Engine</span></div>`).
- **Supabase Query Status:** Confirmed that no breaking or required queries are needed on Supabase. Optional performance enhancement indexes (`supabase/migrations/20260918170000_performance_indexes.sql`) can be run whenever convenient.
- **Documentaries 2-Column Swapped:**
  - Left column: Dedicated `Topic / Script` prompt workspace with live character counter (`{topic.length}/500`).
  - Right column: `01 · Topic`, `<h2>Start a film</h2>`, description, Story preset dropdown, "How long" duration pills (all 4 options: 30s, 45s, 60s, 90s in one clean row), Story name (`{name.length}/60`), library checkbox, and "New project" primary button.
  - 01/02/03 pipeline text completely removed.
- **Parrot Green Contrast Rule Enforced:** Black text (`#150f23 !important`, `-webkit-text-fill-color: #150f23 !important`) strictly enforced on all parrot green elements.
- **Validation:** 39/39 backend tests pass; frontend builds in ~3.80s; 0 TypeScript errors.

## "Your Imagination Engine" Brand Lockup & Final Master Polish — 2026-09-18

Owner GO:
- **"Your Imagination Engine" Domain Integration:** Added the tagline and domain lockup to the landing hero (`Landing.tsx`) directly explaining `marketingstudioie.site` (`ie` = Imagination Engine). Rendered as an illuminated glass pill beside the `MARKETING STUDIO` brand badge: `<span className="hf-hero-ie-badge"><span className="hf-ie-tag">IE</span> Your Imagination Engine</span>`.
- **Global Navigation Pill:** Added `IE` badge in `Nav.tsx` brand anchor (`<span className="brand-ie-pill" title="marketingstudioie.site: Your Imagination Engine">IE</span>`).
- **Signature Palette Preserved:** Kept the rich midnight navy (`#150f23`), energetic lime green (`#c2ef4e`), and editorial cream (`#f7f5f0`) styling.
- **Documentary 2-Column Workflow & Library Move Verified:** Compact 2-column topic screen, 500-char topic limit, 60-char story name limit, removed bottom shelf from flow, top jump button to library, and dedicated "Documentary Suite: Your Documentaries & Saved Films" shelf in Library.
- **Master Checklist Fully Enforced:** API response caching, Express gzip/brotli compression, database indexing migration, loading skeletons, query cache, input debouncing, zero N+1 queries, zero em dashes (`—`), single `<h1>` hierarchy, SEO metadata, sitemap.xml, robots.txt, llms.txt, and backlink strategy.
- **Validation:** 39/39 backend tests pass; frontend builds cleanly in ~4.29s; 0 TypeScript errors.

## Documentaries 2-Column Layout, Library Relocation & Palette Polish — 2026-09-18

Owner GO:
- **Palette Preserved:** Retained the rich, signature midnight/cream/lime green aesthetic across the marketing landing and app desks.
- **CONNECTED WORKFLOW Removed:** Stripped the orbit badge from `Landing.tsx`.
- **Documentaries 2-Column Form:** Converted topic creation in `DocumentaryFlow.tsx` into a 2-column layout that fits cleanly on desktop viewports:
  - Left column: `01 · Topic` intro, topic prompt with live counter (`{topic.length}/500`), library checkbox, and "New project" primary button.
  - Right column: Preset story selector, "How long" duration pills (30s/60s/90s), and Story name with 60-character limit and counter (`{name.length}/60`).
  - Removed the Marketing Studio logo.
  - Replaced the large bottom `films-shelf` with a top header button `View your films ({projects.length}) →`.
- **Library Relocation:** Added a dedicated section with a prominent heading (`Documentary Suite: Your Documentaries & Saved Films`) in `Library.tsx`.
- **Typography & Scale:** Normalized `html { font-size: 16px; }` and toned down oversized clamp headers.
- **Validation:** 39/39 backend tests pass; frontend builds cleanly in ~3.56s.

## Performance, SEO, and Copywriting Master Checklist Verified — 2026-09-18

Executed all items from `docs/CHECKLIST-2026-09-18.md`:
- **Performance & Architecture:** Mounted Express `compression` middleware, in-memory TTL query caching (`apps/backend/src/cache.ts`) with HTTP `Cache-Control` on public catalog and plans endpoints, database indexing migration (`supabase/migrations/20260918170000_performance_indexes.sql`), upstream Caddy load balancer guide (`docs/LOAD-BALANCER.md`), Supabase port 6543 connection pooler guide (`docs/DATABASE-POOLING.md`), Vite bundle splitting (`vendor-react`, `vendor-analytics`, 58 kB main chunk), loading skeletons (`Skeleton.tsx` across 4 desks), library pagination, search debouncing (`AudioLibrary.tsx`, `VoiceLibrary.tsx`), and re-render optimizations (`memo` on audio clips, `useMemo` on timeline lanes).
- **SEO & Discoverability:** Added `sitemap.xml`, `robots.txt`, and `llms.txt` in `public/`. Added canonical tag, meta tags, preconnect hints, and JSON-LD schema (`Organization`, `WebSite`, `SoftwareApplication`) to `index.html`. Audited document outline (1 semantic `<h1>` per page). Created `docs/BACKLINK-STRATEGY.md`.
- **Copywriting:** Locked copy to Solo Creator / Social Media Creator persona. Locked headline: *"Turn your script into a video you can shape scene by scene."* Supporting copy: *"Choose the footage, add your narration, and refine the timeline in one workspace. Create reusable avatars, images, and audio for your next story."* Zero em dashes (`—`) across all user-facing copy.
- **Validation:** 39/39 backend tests pass; backend typecheck clean; frontend production build succeeds in ~2.36s.

## Owner SQL applied / GitHub push authorized — 2026-09-17

Owner reports running the credit allowance SQL successfully: `plan_credit_limits` and `user_credit_balances`. Audio used/remaining remain NULL pending server-ledger migration. Owner now authorizes pushing the completed pricing, payment feedback, loading, analytics and cache changes to main, which triggers existing CI/deployment.

## Pricing and feedback — 2026-09-17

Free: 1 avatar / 5 images / 3 videos / 10 documentaries / 300 audio credits monthly. Pro/Premium unchanged, RPM 6/30/60. Bulk all-tools copy says coming soon (owner: no backend). Upgrade notice allows up to 24 hours; verified payment still activates immediately, and return UI verifies the order. Loading states, React Vercel Analytics, accurate CPU queue/capacity vs RPM messages, and public pricing cache added. No Supabase change: existing non-audio counters in profiles; audio remains on disk. Local implementation; not deployed. Details: [spec 19](../spec/19-credits-swichnow.md).

# Current handoff — README product landing style (2026-09-15)

Root + three worker READMEs reshaped to match the cursed-speech pattern: centered brand/headline, badges, one-liner why, 3 architecture beats, one sample request, link out to SETUP. Desks / agent handoff links stay in docs (SETUP · ARCHITECTURE · MODELS). Root ships `brand.svg` for the README mark. Docs only — no runtime code.

---

# Current handoff — README docs split + system canvas (2026-09-15)

Docs only (no code). Root [README.md](../README.md) is short (intro + desks + four-repo map). Detail moved to [SETUP.md](SETUP.md), [ARCHITECTURE.md](ARCHITECTURE.md), [MODELS.md](MODELS.md). Interactive system design: [Marketing Studio system design](/home/farhann-saleem/.cursor/projects/home-farhann-saleem-Desktop-github-projects-hiigsfiled-marketing-studio-ie/canvases/marketing-studio-system-design.canvas.tsx). Same README → SETUP / ARCHITECTURE / MODELS pattern applied in sibling workers `ms-runpod-krea`, `ms-runpod-qwen`, `ms-runpod-cpu`. `RUNPOD_LESSONS.md` / app `docs/RUNPOD.md` untouched.

---

# Current handoff — Audio credit cap + public pricing (2026-09-15)

Owner GO: voice/audio was uncapped against vendor spend. Free now has a **500 audio credits / month** cap (1 generate job = 1 credit): TTS, dialogue, clone, voice-change, dub, isolate, STT, SFX, music. Pro **5,000** · Premium **50,000**. Ledger is on-disk `DATA_DIR/audio-usage.json` so production needs **no Supabase migration**. Existing per-minute `rateLimitPost` on `/api/audio` stays. 429 message points to Pricing.

Pricing page is public for signed-out visitors via `GET /api/billing/plans` (already allowlisted). Guests see tiers/quotas; Sign in to upgrade. Signed-in users still use `/api/billing/plan` for usage bars + checkout.

Validation: billing tests 8/8 pass (incl. audio cap); frontend typecheck pass. Deploy the backend revision for the cap to take effect on EC2.

---

# Current handoff — Landing motion only (2026-09-14)

Owner requested animation only, preserving landing copy, layout, colors and assets. Added `landing/useLandingMotion.ts` and `landing/landing-motion.css`, attached via one root ref/import in Landing. Hero elements enter in sequence; section headings, documentary steps, cards and footer columns reveal once on intersection. Existing ambient orbs drift slowly; workflow dots and divider strokes breathe. Refined existing card shimmer, hover lift, CTA press feedback and footer link movement. Existing equalizer now animates transform rather than height (18px fixed bar maximum).

Motion uses opacity/transform, no scroll hijacking or frame-by-frame JS. Offscreen ambient CSS animations and hidden-tab motion pause. Reduced-motion changes cancel entrances and disable decorative CSS movement; keyboard interaction finishes active entrances immediately. Existing video/image cycles unchanged.

Validation: frontend typecheck/build passed; local desktop scroll inspected, motion class/orb animations active and offscreen equalizer paused verified in browser. No deployment. Prior landing edits preserved; no page copy/layout/assets edited in this turn.

---

# Avatar empty-state contrast fix (2026-09-14)

Owner reported “Your cast is waiting” was dim against its light panel. Avatar collection now explicitly sets the heading to dark ink (`#211b2d`) and description to `#443b50` on `#efede8`, overriding inherited light heading styles. Frontend CSS only.

---

# Current handoff — Horizontal avatar creation flow (2026-09-14)

Owner corrected the avatar redesign: neutral dark panels (less green), original headline/copy and the Image-to-image display font, and horizontal **model settings → upload photo → result**. Settings/upload are visible initially; Generate opens the third section with shimmer/sparkles. Controls move with a short transform animation; reduced motion disables it. Existing completed jobs stay in the collection until selected, active jobs reopen the stage. Result supports name/save and **Dismiss result**; saved avatars remain below. Dismiss does not delete data.

**Pending owner choice:** avatar/identity deletion has no existing backend route. Asked whether to authorize the small backend addition for real deletion or retain frontend-only dismissal; no answer yet. Backend unchanged.

Validation: TypeScript and production build passed. Desktop three-section loading state and 390px mobile layout inspected with isolated local mock responses; name/save updated the mock collection. No paid generation, real record mutation or deployment. Temporary browser fixture removed. Files: `apps/frontend/src/App.tsx`, `apps/frontend/src/avatar-studio.css` (imported by main). Prior unrelated edits preserved.

---

# Current handoff — Avatar studio redesign (2026-09-14)

Owner requested a frontend-only premium avatar studio. `/avatar` now has a cream editorial header, navy creation workspace, large reference upload, four existing model radio cards, a dedicated portrait stage, and the saved/unsaved avatar collection below creation. Live jobs show a blurred reference with CSS shimmer and sparkle animation; completed portraits fade in. Reduced-motion rules, keyboard focus, blocked model states, and failed/cancelled notices are included. Gallery selection is disabled during generation so it cannot switch away from the polled job. Existing backend/API contracts unchanged.

Validation: frontend TypeScript and production build passed; local browser desktop and 390px mobile empty states inspected. Signed-out local API requires Google login; real generation, save/rename and animated live job were not exercised against paid providers. No deployment performed. Styles are scoped in `apps/frontend/src/avatar-studio.css`. Existing unrelated working-tree changes preserved.

---

# Current handoff — split hosting live and verified (2026-09-14)

Split hosting is **live**. Hostinger DNS `A api -> 13.49.134.103` is in place; `www`/`@` stay on Vercel. Public `https://api.marketingstudioie.site/health` serves the installed revision; credentialed CORS preflight from the Vercel origin passes; OAuth state-cookie roundtrip, public catalog 200s, R2 media 302s and anonymous 401s on user data are all verified over public HTTPS.

**Updater bug fixed:** the releases API order was not newest-first, so the EC2 updater kept matching the already-installed `83614b9`. `deploy/update-release.py` now sorts candidates by `published_at` desc (server copy patched too), and the two-minute timer auto-installed the newest release end to end. History was rewritten to drop the Cursor co-author line and force-pushed; remote main is `3aa1900bf1…`, EC2 runs that revision. Remaining owner-browser checks: real Google sign-in click-through and two-account isolation. CPU timeline-v1 export stays a separate gate.

---

# Superseded handoff — UI polish: login, avatar dock, footers (2026-09-14)

Cream/navy/lime polish: `/login` (Google only), nav profile dropdown, avatar prompt dock (four real models), column footers, taller nav, video labels strip numeric stems. Split hosting lock unchanged; `api` DNS still pending.

---

# Superseded handoff — split hosting locked (2026-09-14)

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

**Login / avatar dock / footers (owner 2026-09-14):** Dedicated `/login` (Google only, cream card). Nav profile menu (email + sign out; signed-out → login). Avatar compose is a horizontal prompt dock (photo + 4 real models + Generate); Muse stays selectable. Product + landing footers use brand / Start creating / Product / Legal columns. Nav slightly taller. Video template labels strip `\d+_[a-z0-9]+_` prefixes like images.

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
