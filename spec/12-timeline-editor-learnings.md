# 12 — Timeline editor: inherited learnings (07→11)

**When:** read before implementing 07–11. Copy **invariants**. Swap OpenRouter → Modal LTX, MinIO → R2, stitch → RunPod CPU ffmpeg.

Pixovid already designed the block model. Copy the **invariants**.

---

## 1. Block fields and the invariant

| Field | From spec | Meaning |
| --- | --- | --- |
| `startSec`, `endSec` | 04 | Position. `endSec` is **derived**, never authoritative. |
| `track` | 09 | Lane. Higher = on top. |
| `duration` | 09 | Length the **model generates** (allowed set ∩ provider `supported_durations`). |
| `videoKey` | 07/08 | Baked preview clip. |
| `cropStart`, `cropEnd` | 11 | Window into the generated clip; `cropEnd` null = to the end. |
| `linkGroupId` | 11 | Copy/paste: shared generation content. |
| `avatarSlot`, `faceSwapStart/End` | 04/07 | Which template avatar. |
| `sourceVideoKey` | later | Uploaded (non-AI) clip; never regenerated; no avatar/swap. |

**Invariant (server-enforced):**  
`endSec = startSec + ((cropEnd ?? duration) - cropStart)`

Spec 09 said footprint = generated duration. Spec 11 made footprint = **cropped** length. Both coexist: no crop ⇒ footprint = duration.

---

## 2. Render: generate then composite

1. `renderBlockClip` — full `duration`, never the crop. Reused by bake, export, user render.
2. `buildTimelineSegments` — **pure**. Cut at every edge, topmost block, `inPoint = cropStart + (sliceStart - block.startSec)`, black for gaps. Unit-test this.
3. `stitchTimeline` — ffmpeg.

---

## 3. ffmpeg fiddly bits (copy)

- Same clip in two non-adjacent slices: **separate `-i` per slice** (cannot reuse one pad).
- Black gaps: `color=c=black:s=WxH:r=fps:d=LEN`.
- Trim: `trim=start=IN:duration=LEN,setpts=PTS-STARTPTS`.
- Uniform geometry before concat (scale/pad/setsar/fps/yuv420p).
- Later: many audio clips, `adelay` + `amix`, timeline length = furthest video **or** audio (Pixovid AGENTS.md). If we skip multi-audio at first, still leave room in the schema (`TemplateAudioClip`).

---

## 4. Durations

Provider catalog must expose `supported_durations`. UI: `ALLOWED_DURATIONS`, filter models ↔ duration. **Read the provider, do not hardcode Veo.**

---

## 5. Frontend timeline (for whoever builds it)

- Stale closures kill drags. `dragRef`, `blocksRef`, `playheadRef`. See 13 and 18.
- One positioned area, NLE-style (track 0 at bottom). `x→sec`, `y→track`.
- One pointer handler, modes: `create | move | crop-l | crop-r`. Commit on pointerup.
- Crop: right handle moves out-point; left handle moves in-point **and** shifts `startSec` so the right edge stays (Premiere).
- Patch-shaped callbacks `onChangeBlock(id, patch)`.

Cross-track overlap is the feature. Same-track overlap is forbidden. Colliding drag = red + snap back, no server commit. **Also enforce on the server.**

---

## 6. Copy/paste

Dedicated `POST …/copy`, not “create with existing keys.” Content shared; position/crop per instance. Paste at end of timeline on same track (collision-free). After a linked edit, refetch siblings.

---

## 7. Backend conventions

- Multipart fields are strings: `z.coerce.number()`, `"true"|"false"`.
- Optional `endSec` in the client payload once it is derived.
- `clampCrop` in one place.
- 200 MB audio multer + global upload error handler → 400, not a stack trace.

---

## 8. TS / process

- Discriminated unions + early returns inside closures: guard the last branch explicitly.
- Run full typecheck + build, not one package.
- Do not treat a stale running server as truth.
