import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { Router } from "express";
import { getProject, getUpload, listProjects, listUploads, saveProject, saveUpload, studioUploadPath } from "./studio-store.js";
import { emptyProject, footprint, validateProject } from "./studio-timeline.js";
import { parseFilmLength, scaleScriptToLength } from "./film-length.js";
import { assertSafePrompt } from "./prompt-guard.js";
import { generateScript, parseScript } from "./project-script.js";
import { fetchSceneStock } from "./project-stock.js";
import { listStudioMedia } from "./studio-media.js";
import { ai33Voices } from "./providers/ai33-audio.js";
import { enqueue } from "./audio-routes.js";
import { cancelAudioJob, runAudioJob } from "./audio-runner.js";
import { audioOutputPath, getAudioJob } from "./audio-store.js";
import { probeDurationSeconds } from "./ffmpeg-local.js";
import { r2Put } from "./r2.js";
import type { StudioClip, StudioProject } from "./studio-types.js";

const active = new Map<string, AbortController>();
export function requireProject(id: string): StudioProject {
  const p = getProject(id); if (!p) throw new Error("Project not found"); return p;
}
function idle(p: StudioProject) { if (p.status === "running") throw new Error("A project operation is already running"); }
function current(id: string, token: string) {
  const p = requireProject(id);
  if (p.operation_id !== token || p.status !== "running") throw new Error("Operation stopped");
  return p;
}
export function createTopicProject(topic: unknown, name?: string, inLibrary = false, script?: unknown, durationSec?: unknown) {
  const cleanTopic = assertSafePrompt(topic, "topic");
  const length = parseFilmLength(durationSec);
  const cleanName = name == null || name === "" ? undefined : assertSafePrompt(String(name), "name");
  const p = emptyProject(randomUUID(), cleanName?.trim().slice(0, 80) || cleanTopic.slice(0, 80));
  p.topic = cleanTopic; p.target_duration_sec = length; p.phase = "topic"; p.status = "draft"; p.in_library = Boolean(inLibrary);
  if (script !== undefined) {
    p.script = parseScript(scaleScriptToLength(script, length), undefined, length, { owner: true });
    p.phase = "script";
    p.status = "ready";
    return saveProject(p);
  }
  saveProject(p); return startOperation(p, "script");
}
export function startOperation(p: StudioProject, operation: NonNullable<StudioProject["operation"]>, voiceId?: string) {
  idle(p); p.status = "running"; p.operation = operation; p.operation_id = randomUUID(); p.error = null;
  if (voiceId) p.voice_id = voiceId;
  if (operation === "stock") p.phase = "cast";
  saveProject(p);
  // Queue after the response; do not await any vendor or download in the HTTP handler.
  setImmediate(() => void runOperation(p.id, p.operation_id!));
  return p;
}
async function runOperation(id: string, token: string) {
  const controller = new AbortController(); active.set(id, controller);
  const signal = controller.signal;
  try {
    let p = current(id, token);
    if (p.operation === "script") {
      const result = await generateScript(p.topic, signal, parseFilmLength(p.target_duration_sec));
      p = current(id, token); p.script = result.script; p.script_cost_usd = result.cost; p.phase = "script";
    } else if (p.operation === "stock") {
      if (!p.script) throw new Error("Review a script first");
      for (const scene of p.script.scenes) {
        if (["fetched", "picked", "skipped"].includes(scene.status)) continue;
        const candidates = await fetchSceneStock(id, scene, signal);
        p = current(id, token);
        const target = p.script!.scenes.find(s => s.id === scene.id)!;
        target.candidates = candidates; target.status = candidates.length ? "fetched" : "skipped";
        target.error = candidates.length ? null : "No stock found — scene skipped";
        saveProject(p);
      }
      p = current(id, token);
    } else if (p.operation === "assemble") {
      if (!p.script) throw new Error("Script missing");
      if (!p.tts_job_id) {
        let voiceId = p.voice_id;
        if (!voiceId) {
          const catalog = await ai33Voices({ provider: "edge", locale: "en-US", page_size: "10" });
          const rows = Array.isArray(catalog.data) ? catalog.data : [];
          voiceId = rows.map(r => String((r as { voice_id?: string }).voice_id || "")).find(Boolean);
          if (!voiceId) throw new Error("No usable catalog voice. Choose a voice and retry assemble.");
        }
        p = current(id, token);
        const job = enqueue("tts", p.name, { text: assertSafePrompt(p.script!.voiceover_full, "scriptVo"), voice_id: voiceId, speed: 1, project_id: id }, undefined, true);
        p.tts_job_id = job.id; p.voice_id = voiceId; saveProject(p);
        void runAudioJob(job.id);
      }
      const deadline = Date.now() + 31 * 60_000;
      for (;;) {
        p = current(id, token);
        const job = getAudioJob(p.tts_job_id!);
        if (!job) throw new Error("Linked TTS job missing");
        if (["FAILED", "CANCELLED"].includes(job.status)) throw new Error(`Narration ${job.status.toLowerCase()}: ${job.error || "check Audio"}. The same job is retained; no automatic duplicate charge.`);
        if (job.status === "COMPLETED") break;
        if (Date.now() > deadline) throw new Error("Narration is still running. Retry assemble to wait on the same TTS job.");
        await new Promise<void>((resolve, reject) => {
          const abort = () => { clearTimeout(timer); reject(new Error("Stopped")); };
          const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 2000);
          signal.addEventListener("abort", abort, { once: true });
        });
      }
      const file = audioOutputPath(p.tts_job_id!, ".mp3");
      const duration = await probeDurationSeconds(file);
      if (!duration || duration > 90) throw new Error(`Narration ${duration ? `is ${duration.toFixed(1)} seconds (90 max)` : "duration could not be measured"}. No timeline was changed.`);
      p = current(id, token);
      let upload = listUploads(id).find(u => u.filename === `narration-${p.tts_job_id}.mp3`);
      if (!upload) {
        const uid = randomUUID(), bytes = readFileSync(file), key = `studio/projects/${id}/uploads/${uid}.mp3`;
        await r2Put(key, bytes, "audio/mpeg");
        p = current(id, token);
        writeFileSync(studioUploadPath(uid, ".mp3"), bytes);
        upload = saveUpload({ id: uid, project_id: id, filename: `narration-${p.tts_job_id}.mp3`, mime: "audio/mpeg", bytes: bytes.length,
          kind: "audio", duration_s: duration, r2_key: key, created_at: new Date().toISOString() });
      }
      p.clips = assembleClips(p, upload.id, duration); p.playhead_sec = 0;
      const invalid = validateProject(p); if (invalid) throw new Error(invalid);
      p.phase = "studio";
    }
    p = { ...current(id, token), ...p, status: "ready", operation: null, operation_id: null, error: null };
    saveProject(p);
  } catch (err) {
    const p = getProject(id);
    if (p?.operation_id === token && p.status === "running") {
      p.status = "failed"; p.error = err instanceof Error ? err.message : String(err); saveProject(p);
    }
  } finally { if (active.get(id) === controller) active.delete(id); }
}
export function assembleClips(p: StudioProject, audioId: string, audioDuration: number): StudioClip[] {
  const picks = p.script!.scenes.filter(s => s.status === "picked");
  if (!picks.length) throw new Error("Pick at least one scene");
  const clips: StudioClip[] = []; let start = 0;
  for (const s of picks) {
    const u = getUpload(s.picked_upload_id!);
    if (!u || u.project_id !== p.id) throw new Error("Picked upload is not in this project");
    const span = Math.min(s.duration_sec, u.duration_s ?? s.duration_sec);
    clips.push({ id: randomUUID(), track_id: "v1", kind: u.kind, source: { type: "upload", id: u.id }, label: s.heading,
      start_sec: start, duration: u.duration_s ?? span, crop_start: 0, crop_end: span, volume: 0, muted: false });
    start += span;
  }
  // Keep the owner's full VO, even when a visual scene is skipped. Repeat the final
  // selected shot if necessary; no black tail and no narration truncation.
  const last = clips[clips.length - 1];
  const holdLen = footprint(last);
  while (start < audioDuration - 0.001) {
    const span = Math.min(holdLen, audioDuration - start);
    clips.push({
      ...last,
      id: randomUUID(),
      start_sec: start,
      crop_start: last.crop_start,
      crop_end: last.crop_start + span,
      label: `${last.label} · narration hold`,
    });
    start += span;
  }
  clips.push({ id: randomUUID(), track_id: "a1", kind: "audio", source: { type: "upload", id: audioId }, label: "Narration",
    start_sec: 0, duration: audioDuration, crop_start: 0, crop_end: audioDuration, volume: 1, muted: false });
  return clips;
}
export function cancelProject(id: string) {
  const p = requireProject(id);
  if (p.status !== "running") return p;
  p.status = "cancelled"; p.error = "Stopped by you"; saveProject(p); active.get(id)?.abort();
  if (p.operation === "assemble" && p.tts_job_id) {
    const job = getAudioJob(p.tts_job_id);
    if (job && !["COMPLETED", "FAILED", "CANCELLED"].includes(job.status)) void cancelAudioJob(job.id).catch(() => undefined);
  }
  return p;
}
export function resumeProjectOperations() {
  for (const p of listProjects()) {
    if (p.status !== "running") continue;
    // Only resume polling a known paid task. Ambiguous submissions are never repeated.
    if (p.operation === "assemble" && p.tts_job_id && getAudioJob(p.tts_job_id)?.provider_job_id) {
      setImmediate(() => void runOperation(p.id, p.operation_id!));
    } else { p.status = "failed"; p.error = "Backend restarted during this operation. Review and retry; no vendor request was automatically resubmitted."; saveProject(p); }
  }
}
export const projectWorkflowRouter = Router();
projectWorkflowRouter.get("/projects/:id/media", (req, res) => {
  if (!getProject(req.params.id)) { res.status(404).json({ error: "Project not found" }); return; }
  res.json(listStudioMedia(req.params.id));
});
function route(method: "post" | "patch", suffix: string, action: (p: StudioProject, body: Record<string, unknown>, sceneId?: string) => StudioProject, code = 200) {
  projectWorkflowRouter[method](`/projects/:id/${suffix}`, (req, res) => {
    try { const p = action(requireProject(req.params.id), req.body || {}, (req.params as { sceneId?: string }).sceneId); res.status(code).json(p); }
    catch (err) { const error = err instanceof Error ? err.message : String(err); res.status(error === "Project not found" ? 404 : 409).json({ error }); }
  });
}
route("post", "retry-script", p => { if (p.script || !p.topic) throw new Error("Script already exists"); return startOperation(p, "script"); }, 202);
route("patch", "script", (p, body) => { idle(p); if (p.phase !== "script") throw new Error("Script can only be edited before fetching stock");
  p.script = parseScript(body, p.script, parseFilmLength(p.target_duration_sec), { owner: true }); p.status = "ready"; p.error = null; return saveProject(p); });
