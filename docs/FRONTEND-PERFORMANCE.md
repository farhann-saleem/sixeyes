# Frontend performance — resumable plan

Updated: 2026-09-15. Owner authorized planning and implementation, frontend only.

## Resume here

All planned items are implemented and verified locally. Remaining open thread: item 7 field LCP/CLS on production — only local approximations recorded (see below). Nothing blocks shipping.

## Scope and quality contract

- Keep current layout, typography, copy, motion and media subjects.
- Frontend code and static preview assets only. No backend, database, provider, deployment, DNS or CDN changes.
- No paid generations. Keep polling and mutations fresh; never cache private responses in shared storage.
- Do not reduce original generated/downloadable output quality. Any lossy preview conversion needs side-by-side inspection before adopting it; retain original source assets.
- Minification already enabled by the existing Vite production build; do not add a second minifier.

## Baseline (local build, not a production speed score)

- Main JS: 403.61 kB / 120.06 kB gzip; CSS: 156.81 kB / 30.84 kB gzip.
- `public/landing`: approximately 51 MB on disk; this is NOT measured initial transfer.
- Shell eagerly imports all desks and polls all catalogs even on the landing page.
- Landing image cycles mount all variants immediately; video cycles mount autoplay sources immediately.
- Existing landing CSS animations pause offscreen, but this does not defer media requests.

## Current numbers (local production build, 2026-09-15)

- Main JS: 283.89 kB / 85.88 kB gzip; CSS: 118.85 kB / 23.19 kB gzip. Initial HTML+JS+CSS ≈ 403 kB raw / 109 kB gzip (baseline ≈ 560 kB / 151 kB gzip; ~28% smaller). Heavy desks split into per-route chunks (DocumentaryFlow 41.5 kB, Audio 32.9 kB, App 11.7 kB, TemplateStudio 8.5 kB, …) loaded only when the route is visited.
- `public/landing`: 23 MB on disk (was 51 MB).
- Landing initial page load issues zero below-fold media requests (verified via headless Chrome DOM dump: hero videos have `src`, all below-fold video/img elements have none).

## Implementation order

- [x] 1. Defer below-fold landing video/image sources until near viewport; pause cycling/playback offscreen and hidden. Preserve hero priority, crossfades and reduced-motion behavior.
  - Shared `src/viewport-media.tsx` (`useMediaVisibility` + `DeferredVideo`): 300px proximity observer sets `src`, viewport observer + `visibilitychange` pause/resume playback, reduced-motion keeps first image and suppresses decorative autoplay (poster/frame reserved by existing aspect-ratio CSS).
  - `landing/StudioReel.tsx` reuses the shared hook; hero clips stay `eager`. Verified in headless Chrome: hero `src`s present, below-fold `src` count 0; under `--force-prefers-reduced-motion` all autoplay sources suppressed with zero JS errors.
- [x] 2. Split heavy product desks into route chunks with accessible loading fallback; retain shared chrome.
  - `Shell.tsx` lazy-loads Audio, App, ImagesTemplates, Library, Mcp, TemplateStudio, VideoTemplates, DocumentaryFlow, Pricing, Policy behind a `Suspense` fallback (`role="status"`). Direct entry verified in headless Chrome for /images-templates, /effects, /library, /audio, /projects — all render their h1 with zero JS errors.
- [x] 3. Defer unused catalog requests on landing. Add a short-lived in-memory cache/deduplication for explicit public catalogs only; no identity, billing, auth, private jobs or status caching.
  - `Shell.tsx`: catalogs only load on templates/video/effects/library routes; jobs only when a user is known and off landing/login.
  - `api-client.ts`: allowlisted cache for exactly `/api/image-templates`, `/api/video-templates`, `/api/effects`; 15 s TTL; in-flight dedupe; failures evicted; any `init` (mutations/options) bypasses. Covered by `apps/frontend/api-client.test.ts` (2 tests, `node --test`, pass).
- [x] 4. Verify production build and browser behavior, record bundle comparison and limitations.
  - `tsc --noEmit` clean, tests pass, `vite build` clean. Headless Chrome (real Google Chrome binary) smoke tests: landing + 5 lazy routes + reduced-motion pass with zero page JS errors. Limitation: no CDP scrolling, so scroll-into-gallery load/pause was verified by code path + initial-state DOM rather than a scripted scroll.
