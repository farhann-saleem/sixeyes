import { persistArtifacts } from "./artifacts.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./env.js";
import { db, dbEnabled, eq, ownerOf } from "./db.js";
import { isFilmLength } from "./film-length.js";
import type { GenerationStatus } from "./types.js";
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

function normalizeProject(p: StudioProject): StudioProject {
  return {
    ...p,
    owner_email: p.owner_email || "anonymous",
    topic: p.topic ?? "",
    target_duration_sec: isFilmLength(p.target_duration_sec) ? p.target_duration_sec : 60,
    phase: p.phase ?? "studio",
    status: p.status ?? "ready",
    script: p.script ?? null,
    tts_job_id: p.tts_job_id ?? null,
    error: p.error ?? null,
  };
}

function listQuery(opts: {
  owner?: string | null;
  projectId?: string;
  select?: string;
  order: string;
}): string {
  const parts: string[] = [];
  if (opts.owner) parts.push(eq("owner_email", opts.owner));
  if (opts.projectId) parts.push(eq("project_id", opts.projectId));
  parts.push(`select=${opts.select ?? "payload"}`);
  parts.push(`order=${opts.order}`);
  return parts.join("&");
}

export async function listProjects(ownerEmail?: string): Promise<StudioProject[]> {
  const owner = ownerEmail ? ownerOf(ownerEmail) : null;
  if (dbEnabled()) {
    const data = await db.select<{ payload: StudioProject }>(
      "studio_projects",
      listQuery({ owner, order: "updated_at.desc" }),
    );
    return data.map((r) => normalizeProject(r.payload));
  }
  const rows = readJson<StudioProject[]>(PROJECTS_PATH, []);
  const list = Array.isArray(rows) ? rows.map(normalizeProject) : [];
  const filtered = owner ? list.filter((p) => ownerOf(p.owner_email) === owner) : list;
  return filtered.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function getProject(id: string, ownerEmail?: string): Promise<StudioProject | undefined> {
  if (dbEnabled()) {
    const data = await db.selectOne<{ payload: StudioProject; owner_email: string }>(
      "studio_projects",
      `${eq("id", id)}&select=payload,owner_email`,
    );
    if (!data) return undefined;
    if (ownerEmail && ownerOf(data.owner_email) !== ownerOf(ownerEmail)) return undefined;
    return normalizeProject(data.payload);
  }
  const p = (await listProjects()).find((x) => x.id === id);
  if (!p) return undefined;
  if (ownerEmail && ownerOf(p.owner_email) !== ownerOf(ownerEmail)) return undefined;
  return p;
}

export async function saveProject(project: StudioProject): Promise<StudioProject> {
  project.owner_email = ownerOf(project.owner_email);
  project.updated_at = new Date().toISOString();
  const normalized = normalizeProject(project);
  if (dbEnabled()) {
    await db.upsert(
      "studio_projects",
      {
        id: normalized.id,
        owner_email: normalized.owner_email,
        payload: normalized,
        updated_at: normalized.updated_at,
        created_at: normalized.created_at,
      },
      "id",
    );
    return normalized;
  }
  const rows = readJson<StudioProject[]>(PROJECTS_PATH, []);
  const i = rows.findIndex((p) => p.id === project.id);
  if (i >= 0) rows[i] = normalized;
  else rows.push(normalized);
  writeJson(PROJECTS_PATH, rows);
  return normalized;
}

export async function deleteProject(id: string, ownerEmail?: string): Promise<StudioProject | undefined> {
  const row = await getProject(id, ownerEmail);
  if (!row) return undefined;
  if (dbEnabled()) {
    await db.delete("studio_projects", eq("id", id));
    return row;
  }
  const rows = readJson<StudioProject[]>(PROJECTS_PATH, []);
  const i = rows.findIndex((p) => p.id === id);
  if (i < 0) return undefined;
  const [gone] = rows.splice(i, 1);
  writeJson(PROJECTS_PATH, rows);
  return gone;
}

export async function listRenders(projectId?: string, ownerEmail?: string): Promise<StudioRenderJob[]> {
  const owner = ownerEmail ? ownerOf(ownerEmail) : null;
  if (dbEnabled()) {
    const data = await db.select<{ payload: StudioRenderJob }>(
      "studio_renders",
      listQuery({ owner, projectId, order: "created_at.desc" }),
    );
    return data.map((r) => ({
      ...r.payload,
      owner_email: r.payload.owner_email || owner || "anonymous",
    }));
  }
  const rows = readJson<StudioRenderJob[]>(RENDERS_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  return list
    .filter((r) => (!projectId || r.project_id === projectId) && (!owner || ownerOf(r.owner_email) === owner))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getRender(id: string, ownerEmail?: string): Promise<StudioRenderJob | undefined> {
  if (dbEnabled()) {
    const data = await db.selectOne<{ payload: StudioRenderJob; owner_email: string }>(
      "studio_renders",
      `${eq("id", id)}&select=payload,owner_email`,
    );
    if (!data) return undefined;
    if (ownerEmail && ownerOf(data.owner_email) !== ownerOf(ownerEmail)) return undefined;
    return data.payload;
  }
  const row = readJson<StudioRenderJob[]>(RENDERS_PATH, []).find((r) => r.id === id);
  if (!row) return undefined;
  if (ownerEmail && ownerOf(row.owner_email) !== ownerOf(ownerEmail)) return undefined;
  return row;
}

export async function saveRender(job: StudioRenderJob): Promise<StudioRenderJob> {
  job.owner_email = ownerOf(job.owner_email);
  job.updated_at = new Date().toISOString();
  if (dbEnabled()) {
    await db.upsert(
      "studio_renders",
      {
        id: job.id,
        owner_email: job.owner_email,
        project_id: job.project_id,
        status: job.status as GenerationStatus,
        payload: job,
        updated_at: job.updated_at,
        created_at: job.created_at,
      },
      "id",
    );
    return job;
  }
  const rows = readJson<StudioRenderJob[]>(RENDERS_PATH, []);
  const i = rows.findIndex((r) => r.id === job.id);
  if (i >= 0) rows[i] = job;
  else rows.push(job);
  writeJson(RENDERS_PATH, rows);
  return job;
}

export async function listUploads(projectId?: string, ownerEmail?: string): Promise<StudioUpload[]> {
  const owner = ownerEmail ? ownerOf(ownerEmail) : null;
  if (dbEnabled()) {
    const data = await db.select<{ payload: StudioUpload }>(
      "studio_uploads",
      listQuery({ owner, projectId, order: "created_at.desc" }),
    );
    return data.map((r) => {
      const u = r.payload;
      return { ...u, project_id: u.project_id ?? null, owner_email: u.owner_email || owner || "anonymous" };
    });
  }
  const rows = readJson<StudioUpload[]>(UPLOADS_PATH, []);
  return Array.isArray(rows)
    ? rows
        .map((u) => ({ ...u, project_id: u.project_id ?? null, owner_email: u.owner_email || "anonymous" }))
        .filter(
          (u) =>
            (projectId === undefined || u.project_id === projectId) &&
            (!owner || ownerOf(u.owner_email) === owner),
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
    : [];
}

export async function getUpload(id: string, ownerEmail?: string): Promise<StudioUpload | undefined> {
  if (dbEnabled()) {
    const data = await db.selectOne<{ payload: StudioUpload; owner_email: string }>(
      "studio_uploads",
      `${eq("id", id)}&select=payload,owner_email`,
    );
    if (!data) return undefined;
    if (ownerEmail && ownerOf(data.owner_email) !== ownerOf(ownerEmail)) return undefined;
    return data.payload;
  }
  const u = (await listUploads()).find((x) => x.id === id);
  if (!u) return undefined;
  if (ownerEmail && ownerOf(u.owner_email) !== ownerOf(ownerEmail)) return undefined;
  return u;
}

export async function saveUpload(row: StudioUpload): Promise<StudioUpload> {
  row.owner_email = ownerOf(row.owner_email);

  if (dbEnabled()) {
    await db.upsert(
      "studio_uploads",
      {
        id: row.id,
        owner_email: row.owner_email,
        project_id: row.project_id,
        payload: row,
        created_at: row.created_at,
      },
      "id",
    );
    return row;
  }
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
