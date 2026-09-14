import { writeFileSync } from "node:fs";
import { appendLedger } from "./store.js";
import type { CostLedgerRow } from "./types.js";
import { r2Get } from "./r2.js";
import {
  cpuBlockedReason,
  cpuCancel,
  cpuHealth,
  cpuPing,
  cpuPoll,
  cpuSubmitStitch,
  unwrapCpu,
} from "./providers/cpu.js";
import { buildCloudPlan } from "./studio-cloud-plan.js";
import { getProject, getRender, listRenders, saveRender, saveProject, studioRenderPath } from "./studio-store.js";
import { validateProject } from "./studio-timeline.js";
import type { StudioProject, StudioRenderJob } from "./studio-types.js";
import { mimeFromKey } from "./media.js";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function ledgerFrom(job: StudioRenderJob): CostLedgerRow {
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

function isStopped(job: StudioRenderJob | undefined) {
  return !job || job.status === "CANCELLED";
}

function setPhase(job: StudioRenderJob, phase: string, phase_label: string) {
  const latest = getRender(job.id);
  if (latest && isStopped(latest)) return;
  job.phase = phase;
  job.phase_label = phase_label;
  saveRender(job);
}

function fail(job: StudioRenderJob, message: string) {
  const latest = getRender(job.id);
  if (latest && (isStopped(latest) || latest.status === "COMPLETED")) return;
  job.status = "FAILED";
  job.phase = "failed";
  job.phase_label = "Render failed";
  job.error = message;
  job.duration_ms = job.duration_ms ?? Date.now() - Date.parse(job.created_at);
  saveRender(job);
  appendLedger(ledgerFrom(job));
}

export async function cancelStudioRender(jobId: string): Promise<StudioRenderJob> {
  const job = getRender(jobId);
  if (!job) throw new Error("not found");
  if (job.status === "COMPLETED") throw new Error("already completed");
  if (isStopped(job)) return job;
  job.status = "CANCELLED";
  job.phase = "cancelled";
  job.phase_label = "Stopped";
  job.error = "Stopped by you";
  job.duration_ms = Date.now() - Date.parse(job.created_at);
  saveRender(job);
  if (job.provider_job_id) {
    try {
      await cpuCancel(job.provider_job_id);
    } catch (err) {
      console.log("cpu cancel stitch", job.id, err instanceof Error ? err.message : err);
    }
  }
  appendLedger(ledgerFrom(job));
  return job;
}

function even(n: number) {
  const v = Math.max(2, Math.round(n));
  return v % 2 === 0 ? v : v + 1;
}

export async function runStudioRender(jobId: string) {
  const job = getRender(jobId);
  if (!job) return;
  const started = Date.parse(job.created_at) || Date.now();
  try {
    if (job.provider_job_id) {
      await pollStitchUntilDone(job, started);
      return;
    }

    const project = (job.provider_meta.project_snapshot as StudioProject | undefined) || getProject(job.project_id);
    if (!project) {
      fail(job, "project missing");
      return;
    }
    const invalid = validateProject(project);
    if (invalid) {
      fail(job, invalid);
      return;
    }
    if (!project.clips.length) {
      fail(job, "timeline is empty");
      return;
    }
    job.status = "IN_PROGRESS";
    setPhase(job, "checking_runpod", "Checking CPU worker…");
    const health = await cpuHealth();
    const blocked = cpuBlockedReason(health);
    if (blocked) {
      fail(job, blocked);
      return;
    }

    setPhase(job, "preparing", "Preparing cloud timeline…");
    const timeline = await buildCloudPlan(project, job.id);
    if (!timeline.slices.length || timeline.slices.length > 100) throw new Error("Timeline needs 1–100 visual slices");
    const clipKeys = timeline.slices.flatMap(s => s.key ? [s.key] : []);
    if (isStopped(getRender(job.id))) return;
    job.clip_keys = clipKeys;
    saveRender(job);

    setPhase(job, "waking_runpod", "Waking CPU stitch worker…");
    const { ping } = await cpuPing("stitch");
    if (isStopped(getRender(job.id))) return;
    if (ping.timeline_version !== 1) throw new Error("CPU worker needs timeline-v1 deployment for cloud-only export. No local rendering or incompatible stitch submission was attempted.");
    job.provider_meta = {
      ...job.provider_meta,
      ping_worker_id: ping.worker_id,
      ping_free_gb: ping.free_gb,
      volume_mounted: ping.volume_mounted,
      slice_count: timeline.slices.length,
    };
    saveRender(job);
    if (isStopped(getRender(job.id)!)) return;

    setPhase(job, "stitching", "Stitching on RunPod CPU…");
    const runId = await cpuSubmitStitch({
      clip_keys: clipKeys,
      timeline,
      width: even(project.width),
      height: even(project.height),
      fps: project.fps,
    });
    job.provider_job_id = runId;
    if (isStopped(getRender(job.id))) {
      const stopped = getRender(job.id); if (stopped) { stopped.provider_job_id = runId; saveRender(stopped); }
      await cpuCancel(runId); return;
    }
    saveRender(job);
    await pollStitchUntilDone(job, started);
  } catch (err) {
    fail(job, err instanceof Error ? err.message : String(err));
  }
}

async function pollStitchUntilDone(job: StudioRenderJob, started: number) {
  if (!job.provider_job_id) {
    fail(job, "missing RunPod job id — do not guess; start a new render");
    return;
  }
  job.status = "IN_PROGRESS";
  setPhase(job, "stitching", "Stitching on RunPod CPU…");
  const deadline = started + 25 * 60 * 1000;
  let polls = 0;
  while (Date.now() < deadline) {
    const latest = getRender(job.id);
    if (!latest || isStopped(latest)) return;
    Object.assign(job, latest);
    const poll = await cpuPoll(job.provider_job_id);
    if (isStopped(getRender(job.id))) return;
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
    saveRender(job);

    if (poll.status === "FAILED" || poll.status === "CANCELLED" || poll.status === "TIMED_OUT") {
      fail(job, poll.error || out.error || `CPU stitch ${poll.status}`);
      return;
    }
    if (poll.status === "COMPLETED") {
      if (out.ok === false) {
        fail(job, out.error || "CPU stitch returned ok=false");
        return;
      }
      if (!out.output_key) {
        fail(job, "CPU stitch completed with no output_key");
        return;
      }
      job.output_r2_key = out.output_key;
      const buf = await r2Get(out.output_key);
      if (isStopped(getRender(job.id))) return;
      writeFileSync(studioRenderPath(job.id, ".mp4"), buf);
      job.output_mime = mimeFromKey(out.output_key) || "video/mp4";
      job.status = "COMPLETED";
      job.phase = "done";
      job.phase_label = "Render ready";
      job.error = null;
      job.duration_ms = job.duration_ms ?? Date.now() - started;
      saveRender(job);
      const project = getProject(job.project_id);
      const snapshot = job.provider_meta.project_snapshot as StudioProject | undefined;
      if (project && snapshot && JSON.stringify(project.clips) === JSON.stringify(snapshot.clips) && JSON.stringify(project.tracks) === JSON.stringify(snapshot.tracks) && project.width === snapshot.width && project.height === snapshot.height && project.fps === snapshot.fps) {
        project.phase = "exported"; saveProject(project);
      }
      appendLedger(ledgerFrom(job));
      return;
    }
    await sleep(3000);
  }
  fail(job, "CPU stitch still running after 25 min. Same RunPod id — do not resubmit.");
}

export function resumeInFlightStudioRenders() {
  for (const job of listRenders()) {
    if (job.status !== "PENDING" && job.status !== "IN_PROGRESS") continue;
    console.log("resume studio render", job.id, job.provider_job_id);
    if (job.provider_job_id) void runStudioRender(job.id);
    else fail(job, "Backend restarted before a provider id was saved. Check the CPU queue before starting a new render; no automatic resubmission.");
  }
}
