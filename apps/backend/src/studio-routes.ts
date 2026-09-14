import { createTopicProject, projectWorkflowRouter } from "./project-workflow.js";
import { assertSafePrompt } from "./prompt-guard.js";
import { randomUUID } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { cpuBlockedReason, cpuHealthCached } from "./providers/cpu.js";
import { extFromMime } from "./media.js";
import { probeDurationSeconds } from "./ffmpeg-local.js";
import { r2Put } from "./r2.js";
import { listStudioMedia, previewUrlFor, resolveSource, projectScopeError, sourceScopeError } from "./studio-media.js";
import { cancelStudioRender, runStudioRender } from "./studio-render.js";
import {
  deleteProject,
  getProject,
  getRender,
  getUpload,
  listProjects,
  listRenders,
  saveProject,
  saveRender,
  saveUpload,
  studioRenderPath,
  studioUploadPath,
} from "./studio-store.js";
import { clipEnd, emptyProject, sameTrackCollision, validateProject } from "./studio-timeline.js";
import type { StudioClip, StudioClipKind, StudioClipSource, StudioProject, StudioRenderJob } from "./studio-types.js";
import { getVideoTemplate } from "./templates.js";
import { getSwapJob } from "./swap-store.js";
import { getAudioJob } from "./audio-store.js";
import { currentUser } from "./google-auth.js";
import { recordUsage } from "./billing-store.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

export const studioRouter = Router();
studioRouter.use(projectWorkflowRouter);

function sendErr(res: import("express").Response, err: unknown, status = 400) {
  res.status(status).json({ error: err instanceof Error ? err.message : String(err) });
}

function withPreview(project: StudioProject): StudioProject {
  return {
    ...project,
    clips: project.clips.map((c) => ({
      ...c,
      preview_url: previewUrlFor(c.source, c.kind),
    })),
  };
}

async function durationForSource(source: StudioClipSource, kind: StudioClipKind): Promise<number> {
  if (kind === "text" || kind === "image") return 5;
  try {
    const resolved = resolveSource(source);
    if (resolved.duration_s && resolved.duration_s > 0.2) return resolved.duration_s;
    const probed = await probeDurationSeconds(resolved.file);
    if (probed && probed > 0.2) return probed;
  } catch {
    /* fall through */
  }
  return kind === "audio" ? 8 : 5;
}

function kindForOrigin(origin: StudioClipSource["type"]): StudioClipKind {
  if (origin === "audio") return "audio";
  if (origin === "image-template") return "image";
  if (origin === "text") return "text";
  return "video";
}

async function makeClip(opts: {
  origin: StudioClipSource["type"];
  media_id?: string;
  track_id: string;
  start_sec: number;
  text?: string;
}): Promise<StudioClip> {
  const origin = opts.origin;
  let kind = kindForOrigin(origin);
  let source: StudioClipSource;
  let label = "Clip";

  if (origin === "text") {
    source = { type: "text" };
    kind = "text";
    label = assertSafePrompt(opts.text || "Text", "overlay").slice(0, 40) || "Text";
  } else if (!opts.media_id) {
    throw new Error("media_id required");
  } else if (origin === "video-template") {
    const t = getVideoTemplate(opts.media_id);
    if (!t) throw new Error("video template not found");
    source = { type: "video-template", id: t.id };
    kind = "video";
    label = t.filename.replace(/\.[^.]+$/, "");
  } else if (origin === "image-template") {
    source = { type: "image-template", id: opts.media_id };
    kind = "image";
    label = "Still";
  } else if (origin === "library") {
    const job = getSwapJob(opts.media_id);
    if (!job || job.status !== "COMPLETED") throw new Error("library item not ready");
    source = { type: "library", id: job.id };
    kind = job.kind === "video" ? "video" : "image";
    label = kind === "video" ? "Library video" : "Library image";
  } else if (origin === "audio") {
    const job = getAudioJob(opts.media_id);
    if (!job || job.status !== "COMPLETED") throw new Error("audio job not ready");
    source = { type: "audio", id: job.id };
    kind = "audio";
    label = job.title || job.kind;
  } else if (origin === "upload") {
    const row = getUpload(opts.media_id);
    if (!row) throw new Error("upload not found");
    source = { type: "upload", id: row.id };
    kind = row.kind === "audio" ? "audio" : row.kind === "image" ? "image" : "video";
    label = row.filename;
  } else {
    throw new Error("unknown origin");
  }

  const duration = await durationForSource(source, kind);
  const bed = origin === "audio" ? getAudioJob(opts.media_id || "") : undefined;
  const bedVolume = bed && (bed.kind === "sfx" || bed.kind === "music") ? 0.35 : 1;
  return {
    id: randomUUID(),
    track_id: opts.track_id,
    kind,
    source,
    label,
    start_sec: Math.max(0, opts.start_sec),
    duration,
    crop_start: 0,
    crop_end: duration,
    volume: kind === "audio" ? bedVolume : 1,
    muted: false,
    text: kind === "text" ? assertSafePrompt(opts.text || "Text", "overlay") || "Text" : undefined,
    font_size: kind === "text" ? 48 : undefined,
    color: kind === "text" ? "#ffffff" : undefined,
    x: kind === "text" ? 0.5 : undefined,
    y: kind === "text" ? 0.82 : undefined,
  };
}

