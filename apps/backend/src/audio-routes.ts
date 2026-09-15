import { diskUpload } from "./uploads.js";
import { resources, saveResource, deleteResource, assertDictionaryOwner, assertVoiceOwner } from "./user-resources.js";
import { serveArtifact } from "./artifacts.js";
import { assertSafePrompt } from "./prompt-guard.js";
import { randomUUID } from "node:crypto";
import { existsSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import type { AudioJob, AudioKind } from "./types.js";
import { audioInputPath, audioOutputPath, getAudioJob, listAudioJobs, saveAudioJob } from "./audio-store.js";
import { cancelAudioJob, runAudioJob } from "./audio-runner.js";
import {
  DUB_TARGET_LANGS,
  VOICE_PROVIDERS,
  ai33CloneVoice,
  ai33Credits,
  ai33DeleteClone,
  ai33DictionaryCreate,
  ai33DictionaryDelete,
  ai33DictionaryGet,
  ai33DictionaryPreview,
  ai33DictionaryUpdate,
  MUSIC_PROMPT_STARTERS,
  SFX_PROMPT_STARTERS,
  ai33VoiceLibrary,
  ai33Voices,
  asCloneVoiceId,
  type LibraryClip,
} from "./providers/ai33-audio.js";
import { extractAudioMp3, ffmpegAvailable, probeDurationSeconds } from "./ffmpeg-local.js";
import { extFromMime } from "./media.js";
import { currentUser } from "./google-auth.js";
import { effectiveTier, quotaOk, recordUsage } from "./billing-store.js";
import { QUOTA_LABELS, TIERS } from "./plans.js";
const cloneUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

function sendErr(res: import("express").Response, err: unknown, status = 400) {
  const code = typeof (err as { status?: number })?.status === "number" ? (err as { status: number }).status : status;
  res.status(code).json({ error: err instanceof Error ? err.message : String(err) });
}

function newJob(partial: Omit<AudioJob, "created_at" | "updated_at" | "provider">): AudioJob {
  const now = new Date().toISOString();
  return {
    ...partial,
    created_at: now,
    updated_at: now,
    provider: "ai33pro",
  };
}

function clampSpeed(raw: unknown) {
  const n = Number(raw ?? 1);
  if (!Number.isFinite(n)) return 1;
  return Math.min(1.5, Math.max(0.5, n));
}

function isAudioMime(mime: string) {
  return mime.startsWith("audio/");
}

function isVideoMime(mime: string) {
  return mime.startsWith("video/");
}

async function prepareSubmitFile(opts: {
  id: string;
  file: Express.Multer.File;
  want: "changer" | "dub" | "passthrough";
}): Promise<{
  submit_path: string;
  submit_mime: string;
  submit_filename: string;
  video_path?: string;
  input_ext: string;
}> {
  const mime = opts.file.mimetype || "application/octet-stream";
  const ext = extFromMime(mime);
  const inputExt = isVideoMime(mime)
    ? ext === ".png"
      ? ".mp4"
      : ext
    : ext === ".png"
      ? ".bin"
      : ext;
  const stored = audioInputPath(opts.id, inputExt);
  copyFileSync(opts.file.path, stored);

  if (opts.want === "passthrough") {
    return {
      submit_path: stored,
      submit_mime: mime,
      submit_filename: opts.file.originalname || `input${inputExt}`,
      input_ext: inputExt,
    };
  }

  const needsExtract =
    isVideoMime(mime) ||
    (opts.want === "dub" && !/\.(mp3|m4a)$/i.test(inputExt) && !mime.includes("mpeg") && !mime.includes("mp3") && !mime.includes("m4a"));

  if (!needsExtract) {
    return {
      submit_path: stored,
      submit_mime: mime.includes("m4a") ? "audio/mp4" : mime,
      submit_filename: opts.file.originalname || `audio${inputExt}`,
      video_path: isVideoMime(mime) ? stored : undefined,
      input_ext: inputExt,
    };
  }

  const ok = await ffmpegAvailable();
  if (!ok) {
    throw new Error("This file needs ffmpeg to extract mp3/m4a. ffmpeg was not found on this machine.");
  }
  const mp3 = audioInputPath(opts.id, ".extract.mp3");
  await extractAudioMp3(stored, mp3);
  return {
    submit_path: mp3,
    submit_mime: "audio/mpeg",
    submit_filename: "extract.mp3",
    video_path: isVideoMime(mime) ? stored : undefined,
    input_ext: inputExt,
  };
}

export const audioRouter = Router();

audioRouter.get("/health", async (_req, res) => {
  try {
    const [credits, ffmpeg] = await Promise.all([ai33Credits(), ffmpegAvailable()]);
    res.json({
      ok: true,
      credits_remaining: credits,
      ffmpeg,
      voice_providers: VOICE_PROVIDERS,
      dub_target_langs: DUB_TARGET_LANGS,
      voice_changer_models: [
        { id: "eleven_multilingual_sts_v2", label: "Eleven Multilingual v2" },
        { id: "eleven_english_sts_v2", label: "Eleven English v2" },
      ],
      honest: {
        lip_sync: false,
        video_change: "extract audio, swap/dub, mux back. Picture unchanged.",
      },
    });
  } catch (err) {
    sendErr(res, err, 500);
  }
});

audioRouter.get("/voices", async (req, res) => {
  try {
    const q: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(req.query)) {
      if (typeof v === "string") q[k] = v;
    }
    if (q.provider === "clone") {
      const email = currentUser(req)?.email;
      const jobs = email ? await listAudioJobs(email) : [];
      res.json({ data: jobs.filter(j => j.kind === "clone" && !j.params.deleted).map(j => ({ voice_id: j.params.voice_id, name: j.title })), pagination: { total: jobs.filter(j => j.kind === "clone" && !j.params.deleted).length } }); return;
    }
    res.json(await ai33Voices(q));
  } catch (err) {
    sendErr(res, err);
  }
});

