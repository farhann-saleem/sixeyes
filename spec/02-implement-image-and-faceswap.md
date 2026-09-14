# 02 — Image generation and face swap

**Images (phase A) are set.** RunPod GPU:

- Text → image: **Krea-2-Turbo** (`i3fvrhucaici89`, EU-RO-1)
- Image → image: **Qwen Image Edit 2511** (`ko6zewns6wj3mj`, EU-RO-1)

Not Modal. Not OpenRouter as primary. Graphs and gates: spec 20 + [docs/RUNPOD.md](../docs/RUNPOD.md).

**Now (phase B):** RunPod **CPU** worker in `../ms-runpod-cpu`:

1. **FaceFusion** — `op=swap`. User base image + face → swapped still. Contract: `POST /swap` (or queue) source+target → image bytes. Official FaceFusion 3.6.1 has **no REST API** (Gradio + CLI only). We wrap it. Do not drive Gradio as an API.
2. **ffmpeg** — `op=stitch`. Template long-form: download clip keys from R2, stitch/thumbnail, upload mp4. Not a video model. Not the laptop. Not a GPU.

Same GitHub repo, same CPU endpoint, min workers 0, max 1, execution timeout ≥ 10 min. Swap is slow (seconds–minutes); jobs are async. Do **not** put FaceFusion or ffmpeg on the $100 GPU money. GPU FaceFusion only for a live demo, cap ~$5.

Product API (phase D, when owner says go) mirrors video:

- `GET /api/models/image` — Krea + Qwen Edit (and optional OpenRouter Muse, labeled).
- `GET/POST /api/images`, `GET /api/images/:id`
- `GET/POST /api/faceswaps`, `GET /api/faceswaps/:id`

**Avatar MVP (owner 2026-09-13, shipping now):**

- `GET /api/models/avatar` — Qwen + ai33pro Seedream 4.5 + locked prompt + live quotes
- `GET /api/costs` — catalog + per-job meter
- `POST /api/avatars` (multipart `image`, `provider=qwen|ai33pro`) → `202` job
- `GET /api/avatars`, `GET /api/avatars/:id`, `GET /api/avatars/:id/input|output`

Prompt is locked in `apps/backend/src/prompt.ts`. Costs: [docs/COST.md](../docs/COST.md).

**Images Templates still-swap (owner 2026-09-13):**

- Stills live in repo `image-template/` and on R2 `templates/images/<id>.<ext>`
- `GET /api/image-templates` — catalog + CPU health
- `GET /api/image-templates/:id/image` — serve the still
- UI: click a still → add face photo. Original stays. Swap is a second image on the same card.
- `POST /api/faceswaps` (multipart `image` = user face, `template_id`) → `202` job
- `GET /api/faceswaps`, `GET /api/faceswaps/:id`, `.../face`, `.../output`, `POST .../:id/cancel`, `DELETE .../:id`
- `GET .../output?download=1` sets `Content-Disposition` so the browser saves the file
- Worker: `op=swap`, `source_key` = still or clip, `target_face_key` = face. `/run` + poll. Never bytes on the wire to RunPod.
- Routes: `/images-templates`, `/video-templates` (same compose page), `/library` (completed swaps, newest first). Library is the job list — there is no second store. Delete removes the row + local face/output (and best-effort R2 face/output keys). Stop a live job before deleting.
- Click any result for a full-screen viewer with arrow-key paging, download, and delete.

**Video Templates (owner 2026-09-13):** clips in repo `video-template/` → R2 `templates/videos/<id>.<ext>`. `GET /api/video-templates`, `/:id/video`, `/:id/poster`. Same `POST /api/faceswaps` with a video `template_id`; job `kind` is `video`. Poll window **25 min** (catalog 720p/30s ~456s + ping/cold). Do not send 4K first. Test face: `avatar.jpeg`.

**Effects (owner 2026-09-13 / 14):** Higgsfield example MP4s, owner override. Clips in `effects-template/` named `{effect}_{nn}_{label}.mp4` (h264, longest side 720) → R2 `templates/effects/`. `GET /api/effects`. UI `/effects` groups packs by effect name (Incline, Stop World, …). Same compose + `POST /api/faceswaps` + saved `avatar_id`. Face-swap-friendly only (still person). Not LTX. Do not hotlink.

**Smoke (2026-09-13, stills functionally verified):** 6 looks in `image-template/`; swap runs from both the API and the UI; result, library, download, and cancel all behave. Rejects with `400`: no file, non-image mime, file under 1KB, unknown or deleted `template_id`. Only the UI blocks a second concurrent run — `POST /api/faceswaps` does not, so keep that guard if the page is rewritten. Video page + `DELETE` shipped the same day.

Shared upload helper, shared `GenerationStatus`, poll UX.

## Screens (owner / Stitch) — phase D

- Nav: Video, Image, Face swap.
- Image: create (prompt, model, resolution, aspect ratio, optional refs) + library. I2I uses Qwen Edit + source image.
- Face swap: base + face + library.

OpenRouter stays off the hot path. If we spend the $1.50: `meta/muse-image` at $0.01. No free OpenRouter image-gen.