function defaultTrack(project: StudioProject, kind: StudioClipKind): string {
  if (kind === "audio") return project.tracks.find((t) => t.kind === "audio")?.id ?? "a1";
  if (kind === "text") return project.tracks.find((t) => t.kind === "text")?.id ?? "t1";
  return (
    project.tracks.find((t) => t.kind === "video" && t.name === "V1")?.id ??
    project.tracks.find((t) => t.kind === "video")?.id ??
    "v1"
  );
}

function firstFreeAudioTrack(project: StudioProject, clip: StudioClip): string {
  const tracks = project.tracks.filter((t) => t.kind === "audio").sort((a, b) => a.order - b.order);
  for (const t of tracks) {
    const probe = { ...clip, track_id: t.id };
    if (!sameTrackCollision({ ...project, clips: [...project.clips, probe] }, probe)) return t.id;
  }
  return tracks[tracks.length - 1]?.id ?? "a2";
}

studioRouter.get("/health", async (_req, res) => {
  let health = null;
  let blocked = null;
  try {
    health = await cpuHealthCached();
    blocked = cpuBlockedReason(health);
  } catch (err) {
    blocked = err instanceof Error ? err.message : String(err);
  }
  res.json({ blocked, health });
});

studioRouter.get("/media", (_req, res) => {
  res.json(listStudioMedia());
});

studioRouter.post("/uploads", upload.single("file"), async (req, res) => {
  try {
    const project_id = typeof req.body?.project_id === "string" ? req.body.project_id : null;
    if (project_id && !getProject(project_id)) throw new Error("Project not found");
    const file = req.file;
    if (!file) throw new Error("file required");
    const mime = file.mimetype || "application/octet-stream";
    const kind = mime.startsWith("audio/")
      ? "audio"
      : mime.startsWith("image/")
        ? "image"
        : mime.startsWith("video/")
          ? "video"
          : null;
    if (!kind) throw new Error("upload a video, image, or audio file");
    const id = randomUUID();
    const ext = path.extname(file.originalname) || extFromMime(mime);
    const dest = studioUploadPath(id, ext);
    writeFileSync(dest, file.buffer);
    const r2_key = `${project_id ? `studio/projects/${project_id}/uploads` : "studio/uploads"}/${id}${ext.startsWith(".") ? ext : `.${ext}`}`;
    await r2Put(r2_key, file.buffer, mime);
    const duration_s = kind === "image" ? 5 : await probeDurationSeconds(dest);
    const row = saveUpload({
      id,
      project_id,
      filename: file.originalname || `${id}${ext}`,
      mime,
      bytes: file.size,
      kind,
      duration_s,
      r2_key,
      created_at: new Date().toISOString(),
    });
    res.status(201).json(row);
  } catch (err) {
    sendErr(res, err);
  }
});

studioRouter.get("/uploads/:id/file", (req, res) => {
  const row = getUpload(req.params.id);
  if (!row) {
    res.status(404).json({ error: "not found" });
    return;
  }
  const ext = path.extname(row.filename) || extFromMime(row.mime);
  const file = studioUploadPath(row.id, ext);
  if (!existsSync(file)) {
    res.status(404).json({ error: "file missing" });
    return;
  }
  res.type(row.mime);
  res.sendFile(path.resolve(file));
});

studioRouter.get("/projects", (_req, res) => {
  res.json({ projects: listProjects().map(withPreview) });
});

