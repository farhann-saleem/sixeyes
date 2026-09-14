# 18 — Inherited session learnings (drag/crop + export thumbnail)

**When:** read with 13–15. Keep lessons. Do **not** keep “we scraped Higgsfield” or “we called OpenRouter live.”

Builds on [13](./13-timeline-editor-updates.md), [14](./14-baking-bug.md), [15](./15-template-bug.md).

---

## 1. Drag and crop both died for the same reason

Window listeners registered in `beginDrag` were `useCallback`s that depended on parent props. `onSelect()` on pointer-down re-rendered the parent → new callback identities → effect cleanup **removed the listeners** → drag dead.

**Rule:** long-lived listeners (window, document, rAF) are stable. They read `propsRef` / `blocksRef` / `playheadRef`. Cleanup on unmount only.

---

## 2. Precision + snap

`xToSecRaw` (no round) + `snapSec` (magnet to playhead within ~8px, else 0.1s). Crop snaps in **timeline space**, then derive `cropStart`/`cropEnd`. Never snap the clip-relative crop number or the magnet lands wrong.

---

## 3. Context menu

`onContextMenu(blockId | null, e)`. Copy/Paste/Delete at cursor. `if (e.button !== 0) return` on all pointer-down. Block right-click `stopPropagation`. Lane separators `pointer-events-none`.

---

## 4. Concurrent edits

the reference had two sessions rewrite `templateRender.ts` at once (serial → parallel + `linkGroupId` + `forceRegenerate`). Types drifted.

**Rule:** disk is truth. Re-read the file. Align `RenderBlock` with Prisma. Full monorepo typecheck after edits. Our render path must include 14+15 from day one: reuse bake on **admin export**; force regenerate + link-group dedup + capped parallelism on **user generate**.

---

## 5. Export thumbnail

Admin **export** cover: generate an image from block prompts (image provider: RunPod/Modal/Gemini — pick at implementation, not OpenRouter-by-default). User renders: cheap ffmpeg frame grab.

Always fall back to ffmpeg on provider error so export never dies on the thumbnail. Pass real content-type into R2 (do not hardcode `image/jpeg`).

---

## 6. Cross-cutting

- Typecheck and build are not the same.
- Stale servers lie.
- Smoke cheap: CRUD on a spare port against real Supabase/R2. Do not spend Modal on a thumbnail test if Gemini free or ffmpeg will do.
