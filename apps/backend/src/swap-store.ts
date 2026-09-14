import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./env.js";
import type { SwapJob } from "./types.js";

const JOBS_PATH = path.join(DATA_DIR, "faceswaps.json");

function ensureDir() {
  mkdirSync(DATA_DIR, { recursive: true });
}

function normalize(job: SwapJob): SwapJob {
  return {
    ...job,
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

export function listSwapJobs(): SwapJob[] {
  return readJobs().sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getSwapJob(id: string): SwapJob | undefined {
  return readJobs().find((j) => j.id === id);
}

export function saveSwapJob(job: SwapJob): SwapJob {
  const jobs = readJobs();
  const i = jobs.findIndex((j) => j.id === job.id);
  job.updated_at = new Date().toISOString();
  if (i >= 0) jobs[i] = job;
  else jobs.push(job);
  writeJobs(jobs);
  return job;
}

export function deleteSwapJob(id: string): SwapJob | undefined {
  const jobs = readJobs();
  const i = jobs.findIndex((j) => j.id === id);
  if (i < 0) return undefined;
  const [job] = jobs.splice(i, 1);
  writeJobs(jobs);
  return job;
}
