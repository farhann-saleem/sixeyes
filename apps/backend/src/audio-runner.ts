import { downloadToFile } from "./download.js";
import path from "node:path";
import { restoreArtifacts } from "./artifacts.js";
import { writeFileSync } from "node:fs";
import { appendLedger } from "./store.js";
import {
  audioOutputPath,
  audioInputPath,
  getAudioJob,
  listAudioJobs,
  saveAudioJob,
} from "./audio-store.js";
import type { AudioJob, CostLedgerRow, JobPhase } from "./types.js";
import {
  ai33Credits,
  ai33Delete,
  ai33Dialogue,
  ai33Dub,
  ai33Isolate,
  ai33Music,
  ai33Poll,
  ai33Sfx,
  ai33Stt,
  ai33Tts,
  ai33VoiceChanger,
  extractAudioOutputs,
} from "./providers/ai33-audio.js";
import { muxAudioOntoVideo } from "./ffmpeg-local.js";
import type { Ai33Task } from "./providers/ai33pro.js";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function ledgerFrom(job: AudioJob): CostLedgerRow {
  return {
    at: new Date().toISOString(),
    job_id: job.id,
    provider: "ai33pro",
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

function isStopped(job: AudioJob) {
  return job.status === "CANCELLED" || job.phase === "cancelled";
}

async function setPhase(job: AudioJob, phase: JobPhase, phase_label: string) {
  const latest = await getAudioJob(job.id);
  if (latest && isStopped(latest)) return;
  job.phase = phase;
  job.phase_label = phase_label;
  await saveAudioJob(job);
}

async function fail(job: AudioJob, message: string) {
  const latest = await getAudioJob(job.id);
  if (latest && (isStopped(latest) || latest.status === "COMPLETED")) return;
  job.status = "FAILED";
  job.phase = "failed";
  job.phase_label = "Failed";
  job.error = message;
  job.duration_ms = job.duration_ms ?? Date.now() - Date.parse(job.created_at);
  await saveAudioJob(job);
  await appendLedger(ledgerFrom(job));
}

export async function cancelAudioJob(jobId: string): Promise<AudioJob> {
  const job = await getAudioJob(jobId);
  if (!job) throw new Error("not found");
  if (job.status === "COMPLETED") throw new Error("already completed");
  if (isStopped(job)) return job;

  job.status = "CANCELLED";
  job.phase = "cancelled";
  job.phase_label = "Stopped";
  job.error = "Stopped by you";
  job.duration_ms = Date.now() - Date.parse(job.created_at);
  await saveAudioJob(job);

  if (job.provider_job_id) {
    try {
      await ai33Delete(job.provider_job_id);
      job.provider_meta = { ...job.provider_meta, vendor_deleted: true };
    } catch (err) {
      job.provider_meta = {
        ...job.provider_meta,
        vendor_cancel_error: err instanceof Error ? err.message : String(err),
      };
    }
    await saveAudioJob(job);
  }
  await appendLedger(ledgerFrom(job));
  return await getAudioJob(jobId) ?? job;
}

export async function resumeInFlightAudioJobs() {
  for (const job of await listAudioJobs()) {
    if (job.kind === "clone") continue;
    if (!job.provider_job_id && ["PENDING", "IN_PROGRESS"].includes(job.status)) { await fail(job, "Backend restarted before a vendor task id was saved. Check the vendor queue before retrying; no automatic resubmission."); continue; }
    if (job.status !== "IN_PROGRESS" && job.status !== "PENDING") continue;
    console.log("resume audio", job.id, job.kind, job.provider_job_id);
    void runAudioJob(job.id);
  }
}

export async function runAudioJob(jobId: string) {
  const job = await getAudioJob(jobId);
  if (!job || job.kind === "clone") return;
  job.status = "IN_PROGRESS";
  job.error = null;
  await setPhase(job, "queued", "Starting…");
  try {
    await restoreArtifacts(job);
    for (const field of ["submit_path", "video_path"]) {
      if (typeof job.params[field] === "string") job.params[field] = audioInputPath(job.id, path.basename(String(job.params[field])).slice(job.id.length));
    }
    if (job.provider_job_id) {
      await pollUntilDone(job);
      return;
    }
    job.credits_remaining = await ai33Credits();
    await saveAudioJob(job);
    const taskId = await submit(job);
    job.provider_job_id = taskId;
    await setPhase(job, "generating", "Vendor accepted — polling…");
    await pollUntilDone(job);
  } catch (err) {
    const latest = await getAudioJob(jobId);
    if (latest && latest.status !== "COMPLETED" && !isStopped(latest)) {
      await fail(latest, err instanceof Error ? err.message : String(err));
    }
  }
}

async function submit(job: AudioJob): Promise<string> {
  const p = job.params;
  if (job.kind === "tts") {
    await setPhase(job, "generating", "Sending script…");
    return ai33Tts({
      text: String(p.text || ""),
      voice_id: String(p.voice_id || ""),
      speed: Number(p.speed || 1),
      with_transcript: Boolean(p.with_transcript),
      pronunciation_dictionary_id: p.pronunciation_dictionary_id
        ? String(p.pronunciation_dictionary_id)
        : undefined,
    });
  }
  if (job.kind === "dialogue") {
    await setPhase(job, "generating", "Sending dialogue…");
    return ai33Dialogue({
      text: String(p.text || ""),
      speakers: Array.isArray(p.speakers) ? (p.speakers as Array<{ voice_id: string; speed?: number }>) : [],
      delay: Number(p.delay ?? 0),
      with_transcript: Boolean(p.with_transcript),
      pronunciation_dictionary_id: p.pronunciation_dictionary_id
        ? String(p.pronunciation_dictionary_id)
        : undefined,
    });
  }
  if (job.kind === "sfx") {
    await setPhase(job, "generating", "Generating sound effect…");
    return ai33Sfx({
      text: String(p.text || ""),
      duration_seconds: p.duration_seconds == null ? undefined : Number(p.duration_seconds),
      prompt_influence: p.prompt_influence == null ? undefined : Number(p.prompt_influence),
      loop: Boolean(p.loop),
    });
  }
  if (job.kind === "music") {
    await setPhase(job, "generating", "Suno — requesting two clips…");
    return ai33Music({
      create_mode: p.create_mode === "custom" ? "custom" : "simple",
      gpt_description_prompt: p.gpt_description_prompt ? String(p.gpt_description_prompt) : undefined,
      make_instrumental: Boolean(p.make_instrumental),
      title: p.title ? String(p.title) : undefined,
      lyrics: p.lyrics ? String(p.lyrics) : undefined,
      tags: p.tags ? String(p.tags) : undefined,
      vocal_gender: p.vocal_gender === "m" || p.vocal_gender === "f" ? p.vocal_gender : undefined,
    });
  }

  const submitPath = String(p.submit_path || "");
  const submitMime = String(p.submit_mime || "audio/mpeg");
  const submitName = String(p.submit_filename || "audio.mp3");
  const { openAsBlob } = await import("node:fs");
  const buf = await openAsBlob(submitPath, { type: submitMime });

  if (job.kind === "voice-change") {
    await setPhase(job, "generating", "Voice changer…");
    return ai33VoiceChanger({
      file: buf,
      filename: submitName,
      mime: submitMime,
      voice_id: String(p.voice_id || ""),
      model_id: p.model_id ? String(p.model_id) : undefined,
      voice_settings: (p.voice_settings as Record<string, unknown> | undefined) ?? {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.2,
        use_speaker_boost: true,
      },
      remove_background_noise: p.remove_background_noise !== false,
    });
  }
  if (job.kind === "dub") {
    await setPhase(job, "generating", "Dubbing…");
    const voiceId = p.voice_id ? String(p.voice_id) : "";
    if (voiceId.startsWith("kokoro_")) {
      throw new Error("Kokoro cannot be a dubbing replacement voice (no SRT-to-TTS path).");
    }
    return ai33Dub({
      file: buf,
      filename: submitName,
      mime: submitMime,
      target_lang: String(p.target_lang || ""),
      source_lang: String(p.source_lang || "auto"),
      num_speakers: String(p.num_speakers ?? "0"),
      disable_voice_cloning: Boolean(p.disable_voice_cloning),
      voice_id: voiceId || undefined,
    });
  }
  if (job.kind === "isolate") {
    await setPhase(job, "generating", "Isolating voice…");
    return ai33Isolate({ file: buf, filename: submitName, mime: submitMime });
  }
  if (job.kind === "stt") {
    await setPhase(job, "generating", "Transcribing…");
    return ai33Stt({
      file: buf,
      filename: submitName,
      mime: submitMime,
      tag_audio_events: p.tag_audio_events !== false,
    });
  }
  throw new Error(`unknown audio kind ${job.kind}`);
}

async function pollUntilDone(job: AudioJob) {
  if (!job.provider_job_id) {
    await fail(job, "missing vendor task id");
    return;
  }
  const started = Date.parse(job.created_at) || Date.now();
  const deadline = Date.now() + 30 * 60 * 1000;
  let pollCount = 0;
  while (Date.now() < deadline) {
    const latest = await getAudioJob(job.id);
    if (!latest || isStopped(latest)) return;
    Object.assign(job, latest);
    pollCount += 1;
    try {
      const task = await ai33Poll(job.provider_job_id);
      const status = String(task.status || "").toLowerCase();
      job.vendor_progress = typeof task.progress === "number" ? task.progress : null;
      job.vendor_type = task.type || null;
      job.credit_cost = typeof task.credit_cost === "number" ? task.credit_cost : job.credit_cost;
      job.provider_meta = {
        ...job.provider_meta,
        vendor_status: task.status,
        vendor_polled_at: new Date().toISOString(),
        vendor_poll_count: pollCount,
      };
      if (status === "doing" || status === "pending" || status === "queued" || status === "processing") {
        await setPhase(job, "generating", `Vendor ${task.status || "doing"}${task.progress != null ? ` · ${task.progress}%` : ""}`);
      } else {
        await saveAudioJob(job);
      }
      if (status === "failed" || status === "error") {
        await fail(job, task.error_message || "ai33pro task failed");
        return;
      }
      if (status === "done" || status === "completed" || status === "success") {
        await finish(job, task, started);
        return;
      }
    } catch (err) {
      job.provider_meta = {
        ...job.provider_meta,
        vendor_poll_error: err instanceof Error ? err.message : String(err),
        vendor_poll_count: pollCount,
      };
      await saveAudioJob(job);
      await sleep(8000);
      continue;
    }
    await sleep(4000);
  }
  await fail(job, "Still doing after 30 min. Same task id — do not resubmit.");
}

async function finish(job: AudioJob, task: Ai33Task, started: number) {
  const latest = await getAudioJob(job.id);
  if (latest && isStopped(latest)) return;
  const out = extractAudioOutputs(task);
  job.transcript = out.transcript;
  job.provider_meta = { ...job.provider_meta, vendor_metadata: task.metadata || {} };

  const meta = task.metadata || {};
  const replacement =
    job.kind === "dub" && job.params.voice_id && typeof meta.replacement_audio_url === "string"
      ? meta.replacement_audio_url
      : null;
  const primaryUrl =
    replacement && /^https?:\/\//.test(replacement) ? replacement : out.audioUrls[0];
  const altUrl =
    replacement && out.audioUrls[0] && out.audioUrls[0] !== primaryUrl
      ? out.audioUrls[0]
      : out.audioUrls.find((u) => u !== primaryUrl) || null;

  if (primaryUrl) {
    await downloadToFile(primaryUrl, audioOutputPath(job.id, ".mp3"));
    job.output_mime = "audio/mpeg";
    job.output_filename = `${job.id}.mp3`;
  }

  if (altUrl) {
    await downloadToFile(altUrl, audioOutputPath(job.id, ".alt.mp3"));
    job.has_alt = true;
  }

  if (out.srtUrl) {
    await downloadToFile(out.srtUrl, audioOutputPath(job.id, ".srt"));
    job.has_srt = true;
  }

  if (out.coverUrl) {
    await downloadToFile(out.coverUrl, audioOutputPath(job.id, ".cover.jpg"));
    job.has_cover = true;
  }

  if (job.kind === "stt") {
    writeFileSync(audioOutputPath(job.id, ".json"), JSON.stringify(task.metadata || {}, null, 2));
  }
  if (job.transcript) {
    writeFileSync(audioOutputPath(job.id, ".txt"), job.transcript);
  }

  const videoIn = typeof job.params.video_path === "string" ? audioInputPath(job.id, path.basename(job.params.video_path).slice(job.id.length)) : undefined;
  if (
    (job.kind === "voice-change" || job.kind === "dub") &&
    typeof videoIn === "string" &&
    job.output_filename
  ) {
    await setPhase(job, "generating", "Muxing new audio onto the original video…");
    const muxed = audioOutputPath(job.id, ".mp4");
    await muxAudioOntoVideo(videoIn, audioOutputPath(job.id, ".mp3"), muxed);
    job.has_video = true;
  }

  if (job.kind !== "stt" && !job.output_filename && !job.transcript && !job.has_srt) {
    await fail(job, `Vendor done but no audio_url. metadata keys: ${Object.keys(task.metadata || {}).join(",")}`);
    return;
  }

  job.status = "COMPLETED";
  job.phase = "done";
  job.phase_label = job.has_video ? "Ready (audio + muxed video)" : "Ready";
  job.duration_ms = Date.now() - started;
  job.credit_cost = typeof task.credit_cost === "number" ? task.credit_cost : job.credit_cost;
  job.credits_remaining = await ai33Credits();
  await saveAudioJob(job);
  await appendLedger(ledgerFrom(job));
}
