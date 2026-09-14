# 22 — User video studio (CapCut / Premiere NLE)

**When:** phase D, owner go 2026-09-13. Other agents own Audio (`/audio`) and Avatar. This slice is **user editing + export**, not LTX generate, not admin template bake (specs 04–15 still later).

**Product:** a full-page editor at `/studio`. Empty project. Media bin from video/image templates, library, completed audio jobs (SFX / Suno / voices from `/audio`), and uploads. Multi-track timeline (V2/V1, Text, A1/A2). Trim, split, delete, play/scrub, text overlay, volume. **Export** flattens the timeline and sends `op=stitch` to the RunPod CPU worker (`rydclpv4ta6u4p`).

Documentary projects: A1 is narration. Drop music/effects from the Audio bin onto A2. There is no third-party stock-music catalog (Pexels is video/stills only). Generate beds in Audio studio, or upload an mp3.

## Locked this slice

- No Modal LTX. No GPU. Test media = `video-template/` clips + library + audio outputs.
- No login / Supabase / Stitch polish.
- Do not rewrite `Audio.tsx` or Avatar `App.tsx`.
- Generate stays async. Export is a job row + poll.
- Meter the stitch job (`duration_ms`, `estimated_usd`).
- Worker stitch is **concat + one audio bed** (see [docs/apis/runpod-cpu.md](../docs/apis/runpod-cpu.md)). Preview can overlay; export flattens: higher video track wins (spec 09), text burned with local ffmpeg, all audio mixed to one `audio_key`.

## Screens

- `/projects` — project list: **New empty project**, **Edit**, **Rename**, **Delete**
- `/studio` redirects there. `/projects/:id/studio` (and `/studio/:id`) — NLE: media bin, program monitor, inspector, timeline
- Library + finished swap: **Edit in Studio** creates a project with that clip on V1

## API

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/studio/media` | templates, library, audio, uploads |
| POST | `/api/studio/uploads` | video/image/audio → local + R2 |
| GET/POST | `/api/studio/projects` | empty, or `{ from: { type, id } }` |
| PATCH | `/api/studio/projects/:id` | name, canvas, timeline JSON; rejects same-track overlap |
| DELETE | `/api/studio/projects/:id` | 409 if a render or operation is running |
| POST | `/api/studio/projects/:id/clips` | drop from bin |
| POST | `/api/studio/projects/:id/clips/:clipId/split` | at playhead |
| POST | `/api/studio/projects/:id/render` | async stitch |
| GET | `/api/studio/renders/:id` | poll |
| GET | `/api/studio/renders/:id/output` | mp4 |

## Not this slice

- LTX generate from the timeline
- Admin bake-per-block / avatar slots (04–15)
- Lip-sync
- Color grade, nested sequences, effect plugins