audioRouter.get("/voice-library", async (_req, res) => {
  try {
    res.json(await ai33VoiceLibrary());
  } catch (err) {
    sendErr(res, err, 500);
  }
});

async function studioClips(kind: "sfx" | "music", ownerEmail?: string): Promise<LibraryClip[]> {
  return (await listAudioJobs(ownerEmail))
    .filter((j) => j.kind === kind && j.status === "COMPLETED" && j.output_filename)
    .map((j) => {
      const params = j.params || {};
      const prompt =
        (typeof params.text === "string" && params.text) ||
        (typeof params.gpt_description_prompt === "string" && params.gpt_description_prompt) ||
        (typeof params.title === "string" && params.title) ||
        j.title;
      return {
        id: j.id,
        source: "studio" as const,
        kind,
        title: j.title,
        play_url: `/api/audio/jobs/${j.id}/output`,
        alt_url: j.has_alt ? `/api/audio/jobs/${j.id}/alt` : null,
        cover_url: j.has_cover ? `/api/audio/jobs/${j.id}/cover` : null,
        prompt,
      };
    });
}

audioRouter.get("/asset-library", async (req, res) => {
  try {
    const email = currentUser(req)?.email;
    res.json({
      credit_cost: 0,
      note: "SFX and Suno have no vendor preview catalog like voices. Starters only fill the form (0 credits). Playable clips are jobs already generated on this key.",
      sfx: { starters: SFX_PROMPT_STARTERS, clips: [...(await studioClips("sfx", email))] },
      music: { starters: MUSIC_PROMPT_STARTERS, clips: [...(await studioClips("music", email))] },
    });
  } catch (err) {
    sendErr(res, err, 500);
  }
});

audioRouter.get("/jobs", async (req, res) => {
  res.json({ jobs: await listAudioJobs(currentUser(req)?.email) });
});

