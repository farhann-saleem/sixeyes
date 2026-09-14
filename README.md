# Marketing Studio — Your Imagination Engine

Higgsfield-style generative-media SaaS. Domain: `marketingstudioie.site`. Hiring assignment; clone target is Pixovid’s product surface, not Pixovid’s hosted stack.

**Agents:** [AGENTS.md](AGENTS.md) → [spec/README.md](spec/README.md) (complete workflow) → [docs/STATUS.md](docs/STATUS.md). **Lock:** [CONTEXT.md](CONTEXT.md).

## Aim

Full Pixovid surface: video, image, face-swap, avatars, Premiere-style templates, generate-with-my-avatar, credits, dark UI, landing wall.

## Order we will actually do it

1. **Set:** RunPod Krea (T2I) + Qwen Edit (I2I)
2. **Set:** RunPod CPU FaceFusion + ffmpeg (swap verified; stitch open)
3. **Set:** Modal LTX-2.5 on H200
4. **Now:** MVP Express. Avatar + Image/Video Templates + **Effects** (`/effects`) + **Audio studio** (`/audio`) + **Video studio** (`/studio`). No login, no Supabase, no Stitch yet.
5. Stitch UI, login, Supabase, payment last

## Defaults

| Job | Host |
| --- | --- |
| Text → image | RunPod GPU **Krea-2-Turbo** |
| Image → image | RunPod GPU **Qwen Image Edit 2511** |
| Video | Modal **LTX-2.5** |
| Face swap | RunPod CPU **FaceFusion** |
| Template stitch | RunPod CPU **ffmpeg** (same worker) |
| Voice | **ai33pro** |
| DB / files | Supabase Postgres + Cloudflare R2 |
| Pay (last) | SwichNow, PKR |

## Repo map

```
apps/backend       Express + TypeScript (not Python — no venv)
apps/frontend      Stitch export — React + TypeScript
packages/db        Prisma + Supabase
spec/              workflow + specs
docs/              lock (STATUS, ENV, RUNPOD, MODAL)
docs/apis/         owner-written vendor API notes
docs/sources/      goldmine + Pixovid extracts
```