route("post", "fetch-stock", p => { if (!p.script || !["script", "cast"].includes(p.phase)) throw new Error("Review script before fetching stock"); return startOperation(p, "stock"); }, 202);
route("post", "scenes/:sceneId/pick", (p, body, sid) => {
  idle(p); if (p.phase !== "cast") throw new Error("Picks can only be edited in Cast");
  const scene = p.script?.scenes.find(s => s.id === sid); if (!scene) throw new Error("Scene not found");
  if (body.skip === true) { scene.status = "skipped"; scene.picked_upload_id = null; }
  else { const candidate = scene.candidates.find(c => c.upload_id === body.upload_id);
    if (!candidate || getUpload(candidate.upload_id)?.project_id !== p.id) throw new Error("Candidate does not belong to this scene and project");
    scene.status = "picked"; scene.picked_upload_id = candidate.upload_id; }
  return saveProject(p);
});
route("post", "assemble", (p, body) => {
  if (["studio", "exported"].includes(p.phase)) return p;
  if (p.phase !== "cast" || !p.script?.scenes.every(s => ["picked", "skipped"].includes(s.status)) || !p.script.scenes.some(s => s.status === "picked")) throw new Error("Pick or skip every scene; keep at least one pick");
  return startOperation(p, "assemble", typeof body.voice_id === "string" ? body.voice_id : undefined);
}, 202);
route("post", "cancel", p => cancelProject(p.id));