audioRouter.get("/jobs/:id", async (req, res) => {
  const job = await getAudioJob(req.params.id, currentUser(req)?.email);
  if (!job) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json(job);
});

async function fileDownload(res: import("express").Response, job: AudioJob, file: string, mime: string, download?: boolean) {
  await serveArtifact(res, job, file, mime, undefined, download ? path.basename(file) : undefined);
}

audioRouter.get("/jobs/:id/input", async (req, res) => {
  const job = await getAudioJob(req.params.id, currentUser(req)?.email);
  if (!job || !job.input_mime) {
    res.status(404).json({ error: "input missing" });
    return;
  }
  const ext = extFromMime(job.input_mime);
  const stored = audioInputPath(job.id, ext === ".png" ? ".bin" : ext);
  const cloneMp3 = audioInputPath(job.id, ".clone.mp3");
  if (existsSync(cloneMp3) || job.artifacts?.[`audio-uploads/${job.id}.clone.mp3`]) {
    await fileDownload(res, job, cloneMp3, "audio/mpeg");
    return;
  }
  await fileDownload(res, job, stored, job.input_mime);
});

audioRouter.get("/jobs/:id/output", async (req, res) => {
  const job = await getAudioJob(req.params.id, currentUser(req)?.email);
  if (!job || job.status !== "COMPLETED") {
    res.status(404).json({ error: "output not ready" });
    return;
  }
  const video = req.query.video === "1" || req.query.video === "true";
  if (video) {
    await fileDownload(res, job, audioOutputPath(job.id, ".mp4"), "video/mp4", Boolean(req.query.download));
    return;
  }
  await fileDownload(res, job, audioOutputPath(job.id, ".mp3"), "audio/mpeg", Boolean(req.query.download));
});

audioRouter.get("/jobs/:id/alt", async (req, res) => {
  const job = await getAudioJob(req.params.id, currentUser(req)?.email);
  if (!job || job.status !== "COMPLETED") {
    res.status(404).json({ error: "output not ready" });
    return;
  }
  await fileDownload(res, job, audioOutputPath(job.id, ".alt.mp3"), "audio/mpeg", Boolean(req.query.download));
});

audioRouter.get("/jobs/:id/srt", async (req, res) => {
  const job = await getAudioJob(req.params.id, currentUser(req)?.email);
  if (!job?.has_srt) {
    res.status(404).json({ error: "no srt" });
    return;
  }
  await fileDownload(res, job, audioOutputPath(job.id, ".srt"), "application/x-subrip", true);
});

audioRouter.get("/jobs/:id/transcript", async (req, res) => {
  const job = await getAudioJob(req.params.id, currentUser(req)?.email);
  if (!job) { res.status(404).json({ error: "not found" }); return; }
  const txt = audioOutputPath(job.id, ".txt");
  const jsonFile = audioOutputPath(req.params.id, ".json");
  if (existsSync(txt) || job.artifacts?.[`audio-outputs/${job.id}.txt`]) {
    await fileDownload(res, job, txt, "text/plain", Boolean(req.query.download));
    return;
  }
  if (existsSync(jsonFile) || job.artifacts?.[`audio-outputs/${job.id}.json`]) {
    await fileDownload(res, job, jsonFile, "application/json", Boolean(req.query.download));
    return;
  }
  if (job?.transcript) {
    res.type("text/plain").send(job.transcript);
    return;
  }
  res.status(404).json({ error: "no transcript" });
});

audioRouter.get("/jobs/:id/cover", async (req, res) => {
  const job = await getAudioJob(req.params.id, currentUser(req)?.email);
  if (!job) { res.status(404).json({ error: "not found" }); return; }
  await fileDownload(res, job, audioOutputPath(req.params.id, ".cover.jpg"), "image/jpeg");
});

audioRouter.post("/jobs/:id/cancel", async (req, res) => {
  try {
    const owned = await getAudioJob(req.params.id, currentUser(req)?.email);
    if (!owned) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json(await cancelAudioJob(req.params.id));
  } catch (err) {
    sendErr(res, err, 400);
  }
});

