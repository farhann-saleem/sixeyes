import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./env.js";
import type { AudioJob } from "./types.js";

const JOBS_PATH = path.join(DATA_DIR, "audio-jobs.json");
export const AUDIO_UPLOAD_DIR = path.join(DATA_DIR, "audio-uploads");
export const AUDIO_OUTPUT_DIR = path.join(DATA_DIR, "audio-outputs");

function ensureDirs() {
  mkdirSync(AUDIO_UPLOAD_DIR, { recursive: true });
  mkdirSync(AUDIO_OUTPUT_DIR, { recursive: true });
}

function readJobs(): AudioJob[] {
  ensureDirs();
  if (!existsSync(JOBS_PATH)) return [];
  try {
    const raw = JSON.parse(readFileSync(JOBS_PATH, "utf8"));
    return Array.isArray(raw) ? (raw as AudioJob[]) : [];
  } catch {
    return [];
  }
}

function writeJobs(jobs: AudioJob[]) {
  ensureDirs();
  writeFileSync(JOBS_PATH, JSON.stringify(jobs, null, 2) + "\n");
}

export function listAudioJobs(): AudioJob[] {
  return readJobs().sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getAudioJob(id: string): AudioJob | undefined {
  return readJobs().find((j) => j.id === id);
}

export function saveAudioJob(job: AudioJob): AudioJob {
  const jobs = readJobs();
  const i = jobs.findIndex((j) => j.id === job.id);
  job.updated_at = new Date().toISOString();
  if (i >= 0) jobs[i] = job;
  else jobs.push(job);
  writeJobs(jobs);
  return job;
}

export function audioInputPath(id: string, ext: string) {
  return path.join(AUDIO_UPLOAD_DIR, `${id}${ext.startsWith(".") ? ext : `.${ext}`}`);
}

export function audioOutputPath(id: string, suffix = ".mp3") {
  const s = suffix.startsWith(".") ? suffix : `.${suffix}`;
  return path.join(AUDIO_OUTPUT_DIR, `${id}${s}`);
}
