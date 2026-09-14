# Extracted from youtube/automation (do not copy blindly)

Source: `/home/farhann-saleem/Desktop/github/youtube/automation`  
Owner said this repo is the goldmine from past content-farm pipelines. **Reuse contracts and lessons. Do not import the whole monorepo.**

---

## What already works (steal this)

| Piece | Where it lives | What Marketing Studio should reuse |
| --- | --- | --- |
| LTX-2.5 I2V on Modal | `avatar-docs/modal/ltx_video.py` | App `avatar-ltx`, class `LTXVideo`, model `Lightricks/LTX-2.5-Diffusers`, pipeline `LTX2ImageToVideoPipeline` |
| LTX call contract | `avatar-docs/scripts/generate_clips.py` | `generate.remote(frame_bytes, prompt, duration_s, aspect, seed, output_id)` → filename on volume, **not bytes** |
| LTX cost (measured) | goldmine `LTX25_MIGRATION.md` vs **this account 2026-09-13** | Goldmine claimed H100 warm ~60–65s ≈ **$0.04**. **Our smoke:** 5s / 30 steps / sequential offload = **1233s ≈ $1.35**. First HF pull ~11.5 min ≈ $0.76. Do not use the $0.04 number for this workspace. |
| Krea 2 stills | `avatar-docs/modal/krea_frames.py`, `scripts/krea_worker.py` | Official `krea-ai/krea-2` `inference.py` (`_pipeline` + `sample`). **Not** diffusers. **Not** ComfyUI for stills. |
| Qwen Image cache | cat-cast Modal volume `qwen-image-2512-cache` | Same weights pattern if we self-host Qwen |
| R2 | `comfy` bucket, rclone, Modal `CloudBucketMount` | Models + outputs. Same store as Marketing Studio. |
| Chatterbox TTS | `modal-voice/cursed_speech_modal.py` | Already on Modal T4. Clone voices from R2. Owner also wants **ai33pro** (ElevenLabs-model reseller). |
| ffmpeg assemble | kamui / avatar-docs | Template stitch later |

Prompt craft (later, for quality): `avatar-docs/workflow.md`, `reference/ltx-2.5-prompting-guide.md`. Do not invent LTX prompts from memory.

---

## Do not repeat (already paid for)

From `avatar-docs/KNOWN_ISSUES.md` + `AGENT_RUNBOOK.md`:

1. Do **not** load Krea with `DiffusionPipeline.from_pretrained` — meta-tensor crash.
2. Do **not** use ComfyUI for **Modal** single images (official Krea `inference.py`). **RunPod** Krea/Qwen **do** use Comfy + R2 fp8 — that is locked; see [docs/RUNPOD.md](docs/RUNPOD.md). Do not mix the two.
3. LTX-2.5 and Krea-2 are **gated on Hugging Face**. Accept licenses first or 403.
4. Load the model **once** in `@modal.enter()`. One remote call per batch. Per-frame reload = deadline exceeded (5 min × N).
5. Never return video/image blobs over Modal RPC (100 MB limit). Write to Volume / R2, return keys.
6. LTX sizes **divisible by 32**. Frame count **8k+1**. I2V: `guidance_scale=3.0`, ~30 steps, **not** distilled sigmas (those freeze the clip).
7. `scaledown_window`, not deprecated `container_idle_timeout`.
8. After image rebuild: `modal app stop <app> --yes` then redeploy.
9. Set Modal **workspace budget** in the dashboard before any GPU run (owner 2026-09-13: **$25**).
11. LTX-2.5 on H100 80GB: **`.to("cuda")` OOM**. Sequential offload = **1233s**/5s. **Use H200 (or B200)** + `.to("cuda")` + **20 steps** — measured **72s**. No `enable_vae_slicing`.
12. Modal mounts the script at `/root/<file>.py`. Never `Path(__file__).parents[2]` for `.env` — only `modal.is_local()`.
10. Read Modal skill before touching Modal code (root `AGENTS.md` — they burned credits skipping it).
13. Do **not** dump a 30s multi-scene YouMind brief into LTX. I2V **stays on the start frame**. Studio portrait + “rainforest vlog” (2026-09-13) = red-carpet still, extra hands, no jungle. Compose a 16:9 still that *already is* the shot, then 5s motion. `modal volume get` can fail on `clobber.modal-storage.com` DNS — copy volume → R2, then download.

---

## Suggested split for Marketing Studio (owner 2026-09-12)

- **Modal $30 → LTX-2.5 video only.** Port `ltx_video.py` as app `marketing-studio-ltx`. New Modal account (2026-09-13): empty volume `marketing-studio-ltx-models`. Do not look for `avatar-ltx-models`.
- **RunPod $100 → serverless images: Qwen + Krea-2-Turbo.** Scale to zero. Weights on a network volume. Public RunPod Qwen endpoint is $0.02/image if we do not want to maintain a worker.
- **OpenRouter $1.50 → fallback + a UI option**, not the default. Images: `meta/muse-image`. Video: `bytedance/seedance-1-5-pro` 480p silent.
- **Voice:** owner said ai33pro. Existing Chatterbox is cleaner for a hiring demo. Backend should be a `VoiceProvider` either way.
- **FaceFusion:** goldmine used laptop Docker. **We host it on RunPod serverless CPU** with ffmpeg (spec 02). Do not put it back on a GPU or the laptop.
- Details in [spec/20-generation-providers.md](spec/20-generation-providers.md).
