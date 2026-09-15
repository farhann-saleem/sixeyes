<div align="center">
  <img src="brand.png" alt="Marketing Studio" width="120" />
  <h1>Marketing Studio</h1>
  <p><i>Your Imagination Engine</i></p>

  [![React](https://img.shields.io/badge/React-19-61DAFB.svg?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
  [![Express](https://img.shields.io/badge/Express-TypeScript-000000.svg?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
  [![RunPod](https://img.shields.io/badge/RunPod-GPU%20%2B%20CPU-7B2FF7.svg?style=for-the-badge)](https://runpod.io)
  [![Modal](https://img.shields.io/badge/Modal-LTX%20H200-00C7B7.svg?style=for-the-badge)](https://modal.com)
</div>

---

> Type a topic → finish a narrated film. Upload one face → reuse it across stills, clips, and effects.

**Marketing Studio** is a generative media product: self-hosted models where it matters, async jobs everywhere, metering from day one.

Live: [marketingstudioie.site](https://www.marketingstudioie.site)

---

## Architecture

1. **The App** — React desks + Express API. Public browse; generate asks for Google. HTTP never blocks on a model — submit a job, poll, keep working.
2. **The Workers** — Krea (T2I) and Qwen (I2I) on RunPod GPU, FaceFusion + ffmpeg on RunPod CPU, LTX-2.5 on Modal H200. Weights and media live on Cloudflare R2.
3. **The Meter** — Free / Pro / Premium quotas, audio credits, SwichNow checkout. Same async contract on every desk.

```
Frontend (Vercel) ──► Backend (EC2)
                         ├── RunPod Krea · Qwen · CPU
                         ├── Modal LTX-2.5
                         └── Cloudflare R2
```

---

## One request

Create an avatar (async — poll until `COMPLETED`):

```bash
curl -s -X POST https://api.marketingstudioie.site/api/avatars \
  -H "Content-Type: application/json" \
  -H "Cookie: <session>" \
  -d '{"prompt":"cinematic portrait, soft window light","provider":"openrouter-flux"}'
```

Jobs never wait on the GPU inside the HTTP handler. Full desk map, models, and routes: **[docs/MODELS.md](docs/MODELS.md)**.

---

## Setup

```bash
cp .env.example .env          # names in docs/ENV.md — values never in git
cd apps/backend  && npm i && npm run dev   # :3001
cd apps/frontend && npm i && npm run dev   # :5173
```

Full install, env, deploy, and worker links: **[docs/SETUP.md](docs/SETUP.md)**  
System design: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**

Four repos: this app · [Krea-2-Turbo](https://github.com/farhann-saleem/Krea-2-Turbo) · [Qwen-and-QwenEdit](https://github.com/farhann-saleem/Qwen-and-QwenEdit) · [Faceswap-and-FF](https://github.com/farhann-saleem/Faceswap-and-FF)

<div align="center">
  <i>Imagination in, cinema out.</i>
</div>