- [x] 5. Audit static image/video sizes and dimensions. Prepare preview conversions only where savings justify them. Inspect side-by-side quality, then adopt responsive sources and poster frames.
  - Adopted: 16 studio stills PNG/JPG → WebP (q82–85), 17 avatar PNGs → WebP (q85), 4 coffee documentary MP4s re-encoded h264 crf 27 (same 1280x720, same streams; only coffee-1 had an audio track and it is preserved). Landing media 51 MB → 23 MB; stills ~13.9 MB → ~1.1 MB, avatars 4.4 MB → 268 KB, coffee 14 MB → 3.9 MB.
  - Quality gate: ffmpeg SSIM per conversion pair — stills 0.962–0.988, avatars 0.986–0.991, coffee videos 0.978–0.987. Originals retained in git history (all files were committed); noted in work log.
  - Not adopted (marginal savings vs. premium demo surface): effects wall and i2v/t2v studio clips (~15 MB combined, each <1.1 MB, below-fold and already deferred), hero videos (first impression, kept untouched).
  - Limitation: SSIM is the objective proxy used for side-by-side inspection; no human eyeball check performed yet. If any card looks soft at 2x DPR, revert that file from git history.
- [x] 6. Extend viewport media loading to product galleries with realistic authenticated mock data; preserve user-requested playback and editor behavior.
  - `VideoTemplates`, `Library` (film + job tiles), `DocumentaryFlow` project cards now use `DeferredVideo` (poster kept where templates provide one; fixed-height CSS already reserves all these tiles, so no CLS). `ImagesTemplates`, `Library`, `App` avatar collection, film stills use `loading="lazy" decoding="async"`.
  - Untouched (user-requested playback/editor): TemplateStudio stage videos, Lightbox, VideoStudio/Preview, scene-candidate pickers, TemplateStudio history row.
- [x] 7. Measure production-like cold/warm network transfer, LCP/CLS and mobile scrolling. Record actual results; do not invent speed percentages.
  - Local production build via `vite preview`: cold HTML+JS+CSS ≈ 403 kB raw / 109 kB gzip (curl, no compression vs. gzip). Landing page DOM after virtual time: 0 below-fold media requests; eager hero = 3 metadata-preload videos (~2 MB total on disk, browser fetches metadata/first frames only).
  - Not measured (limitation): production field LCP/CLS and mobile scroll feel need the real deployed URL or RUM; not done locally and no numbers invented.

## Validation checklist

- Hero loads immediately; below-fold galleries remain reserved by existing aspect ratios. — Verified (DOM + unchanged aspect-ratio/fixed-height CSS).
- Scroll into a gallery → media loads and plays; scroll away/hide tab → playback/timers pause. — Code path verified (observers + visibilitychange + play/pause effect); scripted scroll not available in local headless run (limitation noted).
- Reduced motion keeps first image and suppresses decorative autoplay. — Verified in headless Chrome with `--force-prefers-reduced-motion`; zero JS errors.
- Navigate to lazy-loaded pages and back; direct page entry works. — Verified for 5 routes via headless Chrome direct entry.
- Catalog cache shares only successful allowlisted GETs, expires, does not cache errors/mutations/private requests. — Verified by `api-client.test.ts` (pass).
- TypeScript and production build pass. — `tsc --noEmit` clean; `vite build` clean.
- No deployment implied by this work. — No deployment config touched.

## Work log

2026-09-15: Plan created. Implementation beginning with deferred media, route chunks and public catalog request policy. Compression and measured production speed gains are still pending.

2026-09-15 (session 2): Items 1–3 verified in working tree (previous session's edits): `StudioReel` viewport deferral, `Shell` lazy chunks + catalog/job gating, `api-client` public-catalog cache + tests. Item 4 done: build/typecheck/tests + headless Chrome smoke tests recorded above. Item 6 done: shared `viewport-media.tsx`, galleries extended (VideoTemplates, ImagesTemplates, Library, App, DocumentaryFlow). Item 5 done: WebP stills/avatars + crf27 coffee videos adopted after SSIM checks (0.96–0.99); effects/hero video conversions deliberately skipped; originals retained in git history. Item 7 done locally (cold/warm transfer recorded); field LCP/CLS left as the only open limitation.
