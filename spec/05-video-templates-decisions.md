# 05 — Templates: target decisions

**When:** with spec 04 (after CPU stitch + LTX). Target, not shipped.

Companion to [`04-video-templates.md`](./04-video-templates.md). Pixovid 05/06 proved the data model; we keep it and change **where compute runs**.

---

## 1. Confirmed product rules

| Question | Decision |
| --- | --- |
| Who is admin? | `User.role`, seeded from `ADMIN_EMAILS` on next authenticated request. `/api/me` tells the frontend. |
| How does rendering run? | **Async worker**, not Pixovid’s blocking request. Same pipeline for admin export and user generate; export also publishes. |
| Where is ffmpeg? | **RunPod serverless CPU** worker (same repo/endpoint as FaceFusion). Job downloads clip keys from R2, runs ffmpeg, uploads the stitched mp4. Not the laptop. Not a GPU. Backend only enqueues. |
| What is an avatar? | Stored face photo(s). `faceKey` = first photo. Used as FaceFusion **source** and as the video model **reference**. Not a trained LoRA. |

---

## 2. Data model (keep Pixovid’s shape)

- `Avatar` — `sourceImageKeys[]`, `faceKey`.
- `Template` — `avatarSlots` (1–2), audio key(s) as later specs, `published`, preview/thumbnail keys.
- `TemplateBlock` — timeline fields + generation fields + `avatarSlot` + face-swap flags. Later: `track`, `duration`, `videoKey`, crop, `linkGroupId`, optional uploaded `sourceVideoKey`.
- `TemplateRender` — `avatarIds[]` (slot order) + relation to avatars, output keys, status, cost. Used for **both** export and user generate.

Additive schema. No enum renames.

---

## 3. API (keep Pixovid paths so Stitch can follow one contract)

- `GET /api/me` → `{ id, email, isAdmin, credits? }`
- Avatars CRUD
- User templates list/get, `POST /api/templates/:id/render` (enqueue), list renders
- Admin templates + blocks CRUD, `POST …/blocks/:id/bake`, `POST …/export`

`/export`: render with template’s admin avatars, store `TemplateRender`, copy preview onto `Template`, `published = true`.  
User `/render`: same pipeline, user’s avatars, **force regenerate** (spec 15), no publish.

---

## 4. Architecture

- `renderBlockClip(block, face)` — swap start/end if flagged, then video provider. Always generate full `duration` (crop is non-destructive).
- `buildTimelineSegments` — pure function, unit-test without GPUs.
- `stitchTimeline` — ffmpeg.
- `runRender` — persist onto `TemplateRender`.

One pipeline. Do not fork admin vs user.

---

## 5. Screens (Stitch)

- `/user/avatar`, `/user/templates`, `/admin/template/create`
- Timeline: Premiere-like. Pixovid file names (`Timeline.tsx`, `BlockInspector.tsx`) are hints only.

---

## 6. Explicit non-goals in this spec

- Email verification.
- Synthesizing a “clean portrait” on avatar create (rejected by Pixovid; still rejected — extra cost for no FaceFusion gain).
