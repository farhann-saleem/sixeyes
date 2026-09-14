import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./env.js";
import type { AvatarJob, CostLedgerRow } from "./types.js";

const JOBS_PATH = path.join(DATA_DIR, "jobs.json");
const LEDGER_PATH = path.join(DATA_DIR, "cost-ledger.jsonl");

export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
export const OUTPUT_DIR = path.join(DATA_DIR, "outputs");

function ensureDirs() {
  mkdirSync(UPLOAD_DIR, { recursive: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

function extFromMime(mime: string) {
  if (mime.includes("jpeg") || mime.includes("jpg")) return ".jpg";
  if (mime.includes("webp")) return ".webp";
  return ".png";
}

function normalize(job: AvatarJob): AvatarJob {
  const failed = job.status === "FAILED";
  const done = job.status === "COMPLETED";
  const stopped = job.status === "CANCELLED";
  const file = inputPath(job.id, extFromMime(job.input_mime));
  return {
    ...job,
    phase:
      job.phase ??
      (failed ? "failed" : done ? "done" : stopped ? "cancelled" : "queued"),
    phase_label:
      job.phase_label ??
      (failed
        ? "Failed — try the other model"
        : done
          ? "Avatar ready"
          : stopped
            ? "Stopped"
            : "Queued…"),
    suggest_provider:
      job.suggest_provider ??
      (failed || stopped ? (job.provider === "qwen" ? "ai33pro" : "qwen") : null),
    input_bytes: existsSync(file) ? statSync(file).size : null,
    name: job.name || "Untitled avatar",
  };
}

function readJobs(): AvatarJob[] {
  ensureDirs();
  if (!existsSync(JOBS_PATH)) return [];
  try {
    const raw = JSON.parse(readFileSync(JOBS_PATH, "utf8"));
    return (Array.isArray(raw) ? raw : []).map((j) => normalize(j as AvatarJob));
  } catch {
    return [];
  }
}

function writeJobs(jobs: AvatarJob[]) {
  ensureDirs();
  writeFileSync(JOBS_PATH, JSON.stringify(jobs, null, 2) + "\n");
}

export function listJobs(): AvatarJob[] {
  return readJobs().sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getJob(id: string): AvatarJob | undefined {
  return readJobs().find((j) => j.id === id);
}

export function saveJob(job: AvatarJob): AvatarJob {
  const jobs = readJobs();
  const i = jobs.findIndex((j) => j.id === job.id);
  job.updated_at = new Date().toISOString();
  if (i >= 0) jobs[i] = job;
  else jobs.push(job);
  writeJobs(jobs);
  return job;
}

export function appendLedger(row: CostLedgerRow) {
  ensureDirs();
  writeFileSync(LEDGER_PATH, JSON.stringify(row) + "\n", { flag: "a" });
}

export function inputPath(id: string, ext: string) {
  return path.join(UPLOAD_DIR, `${id}${ext}`);
}

export function outputPath(id: string, ext = ".png") {
  return path.join(OUTPUT_DIR, `${id}${ext}`);
}
