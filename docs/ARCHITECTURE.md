# Architecture

Marketing Studio is an application tier that orchestrates generation. Heavy models run on RunPod (GPU/CPU) and Modal (LTX). Media keys live on Cloudflare R2.

## Product desks

| Desk | Path | Job |
| --- | --- | --- |
| Landing | `/` | Cinema lobby |
| Avatars | `/avatar` | Face → identity |
| Images | `/images-templates` | Still rewrite |
| Videos | `/video-templates` | Clip rewrite |
| Effects | `/effects` | Motion packs |
| Documentaries | `/projects` | Topic → script → shots → mix |
| Audio | `/audio` | TTS, music, SFX, … |
| Library | `/library` | Everything you made |
| Pricing | `/pricing` | Free / Pro / Premium |

Interactive version with desks and model buttons: [Marketing Studio system design](/home/farhann-saleem/.cursor/projects/home-farhann-saleem-Desktop-github-projects-hiigsfiled-marketing-studio-ie/canvases/marketing-studio-system-design.canvas.tsx) (open beside chat).

## System diagram

```
┌─────────────────────────────────────────┐
│  apps/frontend · React 19 + Vite        │
│  public browse · auth-gated generate    │
└──────────────────┬──────────────────────┘
                   │ fetch /api/* (credentials)
┌──────────────────▼──────────────────────┐
│  apps/backend · Express + TypeScript    │
│  jobs · quotas · OAuth · MCP · R2       │
└───┬────────┬────────┬────────┬──────────┘
    │        │        │        │
    ▼        ▼        ▼        ▼
 RunPod    RunPod    RunPod   Modal
 Krea T2I  Qwen I2I  CPU      LTX-2.5
                     FaceFusion H200
                     + ffmpeg
              │
         Cloudflare R2
     weights + product media
```

## Two hard rules

1. **Nothing blocks on a model.** HTTP returns a job row; the client polls.
2. **Media moves as R2 object keys** (workers take/return keys). GPU image workers may return one PNG inline.

## Hosting

| Piece | Where |
| --- | --- |
| Frontend | Vercel — `www.marketingstudioie.site` |
| API | EC2 behind Caddy — `api.marketingstudioie.site` |
| Postgres | Supabase (profiles / sessions / jobs metadata) |
| Media | Disk cache + R2 |
| Images | RunPod GPU (Krea / Qwen), EU-RO-1 |
| Looks + stitch | RunPod CPU |
| Video I2V | Modal H200 — `apps/modal/ltx_video.py` |

## Async job contract

```
POST /api/<resource>     → job { id, status: PENDING, … }
GET  /api/<resource>/:id → PENDING → IN_PROGRESS → COMPLETED | FAILED | CANCELLED
GET  /api/<resource>/:id/output → artifact when COMPLETED
POST /api/<resource>/:id/cancel → best-effort stop
```

Same shape for avatars, faceswaps, audio, projects, studio.

Guards (non-GET `/api` + `/mcp`): auth → per-minute rate limit (6 / 30 / 60 by tier) → monthly quota → prompt guard. GET/poll never rate-limited.

## Repo layout (this git root)

```
apps/backend/     Express routes, runners, metering, OAuth, MCP
apps/frontend/    React desks + landing
apps/modal/       LTX-2.5 Modal app
packages/db/      Prisma mirror of Supabase schema
spec/             numbered specs + pitfall docs
docs/             STATUS, ENV, COST, RUNPOD, MODAL, SETUP, ARCHITECTURE, MODELS
{image,video,effects}-template/   catalog media
```

## Why this split

- **Images on RunPod** — network volume for 18–30 GB fp8 weights; cold start from disk.  
- **Video on Modal** — H200 needed for LTX full `.to("cuda")` (~72s / 5s clip).  
- **Look + stitch on CPU** — FaceFusion ONNX + ffmpeg; GPU would idle on I/O.  
- **Documentary B-roll** — product framing is AI pipeline; cast may still use stock under the hood until LTX/Krea fill every beat (see STATUS).

Paid-for lessons: [RUNPOD.md](RUNPOD.md), [MODAL.md](MODAL.md), specs 06 / 12 / 13–15 / 18.

## Sibling worker architecture

| Worker | Doc |
| --- | --- |
| Krea | [../ms-runpod-krea/ARCHITECTURE.md](../../ms-runpod-krea/ARCHITECTURE.md) |
| Qwen | [../ms-runpod-qwen/ARCHITECTURE.md](../../ms-runpod-qwen/ARCHITECTURE.md) |
| CPU | [../ms-runpod-cpu/ARCHITECTURE.md](../../ms-runpod-cpu/ARCHITECTURE.md) |
