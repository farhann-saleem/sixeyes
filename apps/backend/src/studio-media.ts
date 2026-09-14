import { artifactName, restoreArtifact } from "./artifacts.js";
import { existsSync } from "node:fs";
import path from "node:path";
import { getAudioJob, listAudioJobs, audioOutputPath } from "./audio-store.js";
import { extFromMime } from "./media.js";
import { outputPath } from "./store.js";
import { listSwapJobs, getSwapJob } from "./swap-store.js";
import { getImageTemplate, getVideoTemplate, labelFromImageFilename, labelFromVideoFilename, listEffectTemplates, listImageTemplates, listVideoTemplates } from "./templates.js";
import { listProjects, getUpload, listUploads, studioUploadPath } from "./studio-store.js";
import type { StudioClip, StudioClipSource, StudioProject } from "./studio-types.js";

export type MediaItem = {
  id: string;
  origin: StudioClipSource["type"];
  kind: "video" | "image" | "audio";
  label: string;
  duration_s: number | null;
  preview_url: string;
  poster_url?: string;
  bytes?: number;
  bin?: "sfx" | "music" | "voice";
};

export async function listStudioMedia(
  projectId?: string,
  ownerEmail?: string,
): Promise<{ templates: MediaItem[]; library: MediaItem[]; audio: MediaItem[]; uploads: MediaItem[] }> {
  const templates: MediaItem[] = [
    ...listVideoTemplates().map((t) => ({
      id: t.id,
      origin: "video-template" as const,
      kind: "video" as const,
      label: labelFromVideoFilename(t.filename),
      duration_s: t.duration_s,
      preview_url: t.video_url,
      poster_url: t.poster_url,
      bytes: t.bytes,
    })),
    ...listEffectTemplates().map((t) => ({
      id: t.id,
      origin: "video-template" as const,
      kind: "video" as const,
      label: labelFromVideoFilename(t.filename),
      duration_s: t.duration_s,
      preview_url: t.video_url,
      poster_url: t.poster_url,
      bytes: t.bytes,
    })),
    ...listImageTemplates().map((t) => ({
      id: t.id,
      origin: "image-template" as const,
      kind: "image" as const,
      label: labelFromImageFilename(t.filename),
      duration_s: 5,
      preview_url: t.image_url,
      poster_url: t.image_url,
      bytes: t.bytes,
    })),
  ];

  const library: MediaItem[] = (await listSwapJobs(ownerEmail))
    .filter((j) => j.status === "COMPLETED")
    .map((j) => ({
      id: j.id,
      origin: "library" as const,
      kind: j.kind === "video" ? ("video" as const) : ("image" as const),
      label: j.kind === "video" ? "Library video" : "Library image",
      duration_s: j.kind === "video" ? (j.duration_ms ? j.duration_ms / 1000 : null) : 5,
      preview_url: `/api/faceswaps/${j.id}/output`,
      poster_url: j.kind === "video" ? undefined : `/api/faceswaps/${j.id}/output`,
    }));

  const projects = await listProjects(ownerEmail);
  const audio: MediaItem[] = (await listAudioJobs(ownerEmail))
    .filter((j) => {
      if (j.status !== "COMPLETED") return false;
      if (j.kind === "stt" || j.kind === "clone") return false;
      const owner = projects.find((p) => p.tts_job_id === j.id);
      if (owner && owner.id !== projectId) return false;
      return true;
    })
    .map((j) => ({
      id: j.id,
      origin: "audio" as const,
      kind: "audio" as const,
      label: j.title || j.kind,
      duration_s: j.duration_ms ? j.duration_ms / 1000 : null,
      preview_url: `/api/audio/jobs/${j.id}/output`,
      bin: j.kind === "sfx" ? "sfx" : j.kind === "music" ? "music" : "voice",
    }));

  const uploads: MediaItem[] = (await listUploads(projectId === undefined ? undefined : projectId, ownerEmail))
    .filter((u) => (projectId ? u.project_id === projectId : u.project_id === null))
    .map((u) => ({
      id: u.id,
      origin: "upload" as const,
      kind: u.kind,
      label: u.filename,
      duration_s: u.duration_s,
      preview_url: `/api/studio/uploads/${u.id}/file`,
      bytes: u.bytes,
    }));

  return { templates, library, audio, uploads };
}

