# Setup

Install and run Marketing Studio locally. Env **names** only here and in [ENV.md](ENV.md) — values stay in gitignored `.env`.

## Prerequisites

| Tool | Version | Why |
| --- | --- | --- |
| Node.js | 20+ | backend (`tsx`) + frontend (Vite) |
| npm | 10+ | install per app (no workspaces) |
| ffmpeg + ffprobe | recent | timeline prep, audio extract/mux |
| Python 3.11 + venv | 3.11 | Modal CLI / scripts only |
| Docker | any | worker images (sibling repos) |

Accounts for the full stack: Cloudflare R2, RunPod, Modal, OpenRouter, ai33pro, Pexels, Google OAuth, SwichNow. Missing keys surface as job errors — the process does not crash.

## Install

```bash
git clone https://github.com/farhann-saleem/sixeyes.git marketing-studio-ie
cd marketing-studio-ie

cp .env.example .env
# fill .env — see ENV.md

cd apps/backend  && npm install && cd ../..
cd apps/frontend && npm install && cd ../..
```

Modal (optional, video):

```bash
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
modal profile current
```

## Run

Two processes:

```bash
# terminal 1
cd apps/backend && npm run dev       # http://localhost:3001

# terminal 2
cd apps/frontend && npm run dev      # http://localhost:5173
```

Checks:

```bash
curl -s http://localhost:3001/health
curl -s http://localhost:3001/api/models/avatar
```

## Local tips

- Restart the backend after editing `.env` (dotenv override is intentional).
- Google OAuth: add `http://localhost:5173/callback` as an authorized redirect URI. Production uses `https://www.marketingstudioie.site/callback`.
- Before a RunPod generate: `GET /health` (no GPU), stop if `throttled > 0`, then `{"input":{"op":"ping"}}`, then generate via `/run` + poll.

## Tests

```bash
cd apps/backend && npm test
cd apps/frontend && npx tsc --noEmit
```

## Production (summary)

Split host: Vercel frontend (`www.marketingstudioie.site`) + EC2 API (`api.marketingstudioie.site`). Full runbook: [DEPLOY.md](DEPLOY.md). Workers rebuild from their own GitHub Releases; LTX via `modal deploy apps/modal/ltx_video.py`.

## Sibling workers

| Repo | Folder | Setup doc |
| --- | --- | --- |
| Krea T2I | `../ms-runpod-krea/` | [SETUP.md](../../ms-runpod-krea/SETUP.md) |
| Qwen I2I | `../ms-runpod-qwen/` | [SETUP.md](../../ms-runpod-qwen/SETUP.md) |
| CPU swap/stitch | `../ms-runpod-cpu/` | [SETUP.md](../../ms-runpod-cpu/SETUP.md) |

(Links assume sibling clone layout under `hiigsfiled/`.)
