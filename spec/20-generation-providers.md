# 20 — Generation providers

Owner lock 2026-09-12. Goldmine: [FROM-AUTOMATION.md](../docs/sources/FROM-AUTOMATION.md). Worker pitfalls: [docs/RUNPOD.md](../docs/RUNPOD.md).

Backend is a **provider interface**. Default is self-host. OpenRouter is fallback **and** a labeled UI option.

## Defaults

| Job | Default | Fallback / option | Phase |
| --- | --- | --- | --- |
| Image T2I | RunPod **Krea-2-Turbo** `i3fvrhucaici89` | OpenRouter `meta/muse-image` | **A — set** |
| Image I2I | RunPod **Qwen Image Edit 2511** `ko6zewns6wj3mj` | Muse | **A — set** |
| Face swap | FaceFusion, RunPod **CPU** | — | **B — now** |
| Template stitch | **ffmpeg**, same CPU worker | — | **B — now** |
| Video | Modal **LTX-2.5** | OpenRouter `bytedance/seedance-1-5-pro` 480p silent | **C — next** |
| Voice | **ai33pro** | — | with product |
| Avatar portrait | RunPod **Qwen Edit** + **ai33pro Seedream 4.5** | — | **D0 MVP now** |

Every job is **async**. Media on **R2**. Meter `duration_ms` + `estimated_usd`.

Do **not** put Krea/Qwen on the Modal $30. Do **not** put FaceFusion/ffmpeg on a GPU.

---

## RunPod GPU (phase A — set)

- GitHub: `farhann-saleem/Krea-2-Turbo`, `farhann-saleem/Qwen-and-QwenEdit`. Secrets on the endpoint, never git.
- Both **EU-RO-1** only. Network volume in that DC. Min 0, max 1. Recycle workers after every release.
- **Krea:** R2 `comfy-models/krea2-turbo/` (~18 GB). 4 steps, cfg 1.0, `CLIPLoader` type `krea2`. Default 1280×720.
- **Qwen Edit:** R2 `comfy-models/qwen-image-edit-2511/` (~30 GB). `CLIPLoader` type **`qwen_image`**, `TextEncodeQwenImageEditPlus`, `ModelSamplingAuraFlow(shift=8.0)`, `CFGNorm(strength=1.0)`. Default 1024×1024, 20 steps, cfg 4.0, `image_b64`. Qwen Image 2512 on R2 is T2I leftover — not this worker.
- No weights in the Docker image. `runpod>=1.10.1,<2`. Comfy `v0.35.1` from `Comfy-Org`. PyTorch **2.7**. gcc for Triton.

Retired Krea id: `r59jmvkgw3a5m3`.

---

## RunPod CPU (phase B — now)

- Local folder: `../ms-runpod-cpu`. GitHub `farhann-saleem/Faceswap-and-FF`. Env `RUNPOD_CPU_ENDPOINT_ID=rydclpv4ta6u4p`. Verify before calling it live.
- `op=swap` FaceFusion, `op=stitch` ffmpeg. Handler downloads/uploads R2 keys.
- Execution timeout ≥ 10 min. Same DC rules if a volume is attached.
- FaceFusion weights are **not** on the `comfy` bucket today; plan the download/cache on the CPU volume.

---

## Modal video (phase C — infra set)

- App **`marketing-studio-ltx`** deployed on workspace `farhansaleem-342-g`. Code `apps/modal/ltx_video.py`. Budget **$25**.
- **GPU:** `["H200", "B200"]`. `.to("cuda")`. **20 steps.** Measured 5s **72s**. H100 offload retired (1233s / OOM if full load).
- **Weights:** volume `marketing-studio-ltx-models` (cache pulled). **Do not** load R2 Comfy distilled LTX.
- `@modal.enter()`. `scaledown_window` 10 min. `local_files_only` when cache exists. Outputs on volume, not RPC bytes.
- I2V: **one** start frame, 24fps, sizes ÷32, frame count 8k+1, `guidance_scale=3.0`. Distilled sigmas = slideshow.
- LTX / Qwen / Muse **do not** natively consume a multi-pose reference sheet as identity. See CONTEXT § Reference sheets.

---

## OpenRouter ($1.50) — option + fallback

- Automatic fallback only if self-host is down or times out. Hard cap the key. Env: `OPENROUTER_API_KEY`. Image model `meta/muse-image`. Video `bytedance/seedance-1-5-pro` 480p **no audio**. Never default Veo/Sora.

## Voice

**ai33pro** (OpenSpeaker). Env: `AI33_API_KEY` + `AI33_BASE_URL=https://api.ai33.pro`. Requests use header `xi-api-key` ([API docs](https://ai33.pro/app/api-document)). Wrapper: `VoiceProvider`. Do not spend the $30 LTX budget on TTS. What the Higgsfield Audio tab maps to: [docs/sources/FROM-HIGGSFIELD-AUDIO.md](../docs/sources/FROM-HIGGSFIELD-AUDIO.md).

## Do not copy from the YouTube farm

Time-travel vlog / cat-cast / kamui pipelines. We copy infra patterns, not those EDLs.
