# Marketing Studio — spec + workflow guide

This folder plus [CONTEXT.md](../CONTEXT.md) is the complete guide. Chat is not. Other agents start at [AGENTS.md](../AGENTS.md) and [docs/STATUS.md](../docs/STATUS.md).

Product: **Marketing Studio — Your Imagination Engine**  
Domain: `marketingstudioie.site`  
Product reference: Higgsfield-style SaaS (the reference product’s **product surface**, not the reference hosted stack).

---

## What we will ship (product)

Video, image, face-swap, avatars, admin Premiere-style templates, user “generate with my avatar,” credits, dark UI, landing wall.

Do **not** invent an extra “one step further” feature. Do **not** use blocking-HTTP generate. Every job is async: row `IN_PROGRESS` → worker → poll.

---

## How we work

| Who | Owns |
| --- | --- |
| Farhann | Stitch, frontend, credentials, product calls, RunPod/Modal consoles |
| Cursor | Orchestration, backend when told, keeping these files honest |
| ChatGPT Pro / Devin Pro | Extra hands when assigned |

1. Requirement specs (00, 02, 04, 07, 09–11, 13–17, 19, 20) = **WHAT** to build. TODO until that slice ships.
2. Decisions specs (01, 03, 05) = **HOW**. Target until shipped, then rewrite with what we actually did.
3. Inherited pitfalls (06, 12, 18, notes in 13–15) + [docs/RUNPOD.md](../docs/RUNPOD.md) = **failures we already paid for. Do not delete, squash, or “clean up.”** Read before building. Do not re-learn.
4. the reference paths (`apps/frontend/src/…`) are hints, not our code.

Never commit `.env`. Never paste keys into markdown.

---

## Build order (locked 2026-09-12)

This is **our** order. Ignore the reference product’s “slice 00 = auth + video first.”

| Phase | What | Status |
| --- | --- | --- |
| **A** | RunPod GPU **Krea-2-Turbo** T2I + **Qwen Image Edit 2511** I2I | **Set.** Endpoints live EU-RO-1. Workers: `../ms-runpod-krea`, `../ms-runpod-qwen`. |
| **B** | RunPod CPU **FaceFusion** (`op=swap`) + **ffmpeg** (`op=stitch`) | Worker `../ms-runpod-cpu`, GitHub `Faceswap-and-FF`, env id `rydclpv4ta6u4p`. **Still + video swap wired** (`POST /api/faceswaps`, `kind` image/video). Still 6.2–8.1s. Stitch open. |
| **C** | Modal **LTX-2.5** video ($25). App `marketing-studio-ltx`, **H200**, 20 steps, **72s**/5s. Volume cache on `marketing-studio-ltx-models`. | **Infra set.** |
| **D** | **MVP:** Avatar first (Qwen + ai33pro Seedream 4.5), then video. No login / Prisma / Stitch. | Avatar slice in progress. **Image + Video Templates + Effects (`/effects`) + library delete** (UI polish later). |
| **E** | **Stitch UI, login, Supabase, payment last** (SwichNow, PKR). Extra feature later. | Not now. |

Images are **RunPod**, not Modal. Modal’s $30 is **video only**. Do not put Krea/Qwen on Modal.

---

## Locked stack

| Job | Host |
| --- | --- |
| Text → image | RunPod GPU Krea-2-Turbo (`i3fvrhucaici89`) |
| Image → image | RunPod GPU Qwen Image Edit 2511 (`ko6zewns6wj3mj`) |
| Face swap | RunPod CPU FaceFusion (phase B) |
| Template stitch | RunPod CPU ffmpeg (same endpoint as FaceFusion) |
| Video | Modal LTX-2.5 (phase C) |
| Voice | ai33pro / OpenSpeaker (`/audio`, spec 21) |
| DB / files | **MVP:** local job store. **Later:** Supabase Postgres. Files: Cloudflare R2 |
| Pay (phase E) | SwichNow, PKR |
| Image/video fallback | OpenRouter Muse / Seedance 1.5 Pro 480p silent — option only, $1.50 cap |

OpenRouter is **not** the farm. Landing wall = Higgsfield catalog via the reference `landing_videos.json`, **download mp4s once to R2** (spec 17).

RunPod worker rules: [docs/RUNPOD.md](../docs/RUNPOD.md). Min workers 0, max 1, volume DC = endpoint DC (**EU-RO-1** only).

---

## Spec index

