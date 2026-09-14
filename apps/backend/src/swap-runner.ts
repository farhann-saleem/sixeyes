import { restoreArtifacts } from "./artifacts.js";
import { readFileSync } from "node:fs";
import { appendLedger, inputPath } from "./store.js";
import { getSwapJob, listSwapJobs, saveSwapJob } from "./swap-store.js";
import { ensureTemplateOnR2 } from "./templates.js";
import { r2Put } from "./r2.js";
import { extFromMime, mimeFromKey } from "./media.js";
import {
  cpuBlockedReason,
  cpuCancel,
  cpuHealth,
  cpuPing,
  cpuPoll,
  cpuSubmitSwap,
  unwrapCpu,
} from "./providers/cpu.js";
import type { CostLedgerRow, SwapJob, SwapPhase } from "./types.js";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function ledgerFrom(job: SwapJob): CostLedgerRow {
  return {
    at: new Date().toISOString(),
    job_id: job.id,
    provider: "cpu",
    status: job.status,
    duration_ms: job.duration_ms,
    estimated_usd: job.estimated_usd,
    usd_per_hour_assumed: job.usd_per_hour_assumed,
    quoted_credits: null,
    credit_cost: null,
    credits_remaining: null,
    error: job.error,
  };
}

function isStopped(job: SwapJob) {
  return job.status === "CANCELLED" || job.phase === "cancelled";
}

async function setPhase(job: SwapJob, phase: SwapPhase, phase_label: string) {
  const latest = await getSwapJob(job.id);
  if (latest && isStopped(latest)) return;
  job.phase = phase;
  job.phase_label = phase_label;
  await saveSwapJob(job);
}

async function fail(job: SwapJob, message: string) {
  const latest = await getSwapJob(job.id);
  if (latest && (isStopped(latest) || latest.status === "COMPLETED")) return;
  job.status = "FAILED";
  job.phase = "failed";
  job.phase_label = "Generate failed";
  job.error = message;
  job.duration_ms = job.duration_ms ?? Date.now() - Date.parse(job.created_at);
  await saveSwapJob(job);
  await appendLedger(ledgerFrom(job));
}

export async function cancelSwapJob(jobId: string): Promise<SwapJob> {
  const job = await getSwapJob(jobId);
  if (!job) throw new Error("not found");
  if (job.status === "COMPLETED") throw new Error("already completed");
  if (isStopped(job)) return job;

  job.status = "CANCELLED";
  job.phase = "cancelled";
  job.phase_label = "Stopped";
  job.error = "Stopped by you";
  job.duration_ms = Date.now() - Date.parse(job.created_at);
  await saveSwapJob(job);

  if (job.provider_job_id) {
    try {
      await cpuCancel(job.provider_job_id);
    } catch (err) {
      console.log("cpu cancel", job.id, err instanceof Error ? err.message : err);
    }
  }
  await appendLedger(ledgerFrom(job));
  return job;
}

export async function runSwapJob(jobId: string) {
  const job = await getSwapJob(jobId);
  if (!job) return;
  const started = Date.parse(job.created_at) || Date.now();
  try {
    await restoreArtifacts(job);
    if (job.provider_job_id) {
      await pollSwapUntilDone(job, started);
      return;
    }

    job.status = "IN_PROGRESS";
    await setPhase(job, "checking_runpod", "Checking CPU worker…");
    const health = await cpuHealth();
    const blocked = cpuBlockedReason(health);
    if (blocked) {
      await fail(job, blocked);
      return;
    }

    await setPhase(job, "uploading", "Uploading reference and look…");
    const faceExt = extFromMime(job.face_mime);
    await r2Put(job.face_r2_key, readFileSync(inputPath(job.id, faceExt)), job.face_mime);
    const template = await ensureTemplateOnR2(job.template_id);
    job.template_r2_key = template.r2_key;
    await saveSwapJob(job);

    await setPhase(job, "waking_runpod", "Starting generate…");
    const { ping } = await cpuPing();
    job.provider_meta = {
      ...job.provider_meta,
      ping_worker_id: ping.worker_id,
      ping_free_gb: ping.free_gb,
      volume_mounted: ping.volume_mounted,
    };
    await saveSwapJob(job);

    if (isStopped((await getSwapJob(job.id))!)) return;

    await setPhase(job, "swapping", job.kind === "video" ? "Generating video…" : "Generating image…");
    const runId = await cpuSubmitSwap(job.template_r2_key, job.face_r2_key);
    job.provider_job_id = runId;
    await saveSwapJob(job);

    await pollSwapUntilDone(job, started);
  } catch (err) {
    await fail(job, err instanceof Error ? err.message : String(err));
  }
}

async function pollSwapUntilDone(job: SwapJob, started: number) {
  if (!job.provider_job_id) {
    await fail(job, "missing RunPod job id — do not guess; start a new generate");
    return;
  }

  job.status = "IN_PROGRESS";
  await setPhase(job, "swapping", job.kind === "video" ? "Generating video…" : "Generating image…");

  // Still ~8s. Catalog 720p/30s video ~456s, plus ping/cold. Do not resubmit on this timeout.
  const minutes = job.kind === "video" ? 25 : 15;
  const deadline = started + minutes * 60 * 1000;
  let polls = 0;
  while (Date.now() < deadline) {
    const latest = await getSwapJob(job.id);
    if (!latest || isStopped(latest)) return;
    Object.assign(job, latest);

    const poll = await cpuPoll(job.provider_job_id);
    polls += 1;
    const out = unwrapCpu(poll.output);
    job.provider_meta = {
      ...job.provider_meta,
      runpod_status: poll.status,
      poll_count: polls,
      polled_at: new Date().toISOString(),
      worker_id: out.worker_id,
    };
    if (out.estimated_usd != null) job.estimated_usd = out.estimated_usd;
    if (out.usd_per_hour_assumed != null) job.usd_per_hour_assumed = out.usd_per_hour_assumed;
    if (out.duration_ms != null) job.duration_ms = out.duration_ms;
    await saveSwapJob(job);

    if (poll.status === "FAILED" || poll.status === "CANCELLED" || poll.status === "TIMED_OUT") {
      await fail(job, poll.error || out.error || `Generate ${poll.status}`);
      return;
    }

    if (poll.status === "COMPLETED") {
      if (out.ok === false) {
        await fail(job, out.error || "Generate returned ok=false");
        return;
      }
      if (!out.output_key) {
        await fail(job, "Generate completed with no output_key");
        return;
      }
      job.output_r2_key = out.output_key;
      const mime = mimeFromKey(out.output_key);
      job.output_mime = mime;
      job.status = "COMPLETED";
      job.phase = "done";
      job.phase_label = "Ready";
      job.error = null;
      job.duration_ms = job.duration_ms ?? Date.now() - started;
      await saveSwapJob(job);
      await appendLedger(ledgerFrom(job));
      return;
    }

    await sleep(3000);
  }
  await fail(
    job,
    `Generate still running after ${minutes} min. Same RunPod id — do not resubmit.`,
  );
}

export async function resumeInFlightSwapJobs() {
  for (const job of await listSwapJobs()) {
    if (job.status !== "PENDING" && job.status !== "IN_PROGRESS") continue;
    console.log("resume swap", job.id, job.provider_job_id);
    void runSwapJob(job.id);
  }
}
