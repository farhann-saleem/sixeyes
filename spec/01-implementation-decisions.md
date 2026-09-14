# 01 — Target decisions (backend + video API)

Companion to [00](./00-initial-video-app.md). **Target**, not shipped. Phase **D** (product backend) after phase **C** (Modal LTX). Rewrite this file with what we actually did after the API exists.

---

## 1. Tech stack

| Area | Decision | Why |
| --- | --- | --- |
| Frontend | Owner via **Stitch** | Owner owns UI. |
| Auth | Google later | **No login for MVP.** Do not block A–D0. |
| Backend | TypeScript + Express | the reference shape is reference, not copy-paste. |
| DB | **MVP:** local job store. **Later:** Prisma + **Supabase** (`packages/db`) | Owner: Supabase at the end. |
| Storage | **Cloudflare R2** (S3 API) | Owner has R2. |
| Video | **Modal LTX-2.5** (phase C) | Locked. Not TBD. |
| Images | **RunPod Krea T2I + Qwen Edit I2I** (phase A — **set**) | Not Modal. |
| Face swap + stitch | **RunPod CPU FaceFusion + ffmpeg** (phase B — **now**) | Same endpoint. Not a GPU. |
| Voice | **ai33pro** | Owner lock. |
| Pay | SwichNow / PKR | **Last** (spec 19). |

Runtime (bun vs node, turborepo vs not) is a code-level choice when we write the backend. Do not invent a third monorepo style.

### Do not copy from the reference product

- Blocking HTTP until the model finishes.
- OpenRouter as the farm.
- Column names `openrouter*`. Use `provider` + `providerJobId`.
- Razorpay / INR.

### Still copy (when we write backend)

- Zod-validated env, fail fast.
- Shared `GenerationStatus`: `PENDING`, `IN_PROGRESS`, `COMPLETED`, `FAILED` (the reference burned a destructive enum rename).
- CORS credentials against `FRONTEND_URL`.
- Charge/refund later via spec 19; **meter `duration_ms` + `estimated_usd` on every job from the first generate.**

---

## 2. Target layout

```
apps/backend     Express API (TypeScript). No Python venv.
apps/frontend    Stitch export — React + TypeScript
packages/db      Prisma schema + client
```

Worker code stays in sibling folders: `ms-runpod-krea`, `ms-runpod-qwen`, `ms-runpod-cpu`. Modal app is separate.

---

## 3. Schema (video + shared status)

- Auth tables when we do login.
- `Video`: prompt, model, duration, resolution, aspectRatio, frame object keys, output key, provider job id, `duration_ms`, `estimated_usd`, error, userId.
- Same `GenerationStatus` for image, face-swap, template renders.

---

## 4. API (video)

| Method | Auth (when login exists) | Description |
| --- | --- | --- |
| `GET /health` | — | Liveness. |
| `GET /api/models` / `/api/models/video` | no (MVP) | From stub / Modal when wired. |
| `GET /api/videos` | no (MVP) | Videos + URLs. Auth later. |
| `GET /api/videos/:id` | no (MVP) | One video. |
| `POST /api/videos` | no (MVP) | Upload + params, enqueue, return row immediately. |

Google callback will be the real backend URL on `marketingstudioie.site` when we deploy — not now.

---

## 5. Infra

Production: Supabase + R2 + backend host + Modal LTX + RunPod (Krea, Qwen, CPU). FaceFusion is not in the API process; it is the CPU worker.
