# 03 — Image + face-swap: how we will do it

Companion to [02](./02-implement-image-and-faceswap.md). Image **workers are live**. FaceFusion + ffmpeg **worker is current**. App routes are phase D.

Pixovid 03 is archaeology. Keep only what is still true.

---

## 1. What we add

- Image gen via **RunPod Krea T2I + Qwen Edit I2I**, R2, async jobs. Normalize provider output to PNG/JPEG/WEBP (sniff magic bytes; default PNG).
- Face swap via FaceFusion wrapper on **RunPod CPU**, async (minutes OK).
- ffmpeg stitch on **that same CPU worker** (templates, spec 04).
- DB: `Image`, `FaceSwap`, shared `GenerationStatus`.
- Stitch: create + library tabs.

Model list shape for the picker:

`{ id, name, supported_resolutions, supported_aspect_ratios }`

---

## 2. FaceFusion (still true)

- **3.6.1 has no REST API.** Wrapper: `POST /swap` multipart source+target, `GET /health`. Pixovid’s `infra/facefusion/server.py` is the pattern, hosted on RunPod CPU, not in our API container.
- First boot is **several GB**. Marker file so restarts skip download. `lite` scope over-downloads; a warmup `headless-run` on a sample pair is leaner if we care.
- CPU swaps are slow → long execution timeout + **async jobs**.
- Do not `docker exec` from the backend. If FaceFusion is down: store inputs, mark `FAILED`, actionable error. Do not 500 the process.

Backend sees `RUNPOD_CPU_ENDPOINT_ID` (empty until phase B ships).

---

## 3. Reuse

- One upload helper, one R2 helper.
- `GET /api/models/video` and `/api/models/image`.
- Shared file field + status badge on the frontend.

## 4. API (phase D)

| Method | Description |
| --- | --- |
| `GET /api/models/image` | Krea + Qwen Edit. |
| `GET/POST /api/images`, `GET /api/images/:id` | Jobs + library. |
| `GET/POST /api/faceswaps`, `GET /api/faceswaps/:id` | Jobs + library. |

Routes: `/`, `/image`, `/face-swap` (plus later avatar/templates).

## 5. Do not repeat

- `new Blob([buffer])` in Node: wrap `Uint8Array`.
- Destructive Prisma enum renames.