export async function enqueue(kind: AudioKind, title: string, params: Record<string, unknown>, extra?: Partial<AudioJob>, defer = false) {
  const owner = extra?.owner_email || "anonymous";
  if (!(await quotaOk(owner, "audio"))) {
    const tier = TIERS[await effectiveTier(owner)];
    throw Object.assign(
      new Error(`${tier.name} allows ${tier.quotas.audio} ${QUOTA_LABELS.audio.toLowerCase()} per month. Upgrade on the Pricing page.`),
      { status: 429 },
    );
  }
  const id = extra?.id || randomUUID();
  const job = newJob({
    id,
    status: "PENDING",
    phase: "queued",
    phase_label: "Queued…",
    kind,
    title,
    input_mime: extra?.input_mime ?? null,
    input_filename: extra?.input_filename ?? null,
    output_mime: null,
    output_filename: null,
    has_srt: false,
    has_video: false,
    has_cover: false,
    has_alt: extra?.has_alt ?? false,
    provider_job_id: null,
    error: null,
    duration_ms: null,
    estimated_usd: null,
    usd_per_hour_assumed: null,
    quoted_credits: extra?.quoted_credits ?? null,
    credit_cost: extra?.credit_cost ?? null,
    credits_remaining: extra?.credits_remaining ?? null,
    vendor_progress: null,
    vendor_type: null,
    params,
    provider_meta: extra?.provider_meta ?? {},
    transcript: extra?.transcript ?? null,
    owner_email: extra?.owner_email || "anonymous",
    ...extra,
  });
  await assertDictionaryOwner(job.owner_email || "anonymous", params.pronunciation_dictionary_id);
  if (kind !== "clone") await assertVoiceOwner(job.owner_email || "anonymous", params.voice_id);
  if (kind === "dialogue" && Array.isArray(params.speakers)) for (const speaker of params.speakers) await assertVoiceOwner(job.owner_email || "anonymous", speaker.voice_id);
  await saveAudioJob(job);
  await recordUsage(job.owner_email || "anonymous", "audio");
  if (kind !== "clone" && !defer) void runAudioJob(id);
  return job;
}

audioRouter.post("/tts", async (req, res) => {
  try {
    const text = assertSafePrompt(req.body?.text, "speech");
    const voice_id = String(req.body?.voice_id || "").trim();
    if (!voice_id) throw new Error("voice_id required");
    const job = await enqueue("tts", text.slice(0, 48) || "TTS", {
      text,
      voice_id,
      speed: clampSpeed(req.body?.speed),
      with_transcript: Boolean(req.body?.with_transcript),
      pronunciation_dictionary_id: req.body?.pronunciation_dictionary_id || undefined,
    }, { owner_email: currentUser(req)?.email || "anonymous" });
    res.status(202).json(job);
  } catch (err) {
    sendErr(res, err);
  }
});

audioRouter.post("/dialogue", async (req, res) => {
  try {
    const text = assertSafePrompt(req.body?.text, "speech");
    const speakers = req.body?.speakers;
    if (!Array.isArray(speakers) || speakers.length < 2 || speakers.length > 26) {
      throw new Error("speakers must be a JSON array of 2–26 voices");
    }
    const clean = speakers.map((s: { voice_id?: string; speed?: number }) => ({
      voice_id: String(s.voice_id || ""),
      speed: clampSpeed(s.speed),
    }));
    if (clean.some((s) => !s.voice_id)) throw new Error("each speaker needs voice_id");
    const delay = Number(req.body?.delay ?? 0);
    if (!Number.isFinite(delay) || delay < 0 || delay > 5) throw new Error("delay must be 0–5");
    const job = await enqueue("dialogue", "Dialogue", {
      text,
      speakers: clean,
      delay,
      with_transcript: Boolean(req.body?.with_transcript),
      pronunciation_dictionary_id: req.body?.pronunciation_dictionary_id || undefined,
    }, { owner_email: currentUser(req)?.email || "anonymous" });
    res.status(202).json(job);
  } catch (err) {
    sendErr(res, err);
  }
});

