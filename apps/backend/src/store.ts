import { persistArtifacts } from "./artifacts.js";
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./env.js";
import { db, dbEnabled, eq, ownerOf } from "./db.js";
import type { AvatarJob, CostLedgerRow, GenerationStatus } from "./types.js";

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
    owner_email: job.owner_email || "anonymous",
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

export async function listJobs(ownerEmail?: string): Promise<AvatarJob[]> {
  const owner = ownerEmail ? ownerOf(ownerEmail) : null;
  if (dbEnabled()) {
    const query = owner
      ? `${eq("owner_email", owner)}&select=payload&order=updated_at.desc`
      : `select=payload&order=updated_at.desc`;
    const data = await db.select<{ payload: AvatarJob }>("avatar_jobs", query);
    return data.map((r) => normalize(r.payload));
  }
  const all = readJobs().sort((a, b) => b.created_at.localeCompare(a.created_at));
  return owner ? all.filter((j) => ownerOf(j.owner_email) === owner) : all;
}

export async function getJob(id: string, ownerEmail?: string): Promise<AvatarJob | undefined> {
  if (dbEnabled()) {
    const data = await db.selectOne<{ payload: AvatarJob; owner_email: string }>(
      "avatar_jobs",
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

export async function saveJob(job: AvatarJob): Promise<AvatarJob> {
  job.owner_email = ownerOf(job.owner_email);
  await persistArtifacts(job, ["uploads", "outputs"]);
  job.updated_at = new Date().toISOString();
  const normalized = normalize(job);
  if (dbEnabled()) {
    await db.upsert(
      "avatar_jobs",
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

export async function appendLedger(row: CostLedgerRow & { owner_email?: string }) {
  const owner = ownerOf(row.owner_email || (row as { email?: string }).email);
  if (dbEnabled()) {
    await db.insert("cost_ledger", {
      owner_email: owner,
      payload: { ...row, owner_email: owner },
    });
    return;
  }
  ensureDirs();
  writeFileSync(LEDGER_PATH, JSON.stringify({ ...row, owner_email: owner }) + "\n", { flag: "a" });
}

export function inputPath(id: string, ext: string) {
  return path.join(UPLOAD_DIR, `${id}${ext}`);
}

export function outputPath(id: string, ext = ".png") {
  return path.join(OUTPUT_DIR, `${id}${ext}`);
}
