# Env catalog

Values live in gitignored `.env`. This file is **names only**. Fill `.env` from `.env.example`. Never commit keys.

Owner-written API notes (read before wiring): [apis/ai33pro.md](apis/ai33pro.md), [apis/openrouter.md](apis/openrouter.md), [apis/runpod-cpu.md](apis/runpod-cpu.md).

## Product keys in `.env`

| Name | Where | Notes |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | https://openrouter.ai/keys | Fallback only. Hard-cap. Starts `sk-or-`. |
| `OPENROUTER_BASE_URL` | — | Default `https://openrouter.ai/api/v1` |
| `OPENROUTER_IMAGE_MODEL` | locked | `meta/muse-image` (region-blocked here; keep as option) |
| `OPENROUTER_FLUX_MODEL` | locked | `black-forest-labs/flux.2-klein-4b` (default Avatar I2I) |
| `OPENROUTER_VIDEO_MODEL` | locked | `bytedance/seedance-1-5-pro` (480p, no audio) |
| `AI33_API_KEY` | https://ai33.pro/app/api-document | Voice. HTTP header **`xi-api-key`**. |
| `AI33_BASE_URL` | — | Default `https://api.ai33.pro` |
| `AI33_IMAGE_MODEL` | locked | `bytedance-seedream-4.5` (owner said seedance 4.5; vendor image id is Seedream) |
| `FFMPEG_PATH` / `FFPROBE_PATH` | optional | Audio studio extract/mux + video studio trim/text/mix before stitch. Default `ffmpeg` / `ffprobe` on PATH. |
| `STUDIO_FONT` | optional | Absolute `.ttf` for burned-in titles. Default DejaVuSans if present. |

## Already in `.env` (do not paste into git/chat)

`HF_TOKEN` / `HUGGING_API_KEY`, R2 `*_1` and canonical `R2_*`, `RUNPOD_API_KEY`, Krea/Qwen/CPU endpoint ids.

## Fill when that phase starts

| Phase | Names |
| --- | --- |
| B | `RUNPOD_CPU_ENDPOINT_ID` (live `rydclpv4ta6u4p`) |
| C | `MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET` (or Modal CLI `~/.modal.toml`) |
| D MVP | none of the DB/auth keys required |
| D later / E | `DATABASE_URL`, `SUPABASE_*`, `FRONTEND_URL`, `GOOGLE_CLIENT_*` — **end** |
| E | `SWICHNOW_*` — **names TBD** against SwichNow docs; placeholders only |

Gemini / Anthropic keys in `.env` are extras, not product defaults.

## Projects: scripts and stock

- `OPENROUTER_TEXT_MODEL`: text-only chat model; backend default `openai/gpt-4o-mini`. Uses existing `OPENROUTER_API_KEY` and `OPENROUTER_BASE_URL`. Never an image/video model.
- `PEXELS_API_KEY`: owner supplies in gitignored `.env`; sent as the Pexels Authorization header.
- No new TTS or CPU credentials. Existing `AI33_API_KEY`, R2 and RunPod variables apply.
- Restart backend after changing `.env`. Missing keys become a project error with a retry action, never a process crash.
- `MCP_TOKEN`: optional Bearer for `POST /mcp`. Empty means open on this host (MVP, no login). Spec: [../spec/23-mcp.md](../spec/23-mcp.md).
