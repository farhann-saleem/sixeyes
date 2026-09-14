# 00 — Video generation (Modal LTX-2.5)

**Phase C, then D.** Not the first thing we build. Images (Krea / Qwen) are already live on RunPod. **Now** is FaceFusion + ffmpeg (spec 02, phase B). This file is the **video product** we wire **after** that, on Modal, then into the Express API when the owner says go.

**Login is last.** Do not treat this as an auth slice. **MVP (2026-09-13):** no auth, no Supabase, no Stitch. Express + dummy provider OK. 5s clips. Video controls stay. Editing environment in scope — feature list not specified in this file.

Product: **Marketing Studio — Your Imagination Engine** (`marketingstudioie.site`). Pixovid is a reference for screens and APIs, not something we already shipped.

---

## What users get

Generate a **video** from a prompt, with duration, resolution, aspect ratio, start frame, end frame, and reference frames (optional where optional). Library of the user’s videos.

Model: **Modal LTX-2.5** (`Lightricks/LTX-2.5-Diffusers`, I2V + T2V). Port `youtube/automation/avatar-docs/modal/ltx_video.py`. New Modal app name — do not clobber `avatar-ltx`. Workspace budget **$30**. OpenRouter `bytedance/seedance-1-5-pro` (480p, no audio) is option/fallback only (spec 20).

---

## Services (when we wire the app — phase D)

- **Frontend** — **Stitch at the end.** MVP UI path not chosen (ask). Cursor does not restyle to Higgsfield unless asked (spec 16).
- **Backend** — TypeScript + Express. CRUD + async jobs.
- **Postgres + Prisma** — `packages/db`. Production **Supabase**.
- **Object store** — **Cloudflare R2**. All uploads and outputs.
- **Video** — Modal LTX-2.5. Provider interface: `submitJob` / `pollJob` / `downloadResult`.
- FaceFusion + ffmpeg are **phase B** (CPU worker), not this file’s infra.

`.env.example` lists names. Secrets stay in `.env`.

---

## Product UI (Stitch) — when we build the video page

- Video tab: text-to-video controls + library.
- No pricing UI here (spec 19 is last).
- Sign-in in the chrome can exist as a stub; **do not block video work on Google polish.**

## Backend (Cursor, when told)

- Video generation **async**. `POST /api/videos` stores inputs on R2, creates `IN_PROGRESS`, enqueues Modal, returns the row. Client polls `GET /api/videos/:id`. Never block HTTP until the mp4 exists.
- Dump frames and finished videos to R2. Return playable URLs.
- Google auth exists in the plan; **login last.**

## Do not invent

- Checkout.
- Extra “one step further” feature.
- A second video farm. LTX is the default. Duration/model filter is spec 09, from **what LTX actually supports**, not a hardcoded Pixovid list unless the provider matches.