studioRouter.post("/projects", async (req, res) => {
  try {
    const body = (req.body ?? {}) as {
      topic?: string;
      name?: string;
      in_library?: boolean;
      script?: unknown;
      duration_sec?: unknown;
      from?: { type: StudioClipSource["type"]; id: string };
    };
    if ("topic" in body) {
      const project = createTopicProject(body.topic, body.name, body.in_library, body.script, body.duration_sec);
      recordUsage(currentUser(req)?.email || "anonymous", "documentaries");
      res.status(202).json(project);
      return;
    }
    const project = emptyProject(randomUUID(), body.name?.trim() || "Untitled");
    let counted: "videos" | null = null;
    if (body.from) {
      const clip = await makeClip({
        origin: body.from.type,
        media_id: body.from.id,
        track_id: defaultTrack(project, kindForOrigin(body.from.type)),
        start_sec: 0,
      });
      const track = project.tracks.find((t) =>
        clip.kind === "audio" ? t.kind === "audio" : clip.kind === "text" ? t.kind === "text" : t.kind === "video",
      );
      if (track) clip.track_id = track.id;
      const scope = sourceScopeError(project, clip.source); if (scope) throw new Error(scope);
      project.clips.push(clip);
      if (!body.name?.trim()) project.name = clip.label;
      if (body.from.type === "library") counted = "videos";
    }
    saveProject(project);
    if (counted) recordUsage(currentUser(req)?.email || "anonymous", counted);
    res.status(201).json(withPreview(project));
  } catch (err) {
    sendErr(res, err);
  }
});

studioRouter.get("/projects/:id", (req, res) => {
  const project = getProject(req.params.id);
  if (!project) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json(withPreview(project));
});

studioRouter.patch("/projects/:id", (req, res) => {
  const project = getProject(req.params.id);
  if (!project) {
    res.status(404).json({ error: "not found" });
    return;
  }
  try {
  const body = (req.body ?? {}) as Partial<StudioProject>;
  const timelineEdit = ["clips", "tracks", "width", "height", "fps", "playhead_sec"].some(k => k in body);
  if (timelineEdit && project.topic && !["studio", "exported"].includes(project.phase)) { res.status(409).json({ error: "Assemble this project first" }); return; }
  if (project.status === "running") { res.status(409).json({ error: "Project operation running" }); return; }
  if (timelineEdit && project.phase === "exported") project.phase = "studio";
  if (typeof body.name === "string") project.name = assertSafePrompt(body.name, "name").slice(0, 80) || project.name;
  if (typeof body.in_library === "boolean") project.in_library = body.in_library;
  if (typeof body.width === "number") project.width = body.width;
  if (typeof body.height === "number") project.height = body.height;
  if (typeof body.fps === "number") project.fps = body.fps;
  if (typeof body.playhead_sec === "number") project.playhead_sec = Math.max(0, body.playhead_sec);
  if (Array.isArray(body.tracks)) project.tracks = body.tracks;
  if (Array.isArray(body.clips)) {
    project.clips = body.clips.map((clip) => {
      if (clip.kind !== "text" || clip.text == null) return clip;
      const text = assertSafePrompt(clip.text, "overlay");
      return { ...clip, text, label: text.slice(0, 40) || clip.label };
    });
  }
  const invalid = validateProject(project) || projectScopeError(project);
  if (invalid) {
    res.status(400).json({ error: invalid });
    return;
  }
  saveProject(project);
  res.json(withPreview(project));
  } catch (err) {
    sendErr(res, err);
  }
});

studioRouter.delete("/projects/:id", (req, res) => {
  const existing = getProject(req.params.id);
  if (existing?.status === "running" || listRenders(req.params.id).some(j => ["PENDING", "IN_PROGRESS"].includes(j.status))) { res.status(409).json({ error: "Stop project operations and renders before deleting" }); return; }
  const row = deleteProject(req.params.id);
  if (!row) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json({ ok: true, id: row.id });
});

