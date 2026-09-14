# Marketing Studio — Your Imagination Engine

A Higgsfield-style generative-media SaaS: type a topic and get a narrated film; upload one face and get an
avatar you can reuse across stills, clips and effect packs. Domain: `marketingstudioie.site`.

**This repository is the 8x hiring assignment.** It is the application tier. The models it drives run in three
separate worker repositories and one Modal app, documented in [The four repositories](#the-four-repositories).

| | |
| --- | --- |
| **Assignment** | 8x — build a generative-media product end to end, self-hosting the models where it makes sense |
| **Clone target** | Higgsfield's product surface (Pixovid's walkthrough was the MVP reference, not its hosted stack) |
| **This repo** | `farhann-saleem/sixeyes` — Express + TypeScript backend, React + Vite frontend, Modal LTX app |
| **Language split** | Backend/frontend TypeScript. GPU/CPU workers Python. No Python in the web tier. |
| **State** | Phases A–E shipped except Stitch UI polish, Supabase, and recurring auto-debit |

---

## Contents

- [What it does](#what-it-does)
- [Architecture](#architecture)
- [The four repositories](#the-four-repositories)
- [Where each job runs](#where-each-job-runs)
- [Design decisions and why](#design-decisions-and-why)
- [The async job contract](#the-async-job-contract)
- [Repository layout](#repository-layout)
- [Setup](#setup)
- [Running it](#running-it)
- [Environment variables](#environment-variables)
- [Tests](#tests)
- [Deployment](#deployment)
- [Security posture](#security-posture)
- [Known gaps](#known-gaps)
- [Documentation index](#documentation-index)

---

## What it does

Every page is public to browse. **Create / Generate** prompts for Google sign-in, then meters the job against
the caller's plan.

| Route | Desk | What happens |
| --- | --- | --- |
| `/` | Landing | Cinema-lobby wall of real generated clips. Copy lock: *Imagine it. Then be in it.* |
| `/avatar` | Avatars | Upload one face photo → locked prompt → identity portrait → name it → reusable identity |
| `/images-templates` | Images | Pick a catalog still, add a face or a saved identity, get the rewritten still beside the original |
| `/video-templates` | Videos | Same flow on catalog clips (720p video swap) |
| `/effects` | Effects | Baked motion packs grouped by name — Incline, Stop World, Clones, Vanish, Act Natural, … |
| `/projects` | Documentaries | **The hero product.** Topic → AI script → 2–3 Pexels picks per scene → narrated timeline → stitched film |
| `/projects/:id/{script,cast,studio}` | Film steps | One project id owns script, cast and the Mix workspace |
| `/audio` | Audio studio | Speak (TTS / Dialogue / Clone), Change (Voice change / Translate / Isolate / STT), Make (Suno / SFX), Library |
| `/library` | Library | 4-column grid of everything generated; delete removes the row and the files |
| `/mcp` | MCP | JSON-RPC connector so Cursor/Claude can drive the studio's own tools |
| `/pricing` | Pricing | Free / Pro $20 / Premium $150, usage bars, SwichNow hosted checkout |
| `/terms` `/refund` `/delivery` `/cancellation` | Legal | Policy pages required by the payment gateway |

The documentary desk is the interesting one: a single project id carries a topic through script generation,
per-scene stock selection, narration, and a CapCut-style timeline, and the final compile happens on a
**CPU** worker — not a GPU — because concatenating clips is an ffmpeg problem, not a diffusion problem.

---

## Architecture

```
                        ┌──────────────────────────────────────┐
                        │  apps/frontend  React 19 + Vite      │
                        │  public browse · auth-gated generate │
                        └──────────────────┬───────────────────┘
                                           │ fetch /api/*
                        ┌──────────────────▼───────────────────┐
                        │  apps/backend  Express + TypeScript  │
                        │                                      │
                        │  job store (disk)  ·  quota + rate   │
                        │  cost ledger       ·  prompt guard   │
                        │  Google OAuth      ·  MCP JSON-RPC   │
                        └───┬────────┬────────┬────────┬───────┘
                            │        │        │        │
        ┌───────────────────┘        │        │        └──────────────────┐
        │                            │        │                           │
┌───────▼────────┐   ┌───────────────▼──┐  ┌──▼──────────────┐   ┌────────▼────────┐
│ RunPod GPU     │   │ RunPod GPU       │  │ RunPod CPU      │   │ Modal H200      │
│ Krea-2-Turbo   │   │ Qwen Edit 2511   │  │ FaceFusion +    │   │ LTX-2.5         │
│ text → image   │   │ image → image    │  │ ffmpeg          │   │ image → video   │
│ ms-runpod-krea │   │ ms-runpod-qwen   │  │ ms-runpod-cpu   │   │ apps/modal/     │
└───────┬────────┘   └──────────┬───────┘  └──┬──────────────┘   └────────┬────────┘
        │                       │             │                           │
        └───────────────────────┴──────┬──────┴───────────────────────────┘
                                       │ object keys only, never bytes
                            ┌──────────▼──────────┐
                            │ Cloudflare R2       │
                            │ weights · media     │
                            └─────────────────────┘

        Third-party APIs: OpenRouter (FLUX.2 Klein 4B, text) · ai33pro (Seedream, voice)
                          Pexels (stock) · SwichNow (PKR checkout) · Google (OAuth)
```

Two rules hold the whole thing together:

1. **Nothing blocks on a model.** HTTP returns a job row immediately; the client polls.
2. **Media moves as R2 object keys.** Workers receive and return keys, never base64 payloads or signed URLs,
   except the two GPU image workers which return a single PNG inline.

---

## The four repositories

All four are public. They are developed as siblings on disk and deployed independently.

| Repo | Folder | Role | README |
| --- | --- | --- | --- |
| [`sixeyes`](https://github.com/farhann-saleem/sixeyes) | `marketing-studio-ie/` | **This one.** Web app, job orchestration, metering, Modal LTX app | you are here |
| [`Krea-2-Turbo`](https://github.com/farhann-saleem/Krea-2-Turbo) | `../ms-runpod-krea/` | RunPod serverless **GPU** — text → image | [README](https://github.com/farhann-saleem/Krea-2-Turbo#readme) |
| [`Qwen-and-QwenEdit`](https://github.com/farhann-saleem/Qwen-and-QwenEdit) | `../ms-runpod-qwen/` | RunPod serverless **GPU** — image → image | [README](https://github.com/farhann-saleem/Qwen-and-QwenEdit#readme) |
| [`Faceswap-and-FF`](https://github.com/farhann-saleem/Faceswap-and-FF) | `../ms-runpod-cpu/` | RunPod serverless **CPU** — face swap + template stitch | [README](https://github.com/farhann-saleem/Faceswap-and-FF#readme) |

Clone them as siblings if you want the layout the docs assume:

```
hiigsfiled/
├── marketing-studio-ie/   # this repo
├── ms-runpod-krea/
├── ms-runpod-qwen/
└── ms-runpod-cpu/
```

The Modal video app is **not** a separate repo — it lives here at `apps/modal/ltx_video.py` because it is a
single deployed file rather than a container image.

---

## Where each job runs

Measured, not estimated. Numbers come from real job rows in the cost ledger; full detail in
[docs/COST.md](docs/COST.md).

| Job | Host | Model | Cold | Warm | Cost |
| --- | --- | --- | --- | --- | --- |
| Text → image | RunPod GPU | Krea-2-Turbo fp8, 4 steps, cfg 1.0 | ~90s (Triton JIT) | ~10s | ~$0.002 |
| Image → image | RunPod GPU | Qwen Image Edit 2511 fp8mixed, 20 steps, cfg 4.0 | ~150s | 10–30s | ~$0.03 |
| Avatar portrait (default) | OpenRouter | FLUX.2 Klein 4B | — | ~12s | ~$0.014–0.016 |
| Avatar portrait (alt) | ai33pro | Seedream 4.5 | — | minutes | 986 vendor credits |
| Image → video | Modal H200 | LTX-2.5 Diffusers, 20 steps | +HF pull | **72s** / 5s clip | ~$0.25 |
| Face swap (still) | RunPod CPU | FaceFusion 3.3.2 `inswapper_128` | model warm on boot | 6–8s | rate unset |
| Face swap (video) | RunPod CPU | same | — | 134s / 15s 720p clip | rate unset |
| Template stitch | RunPod CPU | ffmpeg libx264 | — | scales with length | rate unset |
| Script / topic | OpenRouter | `openai/gpt-4o-mini` | — | seconds | cents |
| Voice, SFX, music | ai33pro | OpenSpeaker / Suno | — | seconds | vendor credits |
| Stock footage | Pexels | — | — | seconds | $0 |

`estimated_usd` is `0` on the CPU worker until `RUNPOD_CPU_USD_PER_HR` is configured. **Zero means
unconfigured, not free.**

---

## Design decisions and why

**Images on RunPod, video on Modal.** RunPod serverless gives a network volume you can park 18–30 GB of fp8
weights on, so an image worker cold-starts from disk instead of Hugging Face. Modal gives H200s, which is what
LTX-2.5 actually needs. Putting the image models on Modal would burn the $25 video budget; putting LTX on
RunPod would mean no H200.

**H200 with no offload, not H100 with offload.** An H100 80GB OOMs on LTX-2.5 at `.to("cuda")`. Enabling
sequential CPU offload fixes the OOM and takes **1233s** for a 5-second clip. An H200 with full weights on
device takes **72s**. The slow path cost $1.46 per clip; the fast path costs ~$0.25. Locked to
`gpu=["H200", "B200"]`, 20 steps, no offload.

**Face swap and stitching on CPU.** FaceFusion is ONNX Runtime; ffmpeg is ffmpeg. Neither benefits from a GPU
enough to justify GPU-hour pricing, and both are the kind of long-running I/O-bound work that would hold a GPU
idle. One CPU endpoint serves both `op=swap` and `op=stitch`.

**Documentary B-roll is stock, not generated.** A 60-second film needs a dozen shots. Generating them would
cost dollars and minutes per film; Pexels returns real footage in seconds for $0. The generative budget goes
where it is visible — the avatar, the effects, the narration.

**Weights live on R2, never in the image.** Docker images stay small and rebuild fast; a `.safetensors` file
never enters git or a layer. Workers pull from R2 to the network volume once, then symlink into ComfyUI's
model tree.

**Heavy init happens before `serverless.start()`.** Starting ComfyUI inside the request handler made every
cold job pay ~90s of VRAM load and Triton compilation *inside* a 300s queue timeout — the first Qwen smoke
test failed that way after 5.5 minutes. Now the worker stays "Initializing" longer and warm jobs are fast.

**Generation is metered from day one.** Every job writes `duration_ms`, `estimated_usd` and vendor
`credit_cost` to a ledger, exposed at `GET /api/costs`. Pack prices are derived from measurements rather than
guessed.

**Login and payment came last.** Browsing stays public; only non-GET `/api` routes and `/mcp` are guarded.
That kept the whole product demoable throughout the build instead of gating it behind auth on day one.

The failures behind these decisions are written down rather than summarised — see
[docs/RUNPOD.md](docs/RUNPOD.md), [docs/MODAL.md](docs/MODAL.md) and the pitfall specs
(06, 12, 13–15, 18). They are deliberately not "cleaned up".

---

## The async job contract

Every generation route follows the same shape. No HTTP request ever waits on a model.

```
POST /api/avatars          → 202-style job row { id, status: "PENDING", provider, created_at }
GET  /api/avatars/:id      → poll: PENDING → IN_PROGRESS (+phase_label) → COMPLETED | FAILED | CANCELLED
GET  /api/avatars/:id/output → the artifact once COMPLETED
POST /api/avatars/:id/cancel → asks the vendor to stop; does not promise a refund
```

The same pattern covers `/api/faceswaps`, `/api/audio/*`, `/api/projects/*` and `/api/studio/*`.

Selected endpoints:

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/health` | liveness; no vendor calls |
| `GET` | `/api/models/avatar` | provider catalog + the locked prompt + live credit quotes |
| `POST` | `/api/avatars` | multipart face photo + `provider` |
| `GET` `POST` `PATCH` | `/api/identities` | named, reusable avatars (`avatar_id` on later jobs) |
| `POST` | `/api/faceswaps` | R2 `source_key` (still **or** clip) + `target_face_key` |
| `GET` | `/api/image-templates` `/api/video-templates` `/api/effects` | catalogs with posters |
| `GET` | `/api/costs` | the metering ledger |
| `POST` | `/api/billing/checkout` | `{tier, msisdn}` → SwichNow hosted checkout (PKR) |
| `GET` | `/api/webhooks/swich` | public; HMAC-verified; grants a tier for 30 days, idempotently |
| `GET` | `/api/auth/login\|callback\|me\|logout` | Google OAuth, 7-day HttpOnly cookie, sessions persisted to disk |
| `POST` | `/mcp` | JSON-RPC tools: films, looks, identities, library, async generate |

Guards applied in order: `requireAuth` on every non-GET `/api` and all of `/mcp` → per-minute rate limit
(6 / 30 / 60 by tier) → monthly quota. Exceeding either returns **429** with an upgrade message. GET and
polling are never throttled. Every prompt field passes through a prompt guard that strips hidden characters
and refuses role-override attempts; user topics are wrapped as data before reaching OpenRouter.

---

## Repository layout

```
apps/backend/            Express + TypeScript. Routes, job store, runners, metering.
  src/index.ts             route table and guard ordering
  src/plans.ts             Free / Pro / Premium tiers, quotas, PKR amounts
  src/runner.ts            avatar job runner
  src/swap-runner.ts       RunPod CPU FaceFusion runner
  src/audio-*.ts           ai33pro / OpenSpeaker audio studio
  src/project-*.ts         documentary: script, stock, workflow
  src/studio-*.ts          timeline model, local ffmpeg prep, cloud render plan
  src/providers/           OpenRouter, ai33pro, RunPod adapters
  src/google-auth.ts       OAuth + persisted sessions
  src/mcp-*.ts             JSON-RPC server and tool definitions
  src/prompt-guard.ts      injection / hidden-character defence
  src/r2.ts  src/media.ts  Cloudflare R2 and local media helpers
  *.test.ts                node test files (see Tests)

apps/frontend/           React 19 + Vite + TypeScript. Path-based routing in Nav.tsx.
  src/landing/             the public wall
  src/projects/            documentary desks (topic, script, cast, mix)
  src/video-studio/        CapCut-style NLE
  src/{App,Audio,Library,Pricing,Mcp}.tsx   desks
  src/product-polish.css   loads last; resolves legacy global specificity

apps/modal/ltx_video.py  Modal app `marketing-studio-ltx` — LTX-2.5 I2V on H200
packages/db/             Prisma + Supabase scaffolding (intentionally unused in the MVP)
scripts/cpu-timeline/    artifact for CPU worker "timeline v1" (not yet deployed)
spec/                    numbered specs: requirements, decisions, and paid-for pitfalls
docs/                    STATUS, ENV, COST, RUNPOD, MODAL, apis/, sources/
{image,video,effects}-template/   local catalog media used for smokes
```

---

## Setup

### Prerequisites

| Tool | Version | Why |
| --- | --- | --- |
| Node.js | 20+ | backend (`tsx`) and frontend (Vite 7) |
| npm | 10+ | workspaces are not used; install per app |
| ffmpeg + ffprobe | any recent | local timeline prep, audio extract/mux |
| Python 3.11 + venv | 3.11 | only for the Modal CLI and `scripts/` |
| Docker | any | only to build the worker images |

Accounts needed to run the whole thing: Cloudflare R2, RunPod, Modal, OpenRouter, ai33pro, Pexels, Google
Cloud (OAuth), SwichNow. The app degrades gracefully — a missing key surfaces as a job error with a retry
action, never a crashed process — so you can run most of it with a subset.

### Install

```bash
git clone https://github.com/farhann-saleem/sixeyes.git marketing-studio-ie
cd marketing-studio-ie

cp .env.example .env      # then fill it — see Environment variables

cd apps/backend  && npm install && cd ../..
cd apps/frontend && npm install && cd ../..
```

For the Modal video app:

```bash
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
modal profile current     # confirm the right workspace before spending GPU
```

---

## Running it

Two processes. Backend on `:3001`, frontend on `:5173`.

```bash
# terminal 1
cd apps/backend && npm run dev       # tsx watch src/index.ts

# terminal 2
cd apps/frontend && npm run dev      # vite
```

Then open `http://localhost:5173`.

```bash
# is the backend alive
curl -s http://localhost:3001/health

# what providers does it think it has
curl -s http://localhost:3001/api/models/avatar

# the metering ledger
curl -s http://localhost:3001/api/costs
```

Notes that will save you time:

- **Restart the backend after editing `.env`.** It loads dotenv with `override` on purpose so a stale shell
  variable cannot beat the file.
- For local Google login, add `http://localhost:5173/callback` as an authorized redirect URI in the Google
  Cloud console. Production uses `https://www.marketingstudioie.site/callback`. Without the local entry,
  login returns 400.
- Before hitting a RunPod worker: check `GET /health` (this does **not** start a GPU), stop if
  `throttled > 0`, send `{"input":{"op":"ping"}}` to wake it, then generate.

---

## Environment variables

Names live in [`.env.example`](.env.example) and are catalogued with notes in [docs/ENV.md](docs/ENV.md).
**Values live only in `.env`, which is gitignored.** Never paste a key into markdown, a commit, or an issue.

| Group | Names | Needed for |
| --- | --- | --- |
| Storage | `R2_ACCOUNT_ID` `R2_ENDPOINT` `R2_ACCESS_KEY` `R2_SECRET_KEY` `R2_BUCKET` | everything that stores media |
| RunPod | `RUNPOD_API_KEY`, Krea / Qwen / CPU endpoint ids, `RUNPOD_CPU_USD_PER_HR` | GPU images, face swap, stitch |
| Modal | `MODAL_TOKEN_ID` `MODAL_TOKEN_SECRET` (or `~/.modal.toml`) | LTX video |
| OpenRouter | `OPENROUTER_API_KEY` `OPENROUTER_BASE_URL` `OPENROUTER_FLUX_MODEL` `OPENROUTER_TEXT_MODEL` `OPENROUTER_IMAGE_MODEL` `OPENROUTER_VIDEO_MODEL` | default avatar, scripts |
| Voice | `AI33_API_KEY` `AI33_BASE_URL` `AI33_IMAGE_MODEL` | audio studio, Seedream |
| Stock | `PEXELS_API_KEY` | documentary B-roll |
| Auth | `FRONTEND_URL` `GOOGLE_CLIENT_ID` `GOOGLE_CLIENT_SECRET` | Google login |
| Payment | `SWICHNOW_API_KEY` `SWICHNOW_SECRET` `SWICHNOW_BASE_URL` `SWICHNOW_PWA_URL` | PKR checkout |
| Local media | `FFMPEG_PATH` `FFPROBE_PATH` `STUDIO_FONT` | optional overrides |
| MCP | `MCP_TOKEN` | optional bearer on `POST /mcp` |
| Hugging Face | `HF_TOKEN` | Modal's first weight pull |
| Unused on purpose | `DATABASE_URL` `SUPABASE_*` | Supabase is deferred; the MVP job store is on disk |

Worker credentials are **not** in this file. They are pasted into each RunPod endpoint's Environment tab so
no key is ever baked into a container image.

---

## Tests

Backend test files sit next to the source and run with the Node test runner:

```bash
cd apps/backend
npx tsx --test billing.test.ts mcp.test.ts missing-keys.test.ts \
                projects.test.ts prompt-guard.test.ts stock.test.ts
```

| File | Covers |
| --- | --- |
| `billing.test.ts` | tier grants, quotas, rate limits, SwichNow HMAC callback idempotency |
| `mcp.test.ts` | JSON-RPC envelope and tool dispatch |
| `missing-keys.test.ts` | a missing vendor key degrades to a job error, never a crash |
| `projects.test.ts` | documentary workflow: script → cast → assemble on one id |
| `prompt-guard.test.ts` | hidden characters, jailbreak and role-override refusal |
| `stock.test.ts` | Pexels search, short-query padding, Vimeo CDN video URLs |

Frontend:

```bash
cd apps/frontend
npx tsc --noEmit     # typecheck
npm run build        # production build
```

The CPU worker ships its own suite that needs no credentials and no models — see that repo's README.

---

## Deployment

| Piece | How |
| --- | --- |
| Frontend | Vercel. `apps/frontend/vercel.json` holds the SPA rewrites. |
| Backend | Node host running `npm start`. Needs a writable `data/` for the job store and auth sessions. |
| GPU / CPU workers | RunPod serverless, built from each worker repo's GitHub. A **GitHub Release** triggers the rebuild. |
| LTX video | `modal deploy apps/modal/ltx_video.py`. After a code change, `modal app stop marketing-studio-ltx --yes` first — warm containers keep old code. |
| Media + weights | Cloudflare R2. Weights under `comfy-models/`, product media under the media bucket. |

RunPod endpoint settings that are load-bearing (the reasoning is in [docs/RUNPOD.md](docs/RUNPOD.md)):

- Network volume and endpoint data centers **both pinned to EU-RO-1**. Never "all datacenters" with a volume.
- Min workers 0, max 1. Idle 5s in production, longer while debugging.
- Execution timeout 600s for GPU, ≥1800s for CPU video work.
- After any rebuild, purge the queue and stop old workers, then confirm the **worker id changed** before
  believing a fix landed.

---

## Security posture

- `.env` is gitignored and has **never** been committed. `.gitignore` also blocks `*.pem`, `*.key`,
  `credentials.json`, `secrets.json`, `rclone.conf` and `client_secret_*.json`.
- Worker repos hold no credentials. Every `.env.example` is names-only, and each Dockerfile copies only
  `handler.py` (plus `facefusion_cpu.py` on the CPU worker) — never `COPY .`, never `.env`, never weights.
- Media crosses trust boundaries as **R2 object keys**, not signed URLs or bytes. The CPU worker rejects
  anything that looks like a URL, an absolute path, a `data:` payload, or contains control characters, and
  caps input size via `MAX_INPUT_BYTES`.
- ffmpeg is invoked as an argv list with `-nostdin`; only generated filenames enter the concat manifest, so a
  hostile object key cannot reach ffmpeg's concat grammar.
- Every user-supplied prompt passes `prompt-guard` before it reaches a model, and topics are wrapped as data.
- Sessions are 7-day HttpOnly cookies. The SwichNow callback is HMAC-verified and idempotent; missing payment
  keys return 503 rather than silently granting a tier.
- `.agent-logs/` is committed on purpose as assignment evidence. A RunPod key that appeared in one dump is
  **redacted in the committed copy** — GitHub push protection caught the original, and the commit was rewritten
  before it ever reached the remote. Rotate any key that has ever been pasted into a chat.

If you find a credential anywhere in these repos, treat it as a bug and report it — the intended state is that
there are none.

---

## Known gaps

Honest list. Nothing here is hidden behind a "coming soon".

- **CPU worker timeline v1 is not deployed.** Documentary **Export** stays blocked until the worker's ping
  reports `timeline_version: 1`. The artifact is in `scripts/cpu-timeline/`. Do not treat Export as verified.
- **Template stitch has not had a product smoke.** `op=stitch` is wired and unit-tested; no end-to-end film
  has been compiled through it yet.
- **Recurring auto-debit is not wired.** A successful SwichNow payment grants a tier for 30 days as a one-time
  charge.
- **Supabase and Prisma are scaffolding.** The MVP job store is on disk. `packages/db` is deliberately unused.
- **Stitch UI polish is outstanding.** The current UI is functional and consistent, not the final design.
- **LTX generate is not wired into the product.** The Modal app is deployed and smoke-tested; no product route
  calls it yet.
- **Muse on OpenRouter is region-blocked** from our IP and stays in the picker as a disabled option.
- **The CPU worker's `estimated_usd` reads 0** because `RUNPOD_CPU_USD_PER_HR` is unset.
- **Worker `runpod` SDK pins are inconsistent.** The house rule is `runpod>=1.10.1,<2` because 1.7.11–1.10.0
  corrupts job tracking on network-volume endpoints; the GPU Dockerfiles still say `>=1.7.0,<2` and the CPU
  worker pins `1.7.13`. Worth aligning.
- **No lip-sync.** Translate changes the voice, not the mouth. The product never claims otherwise.

---

## Documentation index

Knowledge lives in markdown in this repo, not in chat history. Read in this order.

| File | What it is |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Start here if you are an agent. Read order and house rules. |
| [CONTEXT.md](CONTEXT.md) | The decisions lock. Newest handoff at the top, then the standing lock. |
| [docs/STATUS.md](docs/STATUS.md) | Live snapshot: phases A–E, what is deployed, what is next. |
| [spec/README.md](spec/README.md) | Spec index and the build order, with the pitfall files called out. |
| [docs/RUNPOD.md](docs/RUNPOD.md) | **Eleven RunPod failures we paid for**, with symptom / cause / fix. Do not thin this file. |
| [docs/MODAL.md](docs/MODAL.md) | The LTX lock: H200, 20 steps, no offload, and the money the slow path cost. |
| [docs/ENV.md](docs/ENV.md) | Env catalog — names and notes only. |
| [docs/COST.md](docs/COST.md) | Measured per-job costs. The source for any future pricing. |
| [docs/apis/](docs/apis/README.md) | Owner-written vendor notes. Read the file for a vendor before calling it. |
| [docs/sources/](docs/sources/FROM-AUTOMATION.md) | Inherited GPU contracts and the Pixovid walkthrough. |
| [apps/modal/README.md](apps/modal/README.md) | The Modal app in one page. |

Worker documentation lives in the worker repos: [Krea](https://github.com/farhann-saleem/Krea-2-Turbo#readme)
· [Qwen](https://github.com/farhann-saleem/Qwen-and-QwenEdit#readme)
· [CPU](https://github.com/farhann-saleem/Faceswap-and-FF#readme).
