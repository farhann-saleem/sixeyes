import { persistArtifacts } from "./artifacts.js";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./env.js";
import { db, dbEnabled, eq, ownerOf } from "./db.js";
import type { AudioJob, GenerationStatus } from "./types.js";

const JOBS_PATH = path.join(DATA_DIR, "audio-jobs.json");
export const AUDIO_UPLOAD_DIR = path.join(DATA_DIR, "audio-uploads");
export const AUDIO_OUTPUT_DIR = path.join(DATA_DIR, "audio-outputs");

function ensureDirs() {
  mkdirSync(AUDIO_UPLOAD_DIR, { recursive: true });
  mkdirSync(AUDIO_OUTPUT_DIR, { recursive: true });
}

function normalize(job: AudioJob): AudioJob {
  return { ...job, owner_email: job.owner_email || "anonymous" };
}

function readJobs(): AudioJob[] {
  ensureDirs();
  if (!existsSync(JOBS_PATH)) return [];
  try {
    const raw = JSON.parse(readFileSync(JOBS_PATH, "utf8"));
    return Array.isArray(raw) ? (raw as AudioJob[]).map(normalize) : [];
  } catch {
    return [];
  }
}

function writeJobs(jobs: AudioJob[]) {
  ensureDirs();
  writeFileSync(JOBS_PATH, JSON.stringify(jobs, null, 2) + "\n");
}

export async function listAudioJobs(ownerEmail?: string): Promise<AudioJob[]> {
  const owner = ownerEmail ? ownerOf(ownerEmail) : null;
  if (dbEnabled()) {
    const query = owner
      ? `${eq("owner_email", owner)}&select=payload&order=updated_at.desc`
      : `select=payload&order=updated_at.desc`;
    const data = await db.select<{ payload: AudioJob }>("audio_jobs", query);
    return data.map((r) => normalize(r.payload));
  }
  const all = readJobs().sort((a, b) => b.created_at.localeCompare(a.created_at));
  return owner ? all.filter((j) => ownerOf(j.owner_email) === owner) : all;
}

export async function getAudioJob(id: string, ownerEmail?: string): Promise<AudioJob | undefined> {
  if (dbEnabled()) {
    const data = await db.selectOne<{ payload: AudioJob; owner_email: string }>(
      "audio_jobs",
      `${eq("id", id)}&select=payload,owner_email`,
    );
    if (!data) return undefined;
    if (ownerEmail && ownerOf(data.owner_email) !== ownerOf(ownerEmail)) return undefined;
    return normalize(data.payload);
  }
  const job = readJobs().find((j) => j.id === id);
  if (!job) return undefined;
  if (ownerEmail && ownerOf(job.owner_email) !== ownerOf(ownerEmail)) return undefined;
  return job;
}

export async function saveAudioJob(job: AudioJob): Promise<AudioJob> {
  job.owner_email = ownerOf(job.owner_email);
  await persistArtifacts(job, ["audio-uploads", "audio-outputs"]);
  job.updated_at = new Date().toISOString();
  const normalized = normalize(job);
  if (dbEnabled()) {
    await db.upsert(
      "audio_jobs",
      {
        id: normalized.id,
        owner_email: normalized.owner_email,
        status: normalized.status as GenerationStatus,
        payload: normalized,
        updated_at: normalized.updated_at,
        created_at: normalized.created_at,
      },
      "id",
    );
    return normalized;
  }
  const jobs = readJobs();
  const i = jobs.findIndex((j) => j.id === job.id);
  if (i >= 0) jobs[i] = normalized;
  else jobs.push(normalized);
  writeJobs(jobs);
  return normalized;
}

export function audioInputPath(id: string, ext: string) {
  return path.join(AUDIO_UPLOAD_DIR, `${id}${ext.startsWith(".") ? ext : `.${ext}`}`);
}

export function audioOutputPath(id: string, suffix = ".mp3") {
  const s = suffix.startsWith(".") ? suffix : `.${suffix}`;
  return path.join(AUDIO_OUTPUT_DIR, `${id}${s}`);
}