audioRouter.post("/clone", cloneUpload.single("audio"), async (req, res) => {
  try {
    if (String(req.body?.consent) !== "true") throw new Error("consent=true is required. Only clone a voice you own or have permission to use.");
    const name = String(req.body?.voice_name || "").trim();
    if (!name) throw new Error("voice_name required");
    const file = req.file;
    if (!file) throw new Error("audio_file required (field name: audio)");
    const id = randomUUID();
    const ext = extFromMime(file.mimetype) === ".png" ? ".bin" : extFromMime(file.mimetype);
    const stored = audioInputPath(id, ext);
    writeFileSync(stored, file.buffer);
    const seconds = await probeDurationSeconds(stored);
    if (seconds != null && (seconds < 3 || seconds > 30)) {
      throw new Error(`Clone sample must be 3–30 seconds (got ${seconds.toFixed(1)}s).`);
    }
    const native =
      /\.(mp3|wav|m4a)$/i.test(ext) || /mpeg|mp3|wav|m4a/.test(file.mimetype);
    let submitBuf = file.buffer;
    let submitMime = file.mimetype;
    let submitName = file.originalname || `sample${ext}`;
    if (!native) {
      if (!(await ffmpegAvailable())) {
        throw new Error(
          "Clone sample should be mp3, wav, or m4a. ffmpeg is missing to convert this recording.",
        );
      }
      const mp3 = audioInputPath(id, ".clone.mp3");
      await extractAudioMp3(stored, mp3);
      submitBuf = readFileSync(mp3);
      submitMime = "audio/mpeg";
      submitName = "sample.mp3";
    }
    const cloned = await ai33CloneVoice({
      voice_name: name,
      audio: submitBuf,
      filename: submitName,
      mime: submitMime,
    });
    const job = await enqueue(
      "clone",
      name,
      { voice_id: cloned.voice_id, voice_name: name, duration_s: seconds },
      {
        id,
        status: "COMPLETED",
        phase: "done",
        phase_label: "Clone ready",
        input_mime: file.mimetype,
        input_filename: file.originalname || `sample${ext}`,
        provider_meta: { vendor: cloned.raw },
        duration_ms: 0,
        owner_email: currentUser(req)?.email || "anonymous",
      },
    );
    res.status(201).json({ ...job, voice_id: cloned.voice_id });
  } catch (err) {
    sendErr(res, err);
  }
});

audioRouter.delete("/clones/:id", async (req, res) => {
  try {
    const owned = (await listAudioJobs(currentUser(req)?.email)).find(j => j.kind === "clone" && asCloneVoiceId(String(j.params.voice_id || "")) === asCloneVoiceId(req.params.id));
    if (!owned) { res.status(404).json({ error: "not found" }); return; }
    await ai33DeleteClone(req.params.id);
    owned.params.deleted = true; await saveAudioJob(owned);
    res.json({ success: true, voice_id: asCloneVoiceId(req.params.id) });
  } catch (err) {
    sendErr(res, err);
  }
});

audioRouter.post("/voice-change", diskUpload(200 * 1024 * 1024, "file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) throw new Error("file required");
    const voice_id = String(req.body?.voice_id || "").trim();
    if (!voice_id) throw new Error("voice_id required");
    if (!isAudioMime(file.mimetype) && !isVideoMime(file.mimetype)) {
      throw new Error("upload audio (mp3/m4a/wav) or a video to mux");
    }
    const id = randomUUID();
    const prepared = await prepareSubmitFile({ id, file, want: "changer" });
    const job = await enqueue(
      "voice-change",
      "Voice change",
      {
        voice_id,
        model_id: req.body?.model_id || "eleven_multilingual_sts_v2",
        remove_background_noise: String(req.body?.remove_background_noise || "true") !== "false",
        submit_path: prepared.submit_path,
        submit_mime: prepared.submit_mime,
        submit_filename: prepared.submit_filename,
        video_path: prepared.video_path,
      },
      {
        id,
        input_mime: file.mimetype,
        input_filename: file.originalname || `input${prepared.input_ext}`,
        owner_email: currentUser(req)?.email || "anonymous",
      },
    );
    res.status(202).json(job);
  } catch (err) {
    sendErr(res, err);
  }
});

