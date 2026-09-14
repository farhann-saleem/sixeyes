# 06 — Templates: inherited pitfalls (read before building 04/05/07)

**When:** before we implement templates. Not current work (current = CPU FaceFusion + ffmpeg).

Pixovid’s session log for templates. We did not live this session. **Do not re-learn it.** Constraints for us: OpenRouter/MinIO → Modal LTX + R2; ffmpeg → RunPod CPU.

---

## 1. Ambiguity they had to confirm (already confirmed for us in 05)

Admin = DB role + allowlist. Avatar = face image, not a trained model. One render pipeline. ffmpeg on the **RunPod CPU** stitch job, not in the HTTP process.

They chose **synchronous serial** render. We do **not**. Background job + poll. Frontend already needs IN_PROGRESS/FAILED badges.

---

## 2. Architecture to copy

- Avatar create is passthrough (first photo = face). Reject “generate a clean portrait” on create.
- `TemplateRender` is the unit of work for export **and** user generate.
- Timeline UI from pointer events is viable; live-drag local state; persist on pointer-up. Owner/Stitch may still use a library — backend does not care.
- Multipart for anything with files; JSON for `/render` and `/export` triggers.

---

## 3. ffmpeg (copy)

- Do **not** use concat demuxer on mismatched clips. Filter graph: scale/pad/setsar/fps/yuv420p then `concat`.
- Audio vs video length: `[a]apad` + `-shortest` covers both directions (later specs mix many audio clips — see 12).
- Thumbnail: `-ss <t> -frames:v 1`, fallback to frame 0 if seek fails.
- Output size from first block aspect (`9:16` → 720×1280, etc.), default 1280×720.
- Prove the stitch on two tiny local clips **before** spending Modal credits.

---

## 4. Provider / storage

- Sniff image mime from magic bytes.
- Send frames to the video provider the way **that** provider requires (bytes, URL, or base64). R2 can be public; do not cargo-cult Pixovid’s “must be data URLs.”
- Block duration is the model duration, integer seconds, min 1s, from the allowed set.

---

## 5. Prisma / auth

- Additive tables + `role` default → `db push` is safe on empty/dev. Use migrations in production.
- `avatarIds[]` is slot order; relation keeps integrity.
- `requireAdmin` = auth then role, lazy-promote `ADMIN_EMAILS`. Share with `/api/me`.

---

## 6. Ops

- Stale Docker images will lie to you. Rebuild after backend changes.
- Host ffmpeg on PATH if the worker is not the Docker image.
- Smoke-test CRUD and 401/403 **without** calling Modal. Do not burn the $30 on bootstrap.

---

## 7. Do this first when we implement templates

1. Job queue + poll (already mandated).
2. Per-block bake (07) so export is not a blind full generate (14).
3. Template settings edit in the admin UI (audio/slots/name) — Pixovid API had it, UI did not.
