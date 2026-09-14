# 04 — Video templates (the Higgsfield “long video” trick)

**When:** after phase **B** (ffmpeg + FaceFusion CPU) and phase **C** (LTX clips). Product wiring is phase **D**. ffmpeg stitch is the CPU worker, not Modal.

No video model reliably emits a clean 5–10 minute clip. Admins author a **template**: many short clips on a Premiere-style timeline, stitched with audio. Users pick the template and regenerate it with **their** avatar.

Owner wants this in the product. It is the most expensive feature (N Modal video jobs per render). Jobs stay **async**. Owner said do not worry about the $30 Modal budget; still do not regenerate clips we already have (see 14).

## Screens (owner / Stitch)

- `/admin/template/create` — admin template creator. Timeline as close to Premiere as possible (familiar for whoever authors templates).
- `/user/avatar` — user uploads 1–2 photos → avatar.
- `/user/templates` — published templates; preview; generate with my avatar.

Admin creates, tests, updates, **exports** (publish). Export makes a template thumbnail. User generate also makes a thumbnail for that render.

Up front, admin sets how many avatars the template uses: **1 or 2**.

## Template model (behavior)

- Timeline of **video blocks**. Each block: prompt, duration, model, resolution, aspect ratio, start/end frames, optional face-swap on start and/or end frame **before** the video model runs.
- One (later: many) audio situation — start with one base audio track (07 expands this).
- Blocks are placed on the timeline (start/end). Final video is stitched in timeline order (later specs add tracks, overlaps, crop).
- Face-swap source and reference identity come from an **avatar slot**, not a one-off upload per block (see 07 — otherwise the template is not generic).
- Admin export renders with the admin’s avatars and publishes.
- User generate re-renders with the user’s avatars (see 15 — must not just replay the admin’s baked video).

## Backend (Cursor)

- `User.role` `user` | `admin`, seeded from `ADMIN_EMAILS`.
- Avatars CRUD.
- Admin template + block CRUD, export job.
- User list published templates, start render job, list renders.
- ffmpeg on **RunPod serverless CPU** to stitch + thumbnail (Pixovid proved the filtergraph). Stitch runs **after** block jobs complete. Not inside the HTTP request. Not on the laptop.

## Fight

Do not scrape Higgsfield. Do not block HTTP for a 10-minute render. Do not invent a third avatar slot.