audioRouter.post("/dub", diskUpload(200 * 1024 * 1024, "file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) throw new Error("file required (mp3/m4a, or video to extract)");
    const target_lang = String(req.body?.target_lang || "").trim();
    if (!target_lang) throw new Error("target_lang required (ISO-639-1, e.g. en)");
    const speakersRaw = String(req.body?.num_speakers ?? "0");
    const speakersN = Number(speakersRaw);
    if (!Number.isInteger(speakersN) || speakersN < 0 || speakersN > 9) {
      throw new Error("num_speakers must be 0–9 (0 = detect)");
    }
    const id = randomUUID();
    const prepared = await prepareSubmitFile({ id, file, want: "dub" });
    const job = await enqueue(
      "dub",
      `Dub → ${target_lang}`,
      {
        target_lang,
        source_lang: String(req.body?.source_lang || "auto"),
        num_speakers: speakersRaw,
        disable_voice_cloning: String(req.body?.disable_voice_cloning || "") === "true",
        voice_id: String(req.body?.voice_id || "").trim() || undefined,
        submit_path: prepared.submit_path,
        submit_mime: prepared.submit_mime,
        submit_filename: prepared.submit_filename,
        video_path: prepared.video_path,
      },
      {
        id,
        input_mime: file.mimetype,
        input_filename: file.originalname || `input${prepared.input_ext}`,
        owner_email: currentUser(req)?.email || "anonymous",
      },
    );
    res.status(202).json(job);
  } catch (err) {
    sendErr(res, err);
  }
});

audioRouter.post("/isolate", diskUpload(200 * 1024 * 1024, "file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) throw new Error("file required");
    const id = randomUUID();
    const prepared = await prepareSubmitFile({ id, file, want: "passthrough" });
    const job = await enqueue(
      "isolate",
      "Voice isolate",
      {
        submit_path: prepared.submit_path,
        submit_mime: prepared.submit_mime,
        submit_filename: prepared.submit_filename,
      },
      { id, input_mime: file.mimetype, input_filename: file.originalname || "audio", owner_email: currentUser(req)?.email || "anonymous" },
    );
    res.status(202).json(job);
  } catch (err) {
    sendErr(res, err);
  }
});

audioRouter.post("/stt", diskUpload(200 * 1024 * 1024, "file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) throw new Error("file required");
    const id = randomUUID();
    const prepared = await prepareSubmitFile({ id, file, want: "passthrough" });
    const job = await enqueue(
      "stt",
      "Speech to text",
      {
        tag_audio_events: String(req.body?.tag_audio_events || "true") !== "false",
        submit_path: prepared.submit_path,
        submit_mime: prepared.submit_mime,
        submit_filename: prepared.submit_filename,
      },
      { id, input_mime: file.mimetype, input_filename: file.originalname || "audio", owner_email: currentUser(req)?.email || "anonymous" },
    );
    res.status(202).json(job);
  } catch (err) {
    sendErr(res, err);
  }
});

