import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./env.js";
import type { StudioProject, StudioRenderJob, StudioUpload } from "./studio-types.js";

const PROJECTS_PATH = path.join(DATA_DIR, "studio-projects.json");
const RENDERS_PATH = path.join(DATA_DIR, "studio-renders.json");
const UPLOADS_PATH = path.join(DATA_DIR, "studio-uploads.json");

export const STUDIO_UPLOAD_DIR = path.join(DATA_DIR, "studio-uploads");
export const STUDIO_RENDER_DIR = path.join(DATA_DIR, "studio-renders");
export const STUDIO_WORK_DIR = path.join(DATA_DIR, "studio-work");

function ensureDirs() {
  mkdirSync(STUDIO_UPLOAD_DIR, { recursive: true });
  mkdirSync(STUDIO_RENDER_DIR, { recursive: true });
  mkdirSync(STUDIO_WORK_DIR, { recursive: true });
}

function readJson<T>(file: string, fallback: T): T {
  ensureDirs();
  if (!existsSync(file)) return fallback;
  try {
    const raw = JSON.parse(readFileSync(file, "utf8"));
    return raw as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, value: unknown) {
  ensureDirs();
  writeFileSync(`${file}.tmp`, JSON.stringify(value, null, 2) + "\n");
  renameSync(`${file}.tmp`, file);
}

export function listProjects(): StudioProject[] {
  const rows = readJson<StudioProject[]>(PROJECTS_PATH, []);
  return Array.isArray(rows) ? rows.map((p) => ({ ...p, topic: p.topic ?? "", phase: p.phase ?? "studio", status: p.status ?? "ready", script: p.script ?? null, tts_job_id: p.tts_job_id ?? null, error: p.error ?? null })).sort((a, b) => b.updated_at.localeCompare(a.updated_at)) : [];
}

export function getProject(id: string): StudioProject | undefined {
  return listProjects().find((p) => p.id === id);
}

export function saveProject(project: StudioProject): StudioProject {
  const rows = readJson<StudioProject[]>(PROJECTS_PATH, []);
  project.updated_at = new Date().toISOString();
  const i = rows.findIndex((p) => p.id === project.id);
  if (i >= 0) rows[i] = project;
  else rows.push(project);
  writeJson(PROJECTS_PATH, rows);
  return project;
}

export function deleteProject(id: string): StudioProject | undefined {
  const rows = readJson<StudioProject[]>(PROJECTS_PATH, []);
  const i = rows.findIndex((p) => p.id === id);
  if (i < 0) return undefined;
  const [row] = rows.splice(i, 1);
  writeJson(PROJECTS_PATH, rows);
  return row;
}

export function listRenders(projectId?: string): StudioRenderJob[] {
  const rows = readJson<StudioRenderJob[]>(RENDERS_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  const filtered = projectId ? list.filter((r) => r.project_id === projectId) : list;
  return filtered.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getRender(id: string): StudioRenderJob | undefined {
  return readJson<StudioRenderJob[]>(RENDERS_PATH, []).find((r) => r.id === id);
}

export function saveRender(job: StudioRenderJob): StudioRenderJob {
  const rows = readJson<StudioRenderJob[]>(RENDERS_PATH, []);
  job.updated_at = new Date().toISOString();
  const i = rows.findIndex((r) => r.id === job.id);
  if (i >= 0) rows[i] = job;
  else rows.push(job);
  writeJson(RENDERS_PATH, rows);
  return job;
}

export function listUploads(projectId?: string): StudioUpload[] {
  const rows = readJson<StudioUpload[]>(UPLOADS_PATH, []);
  return Array.isArray(rows) ? rows.map((u) => ({ ...u, project_id: u.project_id ?? null })).filter((u) => projectId === undefined || u.project_id === projectId).sort((a, b) => b.created_at.localeCompare(a.created_at)) : [];
}

export function getUpload(id: string): StudioUpload | undefined {
  return listUploads().find((u) => u.id === id);
}

export function saveUpload(row: StudioUpload): StudioUpload {
  const rows = readJson<StudioUpload[]>(UPLOADS_PATH, []);
  const i = rows.findIndex((u) => u.id === row.id);
  if (i >= 0) rows[i] = row;
  else rows.push(row);
  writeJson(UPLOADS_PATH, rows);
  return row;
}

export function studioUploadPath(id: string, ext: string) {
  const e = ext.startsWith(".") ? ext : `.${ext}`;
  return path.join(STUDIO_UPLOAD_DIR, `${id}${e}`);
}

export function studioRenderPath(id: string, ext = ".mp4") {
  const e = ext.startsWith(".") ? ext : `.${ext}`;
  return path.join(STUDIO_RENDER_DIR, `${id}${e}`);
}
