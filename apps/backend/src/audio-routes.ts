import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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
  ai33Dictionaries,
  ai33DictionaryCreate,
  ai33DictionaryDelete,
  ai33DictionaryGet,
  ai33DictionaryPreview,
  ai33DictionaryUpdate,
  MUSIC_PROMPT_STARTERS,
  SFX_PROMPT_STARTERS,
  ai33SfxMusicHistory,
  ai33VoiceLibrary,
  ai33Voices,
  asCloneVoiceId,
  type LibraryClip,
} from "./providers/ai33-audio.js";
import { extractAudioMp3, ffmpegAvailable, probeDurationSeconds } from "./ffmpeg-local.js";
import { extFromMime } from "./media.js";

const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

const cloneUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

function sendErr(res: import("express").Response, err: unknown, status = 400) {
  res.status(status).json({ error: err instanceof Error ? err.message : String(err) });
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
  writeFileSync(stored, opts.file.buffer);

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

function studioClips(kind: "sfx" | "music"): LibraryClip[] {
  return listAudioJobs()
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

audioRouter.get("/asset-library", async (_req, res) => {
  try {
    const history = await ai33SfxMusicHistory();
    const seen = new Set<string>();
    for (const job of listAudioJobs()) {
      seen.add(job.id);
      if (job.provider_job_id) seen.add(job.provider_job_id);
    }
    const vendorSfx = history.sfx.filter((c) => !seen.has(c.id));
    const vendorMusic = history.music.filter((c) => !seen.has(c.id));
    res.json({
      credit_cost: 0,
      note: "SFX and Suno have no vendor preview catalog like voices. Starters only fill the form (0 credits). Playable clips are jobs already generated on this key.",
      sfx: { starters: SFX_PROMPT_STARTERS, clips: [...studioClips("sfx"), ...vendorSfx] },
      music: { starters: MUSIC_PROMPT_STARTERS, clips: [...studioClips("music"), ...vendorMusic] },
    });
  } catch (err) {
    sendErr(res, err, 500);
  }
});

audioRouter.get("/jobs", (_req, res) => {
  res.json({ jobs: listAudioJobs() });
});

audioRouter.get("/jobs/:id", (req, res) => {
  const job = getAudioJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json(job);
});

function fileDownload(res: import("express").Response, file: string, mime: string, download?: boolean) {
  if (!existsSync(file)) {
    res.status(404).json({ error: "file missing" });
    return;
  }
  if (download) res.setHeader("Content-Disposition", `attachment; filename="${path.basename(file)}"`);
  res.type(mime).send(readFileSync(file));
}

audioRouter.get("/jobs/:id/input", (req, res) => {
  const job = getAudioJob(req.params.id);
  if (!job || !job.input_mime) {
    res.status(404).json({ error: "input missing" });
    return;
  }
  const ext = extFromMime(job.input_mime);
  const stored = audioInputPath(job.id, ext === ".png" ? ".bin" : ext);
  const cloneMp3 = audioInputPath(job.id, ".clone.mp3");
  if (existsSync(cloneMp3)) {
    fileDownload(res, cloneMp3, "audio/mpeg");
    return;
  }
  fileDownload(res, stored, job.input_mime);
});

audioRouter.get("/jobs/:id/output", (req, res) => {
  const job = getAudioJob(req.params.id);
  if (!job || job.status !== "COMPLETED") {
    res.status(404).json({ error: "output not ready" });
    return;
  }
  const video = req.query.video === "1" || req.query.video === "true";
  if (video) {
    fileDownload(res, audioOutputPath(job.id, ".mp4"), "video/mp4", Boolean(req.query.download));
    return;
  }
  fileDownload(res, audioOutputPath(job.id, ".mp3"), "audio/mpeg", Boolean(req.query.download));
});

audioRouter.get("/jobs/:id/alt", (req, res) => {
  const job = getAudioJob(req.params.id);
  if (!job || job.status !== "COMPLETED") {
    res.status(404).json({ error: "output not ready" });
    return;
  }
  fileDownload(res, audioOutputPath(job.id, ".alt.mp3"), "audio/mpeg", Boolean(req.query.download));
});

audioRouter.get("/jobs/:id/srt", (req, res) => {
  const job = getAudioJob(req.params.id);
  if (!job?.has_srt) {
    res.status(404).json({ error: "no srt" });
    return;
  }
  fileDownload(res, audioOutputPath(job.id, ".srt"), "application/x-subrip", true);
});

audioRouter.get("/jobs/:id/transcript", (req, res) => {
  const job = getAudioJob(req.params.id);
  const txt = audioOutputPath(req.params.id, ".txt");
  const jsonFile = audioOutputPath(req.params.id, ".json");
  if (existsSync(txt)) {
    fileDownload(res, txt, "text/plain", Boolean(req.query.download));
    return;
  }
  if (existsSync(jsonFile)) {
    fileDownload(res, jsonFile, "application/json", Boolean(req.query.download));
    return;
  }
  if (job?.transcript) {
    res.type("text/plain").send(job.transcript);
    return;
  }
  res.status(404).json({ error: "no transcript" });
});

audioRouter.get("/jobs/:id/cover", (req, res) => {
  fileDownload(res, audioOutputPath(req.params.id, ".cover.jpg"), "image/jpeg");
});

audioRouter.post("/jobs/:id/cancel", async (req, res) => {
  try {
    res.json(await cancelAudioJob(req.params.id));
  } catch (err) {
    sendErr(res, err, 400);
  }
});

export function enqueue(kind: AudioKind, title: string, params: Record<string, unknown>, extra?: Partial<AudioJob>, defer = false) {
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
    ...extra,
  });
  saveAudioJob(job);
  if (kind !== "clone" && !defer) void runAudioJob(id);
  return job;
}

