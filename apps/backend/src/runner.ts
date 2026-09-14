import { restoreArtifacts } from "./artifacts.js";
import { readFileSync, writeFileSync } from "node:fs";
import { appendLedger, getJob, inputPath, listJobs, outputPath, saveJob } from "./store.js";
import { extFromMime } from "./media.js";
import type { AvatarJob, AvatarProvider, CostLedgerRow, JobPhase } from "./types.js";
import { ai33Credits, ai33Delete, ai33Generate, ai33Poll, ai33Quote, extractImageUrl } from "./providers/ai33pro.js";
import { isOpenRouterProvider, openrouterGenerate } from "./providers/openrouter.js";
import { qwenBlockedReason, qwenCancel, qwenHealth, qwenPing, qwenPoll, qwenSubmit } from "./providers/qwen.js";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function ledgerFrom(job: AvatarJob): CostLedgerRow {
  return {
    at: new Date().toISOString(),
    job_id: job.id,
    provider: job.provider,
    status: job.status,
    duration_ms: job.duration_ms,
    estimated_usd: job.estimated_usd,
    usd_per_hour_assumed: job.usd_per_hour_assumed,
    quoted_credits: job.quoted_credits,
    credit_cost: job.credit_cost,
    credits_remaining: job.credits_remaining,
    error: job.error,
  };
}

function otherProvider(_p: AvatarProvider): AvatarProvider {
  return "openrouter-flux";
}

function isStopped(job: AvatarJob) {
  return job.status === "CANCELLED" || job.phase === "cancelled";
}

async function setPhase(job: AvatarJob, phase: JobPhase, phase_label: string) {
  const latest = await getJob(job.id);
  if (latest && isStopped(latest)) return;
  job.phase = phase;
  job.phase_label = phase_label;
  await saveJob(job);
}

async function fail(job: AvatarJob, message: string) {
  const latest = await getJob(job.id);
  if (latest && (isStopped(latest) || latest.status === "COMPLETED")) return;
  job.status = "FAILED";
  job.phase = "failed";
  job.phase_label = "Failed — try the other model";
  job.suggest_provider = otherProvider(job.provider);
  job.error = message;
  job.duration_ms = job.duration_ms ?? Date.now() - Date.parse(job.created_at);
  if (job.estimated_usd == null && job.duration_ms != null && job.provider === "qwen") {
    job.usd_per_hour_assumed = job.usd_per_hour_assumed ?? 0.69;
    job.estimated_usd = Number(((job.duration_ms / 1000 / 3600) * job.usd_per_hour_assumed).toFixed(6));
  }
  await saveJob(job);
  await appendLedger(ledgerFrom(job));
}

export async function cancelAvatarJob(jobId: string): Promise<AvatarJob> {
  const job = await getJob(jobId);
  if (!job) throw new Error("not found");
  if (job.status === "COMPLETED") throw new Error("already completed");
  if (isStopped(job)) return job;

  job.status = "CANCELLED";
  job.phase = "cancelled";
  job.phase_label = "Stopped";
  job.error = "Stopped by you";
  job.suggest_provider = "ai33pro";
  job.duration_ms = Date.now() - Date.parse(job.created_at);
  await saveJob(job);

  if (job.provider_job_id) {
    try {
      if (job.provider === "ai33pro") {
        await ai33Delete(job.provider_job_id);
        job.provider_meta = { ...job.provider_meta, vendor_deleted: true };
      } else if (job.provider === "qwen") {
        await qwenCancel(job.provider_job_id);
        job.provider_meta = { ...job.provider_meta, vendor_cancelled: true };
      }
    } catch (err) {
      job.provider_meta = {
        ...job.provider_meta,
        vendor_cancel_error: err instanceof Error ? err.message : String(err),
      };
    }
    await saveJob(job);
  }
  await appendLedger(ledgerFrom(job));
  return await getJob(jobId) ?? job;
}