export function previewUrlFor(source: StudioClipSource, kind: StudioClip["kind"]): string | undefined {
  if (source.type === "video-template") {
    const t = getVideoTemplate(source.id);
    return t?.video_url ?? `/api/video-templates/${source.id}/video`;
  }
  if (source.type === "image-template") return `/api/image-templates/${source.id}/image`;
  if (source.type === "library") return `/api/faceswaps/${source.id}/output`;
  if (source.type === "audio") return `/api/audio/jobs/${source.id}/output`;
  if (source.type === "upload") return `/api/studio/uploads/${source.id}/file`;
  if (source.type === "text") return undefined;
  void kind;
  return undefined;
}

export type ResolvedSource = {
  file: string;
  mime: string;
  r2_key: string | null;
  duration_s: number | null;
};

export async function resolveSource(source: StudioClipSource): Promise<ResolvedSource> {
  if (source.type === "video-template") {
    const t = getVideoTemplate(source.id);
    if (!t || !existsSync(t.abs_path)) throw new Error(`video template ${source.id} missing`);
    return { file: t.abs_path, mime: t.mime, r2_key: t.r2_key, duration_s: t.duration_s };
  }
  if (source.type === "image-template") {
    const t = getImageTemplate(source.id);
    if (!t || !existsSync(t.abs_path)) throw new Error(`image template ${source.id} missing`);
    return { file: t.abs_path, mime: t.mime, r2_key: t.r2_key, duration_s: 5 };
  }
  if (source.type === "library") {
    const job = await getSwapJob(source.id);
    if (!job || job.status !== "COMPLETED" || !job.output_mime) throw new Error(`library item ${source.id} not ready`);
    const file = outputPath(job.id, extFromMime(job.output_mime));
    if (!job.output_r2_key && !existsSync(file)) throw new Error(`library file ${source.id} missing`);
    return {
      file,
      mime: job.output_mime,
      r2_key: job.output_r2_key,
      duration_s: job.kind === "video" ? (job.duration_ms ? job.duration_ms / 1000 : null) : 5,
    };
  }
  if (source.type === "audio") {
    const file = audioOutputPath(source.id, ".mp3");
    const row = await getAudioJob(source.id);
    if (!row) throw new Error("Audio not found");
    const key = row.artifacts?.[artifactName(file)] || null;
    if (!key && !existsSync(file)) throw new Error(`audio ${source.id} missing`);
    return { file, mime: "audio/mpeg", r2_key: key, duration_s: null };
  }
  if (source.type === "upload") {
    const row = await getUpload(source.id);
    if (!row) throw new Error(`upload ${source.id} missing`);
    const ext = path.extname(row.filename) || extFromMime(row.mime);
    const file = studioUploadPath(row.id, ext);
    if (!row.r2_key && !existsSync(file)) throw new Error(`upload file ${source.id} missing`);
    return { file, mime: row.mime, r2_key: row.r2_key, duration_s: row.duration_s };
  }
  throw new Error("text clips have no media file");
}

/** Enforced for add, PATCH, legacy create-from and export; UI filtering alone is insufficient. */
export async function sourceScopeError(project: StudioProject, source: StudioClipSource): Promise<string | null> {
  if (source.type === "upload") {
    const row = await getUpload(source.id, project.owner_email || "anonymous");
    if (!row || (row.project_id !== null && row.project_id !== project.id) || (project.topic && row.project_id !== project.id)) return "Upload does not belong to this project";
  }
  if (source.type === "library" && !(await getSwapJob(source.id, project.owner_email || "anonymous"))) return "Library item does not belong to you";
  if (source.type === "audio") {
    if (!(await getAudioJob(source.id, project.owner_email || "anonymous"))) return "Audio does not belong to you";
    const owner = (await listProjects()).find((p) => p.tts_job_id === source.id);
    if (owner && owner.id !== project.id) return "Audio does not belong to this project";
  }
  return null;
}
export async function projectScopeError(project: StudioProject): Promise<string | null> {
  for (const clip of project.clips) {
    const error = await sourceScopeError(project, clip.source);
    if (error) return error;
  }
  return null;
}