audioRouter.post("/tts", (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
    const voice_id = String(req.body?.voice_id || "").trim();
    if (!text) throw new Error("text required");
    if (text.length > 1_000_000) throw new Error("text max 1,000,000 characters");
    if (!voice_id) throw new Error("voice_id required");
    const job = enqueue("tts", text.slice(0, 48) || "TTS", {
      text,
      voice_id,
      speed: clampSpeed(req.body?.speed),
      with_transcript: Boolean(req.body?.with_transcript),
      pronunciation_dictionary_id: req.body?.pronunciation_dictionary_id || undefined,
    });
    res.status(202).json(job);
  } catch (err) {
    sendErr(res, err);
  }
});

audioRouter.post("/dialogue", (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
    const speakers = req.body?.speakers;
    if (!text) throw new Error("text required (use A> / B> labels)");
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
    const job = enqueue("dialogue", "Dialogue", {
      text,
      speakers: clean,
      delay,
      with_transcript: Boolean(req.body?.with_transcript),
      pronunciation_dictionary_id: req.body?.pronunciation_dictionary_id || undefined,
    });
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
    const job = enqueue(
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
      },
    );
    res.status(201).json({ ...job, voice_id: cloned.voice_id });
  } catch (err) {
    sendErr(res, err);
  }
});

audioRouter.delete("/clones/:id", async (req, res) => {
  try {
    await ai33DeleteClone(req.params.id);
    res.json({ success: true, voice_id: asCloneVoiceId(req.params.id) });
  } catch (err) {
    sendErr(res, err);
  }
});

audioRouter.post("/voice-change", mediaUpload.single("file"), async (req, res) => {
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
    const job = enqueue(
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
      },
    );
    res.status(202).json(job);
  } catch (err) {
    sendErr(res, err);
  }
});

audioRouter.post("/dub", mediaUpload.single("file"), async (req, res) => {
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
    const job = enqueue(
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
      },
    );
    res.status(202).json(job);
  } catch (err) {
    sendErr(res, err);
  }
});

audioRouter.post("/isolate", mediaUpload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) throw new Error("file required");
    const id = randomUUID();
    const prepared = await prepareSubmitFile({ id, file, want: "passthrough" });
    const job = enqueue(
      "isolate",
      "Voice isolate",
      {
        submit_path: prepared.submit_path,
        submit_mime: prepared.submit_mime,
        submit_filename: prepared.submit_filename,
      },
      { id, input_mime: file.mimetype, input_filename: file.originalname || "audio" },
    );
    res.status(202).json(job);
  } catch (err) {
    sendErr(res, err);
  }
});

audioRouter.post("/stt", mediaUpload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) throw new Error("file required");
    const id = randomUUID();
    const prepared = await prepareSubmitFile({ id, file, want: "passthrough" });
    const job = enqueue(
      "stt",
      "Speech to text",
      {
        tag_audio_events: String(req.body?.tag_audio_events || "true") !== "false",
        submit_path: prepared.submit_path,
        submit_mime: prepared.submit_mime,
        submit_filename: prepared.submit_filename,
      },
      { id, input_mime: file.mimetype, input_filename: file.originalname || "audio" },
    );
    res.status(202).json(job);
  } catch (err) {
    sendErr(res, err);
  }
});

audioRouter.post("/sfx", (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
    if (text.length < 3 || text.length > 450) throw new Error("text must be 3–450 characters");
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
    const job = enqueue("sfx", text.slice(0, 48), {
      text,
      duration_seconds,
      prompt_influence,
      loop: Boolean(req.body?.loop),
    });
    res.status(202).json(job);
  } catch (err) {
    sendErr(res, err);
  }
});

audioRouter.post("/music", (req, res) => {
  try {
    const mode = req.body?.create_mode === "custom" ? "custom" : "simple";
    if (mode === "simple") {
      const prompt = String(req.body?.gpt_description_prompt || "").trim();
      if (prompt.length < 1 || prompt.length > 500) throw new Error("simple mode needs gpt_description_prompt (1–500)");
      const job = enqueue("music", prompt.slice(0, 48), {
        create_mode: "simple",
        gpt_description_prompt: prompt,
        make_instrumental: Boolean(req.body?.make_instrumental),
      });
      res.status(202).json(job);
      return;
    }
    const title = String(req.body?.title || "").slice(0, 80);
    const lyrics = String(req.body?.lyrics || "").slice(0, 5000);
    const tags = String(req.body?.tags || "").slice(0, 1000);
    if (!lyrics && !tags) throw new Error("custom mode needs lyrics or tags");
    const gender = req.body?.vocal_gender;
    const job = enqueue("music", title || "Suno", {
      create_mode: "custom",
      title,
      lyrics,
      tags,
      vocal_gender: gender === "m" || gender === "f" ? gender : undefined,
    });
    res.status(202).json(job);
  } catch (err) {
    sendErr(res, err);
  }
});

audioRouter.get("/dictionaries", async (_req, res) => {
  try {
    res.json(await ai33Dictionaries());
  } catch (err) {
    sendErr(res, err, 500);
  }
});

audioRouter.post("/dictionaries", async (req, res) => {
  try {
    res.status(201).json(await ai33DictionaryCreate(req.body));
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
    res.json(await ai33DictionaryGet(req.params.id));
  } catch (err) {
    sendErr(res, err);
  }
});

audioRouter.put("/dictionaries/:id", async (req, res) => {
  try {
    res.json(await ai33DictionaryUpdate(req.params.id, req.body));
  } catch (err) {
    sendErr(res, err);
  }
});

audioRouter.delete("/dictionaries/:id", async (req, res) => {
  try {
    res.json(await ai33DictionaryDelete(req.params.id));
  } catch (err) {
    sendErr(res, err);
  }
});