studioRouter.post("/projects/:id/clips", async (req, res) => {
  try {
    const project = getProject(req.params.id);
    if (!project) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const body = (req.body ?? {}) as {
      origin: StudioClipSource["type"];
      media_id?: string;
      track_id?: string;
      start_sec?: number;
      text?: string;
    };
    if (project.topic && !["studio", "exported"].includes(project.phase)) throw new Error("Assemble this project first");
    if (!body.origin) throw new Error("origin required");
    const kindGuess = body.origin === "text" ? "text" : kindForOrigin(body.origin);
    const track_id = body.track_id || defaultTrack(project, kindGuess);
    const clip = await makeClip({
      origin: body.origin,
      media_id: body.media_id,
      track_id,
      start_sec: body.start_sec ?? 0,
      text: body.text,
    });
    const wants: StudioClipKind =
      clip.kind === "audio" ? "audio" : clip.kind === "text" ? "text" : "video";
    const track = project.tracks.find((t) => t.id === clip.track_id);
    if (!track || track.kind !== wants) clip.track_id = defaultTrack(project, wants);
    if (!body.track_id && clip.kind === "audio") clip.track_id = firstFreeAudioTrack(project, clip);
    const hit = sameTrackCollision({ ...project, clips: [...project.clips, clip] }, clip);
    if (hit) clip.start_sec = clipEnd(hit);
    const stillHit = sameTrackCollision({ ...project, clips: [...project.clips, clip] }, clip);
    if (stillHit) throw new Error("no space on that track");
    project.clips.push(clip);
    const invalid = validateProject(project) || projectScopeError(project); if (invalid) throw new Error(invalid);
    if (project.phase === "exported") project.phase = "studio";
    saveProject(project);
    res.status(201).json(withPreview(project));
  } catch (err) {
    sendErr(res, err);
  }
});

studioRouter.post("/projects/:id/clips/:clipId/split", (req, res) => {
  const project = getProject(req.params.id);
  if (!project) {
    res.status(404).json({ error: "not found" });
    return;
  }
  const clip = project.clips.find((c) => c.id === req.params.clipId);
  if (!clip) {
    res.status(404).json({ error: "clip not found" });
    return;
  }
  const at = Number((req.body as { at?: number })?.at ?? project.playhead_sec);
  if (!(at > clip.start_sec + 0.05 && at < clipEnd(clip) - 0.05)) {
    res.status(400).json({ error: "playhead is not on this clip" });
    return;
  }
  const offset = at - clip.start_sec;
  const right: StudioClip = {
    ...clip,
    id: randomUUID(),
    start_sec: at,
    crop_start: clip.crop_start + offset,
  };
  clip.crop_end = clip.crop_start + offset;
  project.clips.push(right);
  saveProject(project);
  res.json(withPreview(project));
});

studioRouter.post("/projects/:id/render", (req, res) => {
  const project = getProject(req.params.id);
  if (!project) {
    res.status(404).json({ error: "not found" });
    return;
  }
  const invalid = validateProject(project) || projectScopeError(project);
  if (invalid || !project.clips.length || (project.topic && !["studio", "exported"].includes(project.phase))) { res.status(409).json({ error: invalid || "Assemble this project first" }); return; }
  const live = listRenders(project.id).find((j) => j.status === "PENDING" || j.status === "IN_PROGRESS");
  if (live) {
    res.status(409).json({ error: "a render is already running", job: live });
    return;
  }
  const now = new Date().toISOString();
  const job: StudioRenderJob = {
    id: randomUUID(),
    project_id: project.id,
    created_at: now,
    updated_at: now,
    status: "PENDING",
    phase: "queued",
    phase_label: "Queued…",
    provider: "cpu",
    clip_keys: [],
    audio_key: null,
    output_r2_key: null,
    output_mime: null,
    provider_job_id: null,
    error: null,
    duration_ms: null,
    estimated_usd: null,
    usd_per_hour_assumed: null,
    provider_meta: { project_snapshot: project },
  };
  saveRender(job);
  void runStudioRender(job.id);
  res.status(202).json(job);
});

studioRouter.get("/projects/:id/renders", (req, res) => {
  res.json({ jobs: listRenders(req.params.id) });
});

studioRouter.get("/renders/:id", (req, res) => {
  const job = getRender(req.params.id);
  if (!job) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json(job);
});

studioRouter.post("/renders/:id/cancel", async (req, res) => {
  try {
    const job = await cancelStudioRender(req.params.id);
    res.json(job);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = message === "not found" ? 404 : message === "already completed" ? 409 : 400;
    res.status(code).json({ error: message });
  }
});

studioRouter.get("/renders/:id/output", (req, res) => {
  const job = getRender(req.params.id);
  if (!job || job.status !== "COMPLETED") {
    res.status(404).json({ error: "output not ready" });
    return;
  }
  const file = studioRenderPath(job.id, ".mp4");
  if (!existsSync(file)) {
    res.status(404).json({ error: "file missing" });
    return;
  }
  if (req.query.download) {
    res.setHeader("Content-Disposition", `attachment; filename="studio-${job.id}.mp4"`);
  }
  res.type("video/mp4");
  res.sendFile(path.resolve(file));
});
