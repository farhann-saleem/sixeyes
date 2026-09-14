# 22 — Projects: script, scene casting, Studio

Owner GO 2026-09-13. Supersedes the empty Studio home from [22-video-studio.md](22-video-studio.md) for the new flow. One `studio-projects.json` row owns the topic, script, scenes, candidates, picks, TTS job, timeline and renders. No briefs store or secondary project creation.

## Data and workflow

Phases: `topic → script → cast → studio → exported`. Status: `draft | running | ready | failed | cancelled`. Legacy rows normalize to studio/ready with null script and empty topic. A durable operation id fences asynchronous writes; startup resumes only assembly with a known TTS provider id. Interrupted script/stock needs explicit retry, never an automatic paid resubmission. Terminal TTS errors retain the job id.

OpenRouter `/chat/completions` writes to the **chosen film length**: 30, 45, **60 (default)**, or 90 seconds. Scene count and word budget scale with that pick (60s stays 6–8 scenes, 4–8 seconds each, total 45–65s). Generated duration arithmetic is normalized without a second LLM request. Owner edits and coffee presets are validated, not silently normalized; presets are scaled to the chosen length. Full narration word budget follows the length (90 words at 30s, 180 at 90s). Measured output and final timeline have a **90s hard cap**. Topic and script fields are prompt-guarded (injection / role-override refused; topic wrapped as data). Project keeps returned text cost when available.

Review title, full narration, headings, scene narration, concrete 3–6 word stock queries and durations. Fetch only after approval. Scene VO edits update full narration while it follows the concatenated scene lines; separately edited full narration remains authoritative.

Pexels searches videos first (`GET https://api.pexels.com/videos/search`, `per_page=3`), then photos (`GET https://api.pexels.com/v1/search`) to fill missing candidates. Requests send a User-Agent; Pexels 403s some default clients without one. Video file URLs are often `player.vimeo.com` — downloads follow HTTPS redirects and allow Pexels + Vimeo/Akamai hosts only. Select MP4 nearest 720p, never above 1080p, long enough for the scene. Max 3 candidates/scene, 80 MB/download, bounded network timeouts. Attribution and Pexels/license links appear on every candidate. No results automatically skip the scene. API/auth/network failures remain visible errors; retry preserves completed scenes.

Pick one or skip every scene; keep at least one visual. Assembly fills existing V1 and A1 with no overlaps. **Skip removes the visual, not words from the owner's full narration.** Chosen scenes are packed in order; repeat the final selected shot if needed to cover narration. No black tail or automatic narration truncation. Stock sound starts at volume zero. The existing ai33pro TTS enqueue/runner is reused; project linkage is saved before submission. Output becomes a project-owned upload measured with ffprobe (metadata only). No local film rendering.

## Scoping

`StudioUpload.project_id` is the owning id, null for legacy/global. Stock, manual project uploads and narration use `studio/projects/<projectId>/uploads/<uploadId>.ext` on R2. Project media contains its uploads/TTS, shared templates and manually selectable finished Library assets. Other projects' uploads/TTS are excluded. Global legacy media excludes project-owned stock. Add-clip, PATCH, legacy create-from and export enforce ownership as well as bin filtering. This is project isolation, not authentication; login remains deferred.

Renders keep project_id and a snapshot of the submitted timeline. Exported phase only applies if that timeline still matches. Deletion currently removes only the project row and refuses active operations/renders; automatic remote cleanup is not shipped.

## HTTP

All paths are below `/api/studio`.

| Method | Path | Behavior |
| --- | --- | --- |
| POST | `/projects` | `{topic,name?,in_library?,duration_sec?}` creates one row, script queued, 202; `duration_sec` is 30/45/60/90 (default 60); `in_library` also lists the film on `/library`; old `{name,from}` retained |
| GET | `/projects`, `/projects/:id` | Full project, scenes, candidates and timeline |
| PATCH | `/projects/:id/script` | Script-only stage; validate owner edits |
| POST | `/projects/:id/retry-script` | Explicit retry before script exists, 202 |
| POST | `/projects/:id/fetch-stock` | Async, 202; resume unfinished scenes |
| POST | `/projects/:id/scenes/:sceneId/pick` | `{upload_id}` or `{skip:true}` |
| POST | `/projects/:id/assemble` | Optional voice_id, async 202; same project and existing TTS id reused |
| POST | `/projects/:id/cancel` | Stop operation and cancel active linked narration |
| GET | `/projects/:id/media` | Scoped bin |
| POST | `/uploads` | Multipart file + project_id; legacy null retained |
| PATCH/POST | existing timeline/clip routes | Scope validation, non-overlap, hard cap |
| POST | `/projects/:id/render` | Async CPU stitch; immutable timeline snapshot |
| GET | `/projects/:id/renders` | Only this project's renders |

## UI

Primary Projects tab, all existing tabs retained. `/` and `/projects` list projects and New topic plus **How long** (30/45/60/90). `/projects/:id` script; `/cast` picks; `/studio` existing NLE with uploads bin default. Chrome owns project name and step tabs. Studio is gated until assembly (legacy projects already allowed). Old `/studio` paths resolve to Projects routes. Editor remounts per project id and serializes/flushed pending saves before export or server clip changes.

## Cloud export requirement

The previous worker only concatenated full video keys with one soundtrack. Previous product code locally trimmed/mixed/burned text, which violates this slice. New backend sends `op=stitch` plus `timeline.version=1`, R2 source keys, durations/in-points, text and audio beds. `scripts/cpu-timeline/` is an additive worker extension, preserving legacy concat and FaceFusion. It validates metadata before downloads and runs all ffmpeg operations on RunPod CPU. A worker ping without `timeline_version:1` blocks export with a deployment message, never silently exports untrimmed sources. Deployment/live export verification is pending.

No Modal, Krea, Qwen, Seedream, OpenRouter images/video, or automatic FaceFusion calls. No login, Supabase, payments or Stitch polish.