audioRouter.post("/sfx", async (req, res) => {
  try {
    const text = assertSafePrompt(req.body?.text, "sfx");
    const durationRaw = req.body?.duration_seconds;
    const duration_seconds =
      durationRaw === "" || durationRaw == null ? undefined : Number(durationRaw);
    if (duration_seconds != null && (!Number.isFinite(duration_seconds) || duration_seconds < 0.5 || duration_seconds > 30)) {
      throw new Error("duration_seconds 0.5–30, or omit for auto (200 credits)");
    }
    const prompt_influence = req.body?.prompt_influence == null ? 0.3 : Number(req.body.prompt_influence);
    if (!Number.isFinite(prompt_influence) || prompt_influence < 0 || prompt_influence > 1) {
      throw new Error("prompt_influence 0–1");
    }
    const job = await enqueue("sfx", text.slice(0, 48), {
      text,
      duration_seconds,
      prompt_influence,
      loop: Boolean(req.body?.loop),
    }, { owner_email: currentUser(req)?.email || "anonymous" });
    res.status(202).json(job);
  } catch (err) {
    sendErr(res, err);
  }
});

audioRouter.post("/music", async (req, res) => {
  try {
    const mode = req.body?.create_mode === "custom" ? "custom" : "simple";
    if (mode === "simple") {
      const prompt = assertSafePrompt(req.body?.gpt_description_prompt, "music");
      const job = await enqueue("music", prompt.slice(0, 48), {
        create_mode: "simple",
        gpt_description_prompt: prompt,
        make_instrumental: Boolean(req.body?.make_instrumental),
      }, { owner_email: currentUser(req)?.email || "anonymous" });
      res.status(202).json(job);
      return;
    }
    const title = assertSafePrompt(String(req.body?.title || ""), "name");
    const lyrics = assertSafePrompt(String(req.body?.lyrics || ""), "lyrics");
    const tags = assertSafePrompt(String(req.body?.tags || ""), "tags");
    if (!lyrics && !tags) throw new Error("custom mode needs lyrics or tags");
    const gender = req.body?.vocal_gender;
    const job = await enqueue("music", title || "Suno", {
      create_mode: "custom",
      title,
      lyrics,
      tags,
      vocal_gender: gender === "m" || gender === "f" ? gender : undefined,
    }, { owner_email: currentUser(req)?.email || "anonymous" });
    res.status(202).json(job);
  } catch (err) {
    sendErr(res, err);
  }
});

audioRouter.get("/dictionaries", async (req, res) => {
  try {
    res.json({ data: await Promise.all((await resources(currentUser(req)!.email)).map(r => ai33DictionaryGet(r.id))) });
  } catch (err) {
    sendErr(res, err, 500);
  }
});

audioRouter.post("/dictionaries", async (req, res) => {
  try {
    const created = await ai33DictionaryCreate(req.body);
    const data = (created.data || created) as Record<string, unknown>;
    if (typeof data.id !== "string") throw new Error("Dictionary created without an id");
    await saveResource(currentUser(req)!.email, data.id, data);
    res.status(201).json(created);
  } catch (err) {
    sendErr(res, err);
  }
});

audioRouter.post("/dictionaries/preview", async (req, res) => {
  try {
    res.json(await ai33DictionaryPreview(req.body));
  } catch (err) {
    sendErr(res, err);
  }
});

audioRouter.get("/dictionaries/:id", async (req, res) => {
  try {
    await assertDictionaryOwner(currentUser(req)!.email, req.params.id);
    res.json(await ai33DictionaryGet(req.params.id));
  } catch (err) {
    sendErr(res, err);
  }
});

audioRouter.put("/dictionaries/:id", async (req, res) => {
  try {
    await assertDictionaryOwner(currentUser(req)!.email, req.params.id);
    res.json(await ai33DictionaryUpdate(req.params.id, req.body));
  } catch (err) {
    sendErr(res, err);
  }
});

audioRouter.delete("/dictionaries/:id", async (req, res) => {
  try {
    await assertDictionaryOwner(currentUser(req)!.email, req.params.id);
    const result = await ai33DictionaryDelete(req.params.id);
    await deleteResource(currentUser(req)!.email, req.params.id);
    res.json(result);
  } catch (err) {
    sendErr(res, err);
  }
});