| File | Kind | Phase | Notes |
| --- | --- | --- | --- |
| [00](./00-initial-video-app.md) | Video product + API | C, then D | LTX-2.5 locked. Not “auth first.” |
| [01](./01-implementation-decisions.md) | Backend/stack decisions | D | Target until backend ships. |
| [02](./02-implement-image-and-faceswap.md) | Image + face-swap product | A set; B now; D wires API | |
| [03](./03-image-and-faceswap-decisions.md) | Image/swap how + FaceFusion pitfalls | B, D | |
| [04](./04-video-templates.md) | Templates product | After C + B (needs LTX + ffmpeg + swap) | |
| [05](./05-video-templates-decisions.md) | Template how | same | |
| [06](./06-video-templates-learnings.md) | Pitfalls | read before 04 | |
| [07](./07-video-template-followups.md) | Slots, bake, timeline preview | with 04 | No spec 08; bake-per-block is here + 14. |
| [09](./09-duration-per-model.md) | Durations, tracks, overlap | with 04 | |
| [10](./10-video-ui-updates.md) | Drag; reject same-track overlap | with 04 | |
| [11](./11-video-ui-updates.md) | Linked copy/paste + crop | with 04 | |
| [12](./12-timeline-editor-learnings.md) | Pitfalls | read before 07–11 | |
| [13](./13-timeline-editor-updates.md) | Crop/menu/snap/drag bugs | with 04 | |
| [14](./14-baking-bug.md) | Export reuses bake | with 04 | |
| [15](./15-template-bug.md) | User generate must re-render | with 04 | |
| [16](./16-frontend-overhaul.md) | Dark Higgsfield UI | Stitch, ongoing | |
| [17](./17-landing-page-videos.md) | Landing catalog → R2 | D (does not need GPU) | |
| [18](./18-session-learnings.md) | Pitfalls | read with 13–15 | |
| [19](./19-credits-swichnow.md) | Credits | **E — last** | Meter jobs from day one. |
| [20](./20-generation-providers.md) | Providers, ids, graphs | A/B/C | |
| [21](./21-audio-studio.md) | Audio studio (ai33pro / OpenSpeaker) | D | Owner go 2026-09-13. Higgsfield-like + extra tools. **No lip-sync.** |
| [22](./22-video-studio.md) | User CapCut-style NLE | D | Empty timeline. Export = RunPod `op=stitch`. Superceded as home by 22-brief. |
| [22-brief](./22-brief-stock-documentary.md) | Projects documentary | D | Owner go 2026-09-13. One project: script → 2–3 Pexels picks → same-id Studio. No GPU B-roll. |
| [23](./23-mcp.md) | MCP agent connector | D | Owner go 2026-09-14. JSON-RPC on `/mcp`. Our desks only. |
| [24](./24-r2-artifacts.md) | Artifacts on R2 + presigned URLs | D/E infra | Owner go 2026-09-14. Kills the `readFileSync`→`send` memory risk and all backend media egress. Makes the host disposable. Deploy context: [docs/DEPLOY.md](../docs/DEPLOY.md). |

Walkthrough of the reference product screens (not our stack): [FROM-REFERENCE-VIDEO.md](../docs/sources/FROM-REFERENCE-VIDEO.md). GPU contracts + Modal pitfalls: [FROM-AUTOMATION.md](../docs/sources/FROM-AUTOMATION.md). Owner vendor APIs: [docs/apis/](../docs/apis/README.md).

---

## Failures already paid (do not drop these files)

Keep the full write-ups (symptom / cause / fix). Thin summaries in chat do not replace them.

| File | What we already burned |
| --- | --- |
| [docs/RUNPOD.md](../docs/RUNPOD.md) | Volume DC, disk full, torch 2.6, gcc/Triton, Comfy pin, throttle, stale workers, Qwen CLIP/nodes |
| [06](./06-video-templates-learnings.md) | Template pipeline pitfalls |
| [12](./12-timeline-editor-learnings.md) | Block field invariants |
| [13](./13-timeline-editor-updates.md) | Crop / context menu / snap / drag |
| [14](./14-baking-bug.md) | Export must reuse bake |
| [15](./15-template-bug.md) | User generate must not replay admin video |
| [18](./18-session-learnings.md) | Drag/crop listener identity; export thumbnail |
| [FROM-AUTOMATION.md](../docs/sources/FROM-AUTOMATION.md) | Modal LTX/Krea: no meta-tensor, no RPC blobs, ÷32, not distilled, budget $30 |
| [FROM-REFERENCE-VIDEO.md](../docs/sources/FROM-REFERENCE-VIDEO.md) | Blocking HTTP, hotlink CDN, swap both frames |

---

## Still open (do not invent)

- Admin template author (specs 04–15 bake / avatar slots).
- Who builds the first UI (Stitch is last).
- Backend host / Google callback when we deploy.
- Pack prices (measured from real `duration_ms` / `estimated_usd`, then PKR).
- CPU worker **timeline v1** deploy (export blocked until ping reports `timeline_version: 1`).