export async function runAvatarJob(jobId: string, imagePath: string) {
  const job = await getJob(jobId);
  if (!job) return;
  job.status = "IN_PROGRESS";
  job.error = null;
  job.suggest_provider = null;
  await setPhase(job, "queued", "Starting…");
  const started = Date.parse(job.created_at) || Date.now();

  try {
    await restoreArtifacts(job);
    const raw = readFileSync(imagePath);
    if (job.provider === "qwen") {
      await runQwen(job, raw, started);
    } else if (isOpenRouterProvider(job.provider)) {
      await runOpenRouter(job, raw, started);
    } else {
      await runAi33(job, raw, started);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const latest = await getJob(jobId);
    if (latest && latest.status !== "COMPLETED" && !isStopped(latest)) await fail(latest, message);
  }
}

function shouldResumeVendorPoll(job: AvatarJob) {
  if (!job.provider_job_id) return false;
  if (job.status === "IN_PROGRESS") return true;
  const err = job.error || "";
  return (
    job.status === "FAILED" &&
    job.provider === "ai33pro" &&
    /pollAi33UntilDone is not defined|is not defined/.test(err)
  );
}

/** After a process restart, keep polling jobs that already have a vendor id. Never resubmit Seedream. */
export async function resumeInFlightJobs() {
  for (const job of await listJobs()) {
    if (["PENDING", "IN_PROGRESS"].includes(job.status) && !job.provider_job_id) {
      await fail(job, "Backend restarted before a provider id was saved. Check the vendor queue before retrying; no automatic resubmission."); continue;
    }
    if (!shouldResumeVendorPoll(job)) continue;
    if (job.status === "FAILED") {
      job.status = "IN_PROGRESS";
      job.error = null;
      job.suggest_provider = null;
      job.phase = "generating";
      job.phase_label = "Resuming vendor poll — same Seedream task, no new charge";
      await saveJob(job);
      console.log("reopen crashed poll", job.id, job.provider_job_id);
    }
    console.log("resume", job.id, job.provider, job.provider_job_id);
    void continueJob(job);
  }
}

async function continueJob(job: AvatarJob) {
  const started = Date.parse(job.created_at) || Date.now();
  try {
    if (job.provider === "qwen") {
      await pollQwenUntilDone(job, started);
      return;
    }
    if (isOpenRouterProvider(job.provider)) {
      await fail(job, "OpenRouter image jobs are not polled. Start a new generate if this one did not finish.");
      return;
    }
    if (!job.provider_job_id) {
      await fail(
        job,
        "Interrupted before Seedream accepted the task. No vendor id — do not assume a charge.",
      );
      return;
    }
    console.log("resume poll only", job.id, job.provider_job_id);
    await pollAi33UntilDone(job, started);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const latest = await getJob(job.id);
    if (latest && latest.status === "IN_PROGRESS") await fail(latest, message);
  }
}

async function runQwen(job: AvatarJob, raw: Buffer, started: number) {
  await setPhase(job, "checking_runpod", "Checking RunPod…");
  const health = await qwenHealth();
  job.provider_meta = { health };
  await saveJob(job);
  const blocked = qwenBlockedReason(health);
  if (blocked) {
    await fail(job, blocked);
    return;
  }

  const b64 = raw.toString("base64");

  await setPhase(
    job,
    "loading_model",
    "RunPod active — loading model. First wake can take a few minutes.",
  );
  console.log("qwen ping (wake worker)");
  const woke = await qwenPing();
  job.provider_meta = { ...job.provider_meta, ping: woke.ping, ping_job_id: woke.jobId };
  await saveJob(job);

  await setPhase(job, "generating", "RunPod active — generating your avatar…");
  const providerJobId = await qwenSubmit(b64, job.prompt);
  job.provider_job_id = providerJobId;
  await saveJob(job);
  await pollQwenUntilDone(job, started);
}

async function pollQwenUntilDone(job: AvatarJob, started: number) {
  const providerJobId = job.provider_job_id;
  if (!providerJobId) throw new Error("Qwen job missing provider_job_id");
  const deadline = Date.now() + 12 * 60 * 1000;
  while (Date.now() < deadline) {
    const latest = await getJob(job.id);
    if (latest && isStopped(latest)) return;
    const poll = await qwenPoll(providerJobId);
    if (poll.status === "IN_QUEUE") {
      await setPhase(job, "waking_runpod", "RunPod active — waiting for a GPU…");
    } else if (poll.status === "IN_PROGRESS") {
      await setPhase(job, "generating", "RunPod active — generating your avatar…");
    }
    if (poll.status === "FAILED" || poll.status === "CANCELLED" || poll.status === "TIMED_OUT") {
      await fail(job, poll.error || poll.output?.error || `Qwen ${poll.status}`);
      return;
    }
    if (poll.status === "COMPLETED") {
      const out = poll.output || {};
      if (out.ok === false || !out.png_b64) {
        await fail(job, out.error || "Qwen completed without png_b64");
        return;
      }
      writeFileSync(outputPath(job.id, ".png"), Buffer.from(out.png_b64, "base64"));
      job.status = "COMPLETED";
      job.phase = "done";
      job.phase_label = "Avatar ready";
      job.output_mime = "image/png";
      job.duration_ms = out.duration_ms ?? Date.now() - started;
      job.estimated_usd = out.estimated_usd ?? null;
      job.usd_per_hour_assumed = out.usd_per_hour_assumed ?? 0.69;
      job.provider_meta = { ...out, png_b64: "[omitted]" };
      await saveJob(job);
      await appendLedger(ledgerFrom(job));
      return;
    }
    await sleep(4000);
  }
  await fail(job, "Qwen poll timed out (12 min)");
}

async function runOpenRouter(job: AvatarJob, raw: Buffer, started: number) {
  if (!isOpenRouterProvider(job.provider)) throw new Error("not an OpenRouter provider");
  const label = job.provider === "openrouter-flux" ? "FLUX.2 Klein 4B" : "Muse";
  await setPhase(job, "generating", `${label} — editing your photo…`);
  const out = await openrouterGenerate(job.provider, raw, job.input_mime, job.prompt);
  const ext = extFromMime(out.mime);
  writeFileSync(outputPath(job.id, ext), out.buffer);
  job.status = "COMPLETED";
  job.phase = "done";
  job.phase_label = "Avatar ready";
  job.output_mime = out.mime;
  job.duration_ms = Date.now() - started;
  job.estimated_usd = out.cost_usd;
  job.provider_job_id = out.generation_id;
  job.provider_meta = { model: out.model, generation_id: out.generation_id };
  await saveJob(job);
  await appendLedger(ledgerFrom(job));
}

async function applyAi33Poll(job: AvatarJob, task: Awaited<ReturnType<typeof ai33Poll>>, pollCount: number) {
  const url = extractImageUrl(task);
  const status = (task.status || "unknown").toLowerCase();
  const progress = typeof task.progress === "number" ? task.progress : null;
  const vendorUpdated = (task as { updated_at?: string }).updated_at ?? null;
  const prev = job.provider_meta || {};
  const changed =
    prev.vendor_status !== status ||
    prev.vendor_progress !== progress ||
    prev.vendor_updated_at !== vendorUpdated ||
    Boolean(url) !== Boolean(prev.vendor_has_output);

  if (typeof task.credit_cost === "number") job.credit_cost = task.credit_cost;
  job.provider_meta = {
    ...prev,
    vendor_status: status,
    vendor_progress: progress,
    vendor_polled_at: new Date().toISOString(),
    vendor_updated_at: vendorUpdated,
    vendor_has_output: Boolean(url),
    vendor_poll_count: pollCount,
    vendor_credit_cost: task.credit_cost ?? null,
    vendor_error: task.error_message ?? null,
    vendor_type: task.type ?? null,
    metadata_keys: Object.keys(task.metadata || {}),
    last_vendor_change_at: changed ? new Date().toISOString() : prev.last_vendor_change_at ?? null,
  };

  const pct = progress == null ? "no % from vendor" : `${progress}%`;
  await setPhase(job, "generating", `Seedream 4.5 — vendor ${status} · ${pct}`);
}

async function finishAi33(job: AvatarJob, task: Awaited<ReturnType<typeof ai33Poll>>, started: number) {
  const url = extractImageUrl(task);
  if (!url) {
    await fail(
      job,
      `ai33pro ${task.status || "done"} but no image URL. metadata keys: ${Object.keys(task.metadata || {}).join(",")}`,
    );
    return;
  }
  const imgRes = await fetch(url);
  if (!imgRes.ok) {
    await fail(job, `download result HTTP ${imgRes.status}`);
    return;
  }
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const mime = imgRes.headers.get("content-type") || "image/png";
  const ext = extFromMime(mime);
  writeFileSync(outputPath(job.id, ext), buf);
  job.status = "COMPLETED";
  job.phase = "done";
  job.phase_label = "Avatar ready";
  job.output_mime = mime;
  job.duration_ms = Date.now() - started;
  job.credit_cost = typeof task.credit_cost === "number" ? task.credit_cost : job.quoted_credits;
  job.credits_remaining = await ai33Credits();
  job.provider_meta = {
    ...job.provider_meta,
    status: task.status,
    type: task.type,
    metadata: task.metadata,
    vendor_has_output: true,
  };
  job.estimated_usd = null;
  await saveJob(job);
  await appendLedger(ledgerFrom(job));
}

async function pollAi33UntilDone(job: AvatarJob, started: number) {
  const taskId = job.provider_job_id;
  if (!taskId) throw new Error("Seedream job missing provider_job_id");
  const deadline = Date.now() + 30 * 60 * 1000;
  let pollCount = Number(job.provider_meta?.vendor_poll_count) || 0;

  while (Date.now() < deadline) {
    const latest = await getJob(job.id);
    if (latest && isStopped(latest)) return;
    try {
      const task = await ai33Poll(taskId);
      pollCount += 1;
      await applyAi33Poll(job, task, pollCount);
      const status = (task.status || "").toLowerCase();
      console.log(
        "ai33 poll",
        job.id,
        status,
        "progress",
        task.progress ?? "none",
        "output",
        Boolean(extractImageUrl(task)),
        "n",
        pollCount,
      );
      if (status === "failed" || status === "error") {
        await fail(job, task.error_message || "ai33pro task failed");
        return;
      }
      if (status === "done" || status === "completed" || status === "success") {
        const again = await getJob(job.id);
        if (again && isStopped(again)) return;
        await finishAi33(job, task, started);
        return;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      job.provider_meta = {
        ...job.provider_meta,
        vendor_polled_at: new Date().toISOString(),
        vendor_poll_error: message,
        vendor_poll_count: pollCount,
      };
      await saveJob(job);
      console.log("ai33 poll error", job.id, message);
      await sleep(8000);
      continue;
    }
    await sleep(4000);
  }
  await fail(job, "ai33pro still doing after 30 min with no output URL. Same task id — do not resubmit.");
}

async function runAi33(job: AvatarJob, raw: Buffer, started: number) {
  if (job.provider_job_id) {
    await pollAi33UntilDone(job, started);
    return;
  }

  await setPhase(job, "quoting", "Checking Seedream 4.5 price…");
  job.credits_remaining = await ai33Credits();
  job.quoted_credits = await ai33Quote({ aspect_ratio: "16:9", resolution: "2K", assets: 1 });
  await saveJob(job);

  await setPhase(job, "generating", "Seedream 4.5 — sending photo to vendor…");
  const taskId = await ai33Generate(raw, job.input_filename, job.input_mime);
  job.provider_job_id = taskId;
  await saveJob(job);

  await pollAi33UntilDone(job, started);
}
