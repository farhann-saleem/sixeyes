import { persistArtifacts } from "./artifacts.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./env.js";
import { db, dbEnabled, eq, ownerOf } from "./db.js";
import type { GenerationStatus, SwapJob } from "./types.js";

const JOBS_PATH = path.join(DATA_DIR, "faceswaps.json");

function ensureDir() {
  mkdirSync(DATA_DIR, { recursive: true });
}

function normalize(job: SwapJob): SwapJob {
  return {
    ...job,
    owner_email: job.owner_email || "anonymous",
    kind: job.kind === "video" ? "video" : "image",
  };
}

function readJobs(): SwapJob[] {
  ensureDir();
  if (!existsSync(JOBS_PATH)) return [];
  try {
    const raw = JSON.parse(readFileSync(JOBS_PATH, "utf8"));
    return Array.isArray(raw) ? (raw as SwapJob[]).map(normalize) : [];
  } catch {
    return [];
  }
}

function writeJobs(jobs: SwapJob[]) {
  ensureDir();
  writeFileSync(JOBS_PATH, JSON.stringify(jobs, null, 2) + "\n");
}

export async function listSwapJobs(ownerEmail?: string): Promise<SwapJob[]> {
  const owner = ownerEmail ? ownerOf(ownerEmail) : null;
  if (dbEnabled()) {
    const query = owner
      ? `${eq("owner_email", owner)}&select=payload&order=updated_at.desc`
      : `select=payload&order=updated_at.desc`;
    const data = await db.select<{ payload: SwapJob }>("swap_jobs", query);
    return data.map((r) => normalize(r.payload));
  }
  const all = readJobs().sort((a, b) => b.created_at.localeCompare(a.created_at));
  return owner ? all.filter((j) => ownerOf(j.owner_email) === owner) : all;
}

export async function getSwapJob(id: string, ownerEmail?: string): Promise<SwapJob | undefined> {
  if (dbEnabled()) {
    const data = await db.selectOne<{ payload: SwapJob; owner_email: string }>(
      "swap_jobs",
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

export async function saveSwapJob(job: SwapJob): Promise<SwapJob> {
  job.owner_email = ownerOf(job.owner_email);
  await persistArtifacts(job, ["uploads"]);
  job.updated_at = new Date().toISOString();
  const normalized = normalize(job);
  if (dbEnabled()) {
    await db.upsert(
      "swap_jobs",
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

export async function deleteSwapJob(id: string, ownerEmail?: string): Promise<SwapJob | undefined> {
  const job = await getSwapJob(id, ownerEmail);
  if (!job) return undefined;
  if (dbEnabled()) {
    await db.delete("swap_jobs", eq("id", id));
    return job;
  }
  const jobs = readJobs();
  const i = jobs.findIndex((j) => j.id === id);
  if (i < 0) return undefined;
  const [row] = jobs.splice(i, 1);
  writeJobs(jobs);
  return row;
}
