# Agents — read this first

Marketing Studio knowledge lives in **markdown in this repo**. Chat history is not the source of truth. If you decide or ship something, **update the md in the same turn**.

## Read order

1. [CONTEXT.md](CONTEXT.md) — **handoff at the top**, then lock
2. [docs/STATUS.md](docs/STATUS.md) — A set / C infra set / B swap verified / D0 MVP next
3. [spec/README.md](spec/README.md) — workflow + spec index
4. [docs/MODAL.md](docs/MODAL.md) — before any Modal / LTX work
5. [docs/RUNPOD.md](docs/RUNPOD.md) — before any RunPod Docker / handler / endpoint work
6. [docs/ENV.md](docs/ENV.md) — env names (values only in `.env`)
7. [docs/apis/](docs/apis/README.md) — **owner-written** vendor notes. Read the file for that vendor before you call it (ai33pro, OpenRouter, CPU worker).
8. The numbered spec for the slice you are touching

Do not invent stack, models, prices, or an extra feature. If it is not in these files, ask.

## Also

| File | Why |
| --- | --- |
| [README.md](README.md) | One-page product + repo map |
| [docs/sources/FROM-AUTOMATION.md](docs/sources/FROM-AUTOMATION.md) | GPU contracts from the YouTube goldmine |
| [docs/sources/FROM-REFERENCE-VIDEO.md](docs/sources/FROM-REFERENCE-VIDEO.md) | Pixovid walkthrough — UX/pitfalls, not our stack |
| `.env.example` | Env **names**. Values only in gitignored `.env`. Catalog: [docs/ENV.md](docs/ENV.md) |

Sibling worker folders (not this git root): `../ms-runpod-krea`, `../ms-runpod-qwen`, `../ms-runpod-cpu`.

## Rules

- Owner (Farhann): product calls + credentials. Stitch / polished UI at the end. Cursor: orchestrator + backend when told. Do not act until the owner says go, except keeping these files honest.
- Never commit `.env` or paste keys into markdown.
- Generation is **async** (job row + poll). Never block HTTP on the model.
- **Login last. Payment last.** Extra feature not chosen — do not invent one.
- Build order: **A** Krea/Qwen (set) → **C** LTX H200 (infra set) → **B** CPU swap verified (stitch open) → **D** MVP Express video (no login / Supabase / Stitch; dummy OK) → **E** Stitch UI + login + Supabase + pay.
- CPU leftover on RunPod is **FaceFusion** (swap) + **ffmpeg** (template stitch), not a GPU.
- **Do not delete learnings:** `docs/RUNPOD.md`, specs 06, 12, 13, 14, 15, 18, `docs/sources/FROM-AUTOMATION.md` “Do not repeat”. Add new failures; do not squash old ones.
