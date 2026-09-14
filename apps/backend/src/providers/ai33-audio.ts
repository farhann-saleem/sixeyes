import { AI33_API_KEY, AI33_BASE_URL } from "../env.js";
import { ai33Poll, type Ai33Task } from "./ai33pro.js";

export { ai33Credits, ai33Delete, ai33Poll } from "./ai33pro.js";

function headers(extra?: HeadersInit): HeadersInit {
  if (!AI33_API_KEY) throw new Error("AI33_API_KEY missing");
  return { "xi-api-key": AI33_API_KEY, ...extra };
}

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

function messageOf(body: Record<string, unknown>, fallback: string) {
  const m = body.message || body.error || body.error_message;
  return typeof m === "string" && m.trim() ? m : fallback;
}

async function withRetry(fn: () => Promise<Response>, label: string): Promise<Response> {
  let last: Response | null = null;
  for (let i = 0; i < 4; i++) {
    const res = await fn();
    last = res;
    if (res.status !== 429 && !(res.status === 503 && (await peekBusy(res)))) return res;
    const wait = Number(res.headers.get("Retry-After") || 2 + i * 2);
    await new Promise((r) => setTimeout(r, Math.min(20, wait) * 1000));
  }
  if (!last) throw new Error(`${label} failed`);
  return last;
}

async function peekBusy(res: Response): Promise<boolean> {
  try {
    const clone = res.clone();
    const body = await parseJson(clone);
    return body.code === "server_busy";
  } catch {
    return false;
  }
}

function blobFile(buf: Buffer | Blob, mime: string, filename: string) {
  if (buf instanceof Blob) return buf;
  return new Blob([new Uint8Array(buf)], { type: mime || "application/octet-stream" });
}

async function createFromForm(path: string, form: FormData, label: string): Promise<string> {
  const res = await withRetry(
    () =>
      fetch(`${AI33_BASE_URL}${path}`, {
        method: "POST",
        headers: headers(),
        body: form,
        signal: AbortSignal.timeout(120_000),
      }),
    label,
  );
  const body = await parseJson(res);
  const taskId = body.task_id;
  if (!res.ok || typeof taskId !== "string") {
    throw new Error(messageOf(body, `${label} HTTP ${res.status}`));
  }
  return taskId;
}

async function createFromJson(path: string, payload: Record<string, unknown>, label: string): Promise<string> {
  const res = await withRetry(
    () =>
      fetch(`${AI33_BASE_URL}${path}`, {
        method: "POST",
        headers: headers({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60_000),
      }),
    label,
  );
  const body = await parseJson(res);
  const taskId = body.task_id;
  if (!res.ok || typeof taskId !== "string") {
    throw new Error(messageOf(body, `${label} HTTP ${res.status}`));
  }
  return taskId;
}

export const VOICE_PROVIDERS = [
  "elevenlabs",
  "minimax",
  "clone",
  "edge",
  "vbee",
  "fishaudio",
] as const;
export type VoiceProviderId = (typeof VOICE_PROVIDERS)[number];

export async function ai33Voices(query: Record<string, string | undefined>) {
  const provider = query.provider || "edge";
  if (!VOICE_PROVIDERS.includes(provider as VoiceProviderId)) {
    throw new Error(`provider must be ${VOICE_PROVIDERS.join(", ")}`);
  }
  const params = new URLSearchParams();
  params.set("provider", provider);
  for (const key of [
    "search",
    "q",
    "keywords",
    "page",
    "page_size",
    "limit",
    "language",
    "locale",
    "gender",
    "age",
    "accent",
    "category",
    "tags",
    "voice_ownership",
    "sort",
    "tag",
  ]) {
    const v = query[key];
    if (v) params.set(key, v);
  }
  const res = await fetch(`${AI33_BASE_URL}/v3/voices?${params}`, {
    headers: headers(),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await parseJson(res);
  if (!res.ok) throw new Error(messageOf(body, `voices HTTP ${res.status}`));
  return body;
}

type VoiceShelf = {
  id: string;
  label: string;
  provider: VoiceProviderId;
  total: number;
  voices: unknown[];
};

function voicesFrom(body: Record<string, unknown>): { voices: unknown[]; total: number } {
  const voices = Array.isArray(body.data) ? body.data : [];
  const pagination = body.pagination && typeof body.pagination === "object" ? (body.pagination as { total?: number }) : {};
  return { voices, total: typeof pagination.total === "number" ? pagination.total : voices.length };
}

/** Read-only catalog shelves. Plays vendor `preview_url` demos — not TTS generate, 0 credits. */
export async function ai33VoiceLibrary(): Promise<{
  credit_cost: 0;
  note: string;
  shelves: VoiceShelf[];
}> {
  const specs: Array<{ id: string; label: string; query: Record<string, string> }> = [
    {
      id: "elevenlabs-premade",
      label: "ElevenLabs demos",
      query: { provider: "elevenlabs", category: "premade", page: "1", page_size: "30" },
    },
    {
      id: "minimax-english",
      label: "MiniMax",
      query: { provider: "minimax", language: "English", page: "1", page_size: "24" },
    },
    {
      id: "edge-en-us",
      label: "Edge US (low cost)",
      query: { provider: "edge", locale: "en-US", page: "1", page_size: "24" },
    },
    {
      id: "vbee",
      label: "Vbee",
      query: { provider: "vbee", page: "1", page_size: "24" },
    },
    {
      id: "fishaudio",
      label: "Fish Audio",
      query: { provider: "fishaudio", page: "1", page_size: "24" },
    },
  ];
  const settled = await Promise.allSettled(specs.map((s) => ai33Voices(s.query)));
  const shelves: VoiceShelf[] = [];
  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    const row = settled[i];
    if (row.status !== "fulfilled") continue;
    const parsed = voicesFrom(row.value);
    shelves.push({
      id: spec.id,
      label: spec.label,
      provider: spec.query.provider as VoiceProviderId,
      total: spec.id === "elevenlabs-premade" ? parsed.voices.length : parsed.total,
      voices: parsed.voices,
    });
  }
  return {
    credit_cost: 0,
    note: "These are catalog preview clips (preview_url). Listening does not start a TTS task.",
    shelves,
  };
}

/** OpenAPI/owner docs: SFX and Suno are POST generate only. No GET preview catalog like /v3/voices. */
export const SFX_PROMPT_STARTERS = [
  {
    id: "thunder-rain",
    label: "Thunder + rain",
    prompt: "Thunder rolling with heavy rain",
    duration_seconds: 5,
    loop: false,
    source: "owner-docs",
  },
  {
    id: "footsteps",
    label: "Footsteps",
    prompt: "Footsteps on a wooden floor",
    duration_seconds: 4,
    loop: false,
    source: "openspeaker-marketing",
  },
  {
    id: "ui-click",
    label: "Game / UI",
    prompt: "Soft UI button click for a game",
    duration_seconds: 1,
    loop: false,
    source: "openspeaker-catalog",
  },
  {
    id: "podcast-whoosh",
    label: "Podcast transition",
    prompt: "Short podcast transition whoosh",
    duration_seconds: 2,
    loop: false,
    source: "openspeaker-catalog",
  },
  {
    id: "film-ambience",
    label: "Film ambience",
    prompt: "Quiet film ambience, distant city at night",
    duration_seconds: 8,
    loop: true,
    source: "openspeaker-catalog",
  },
  {
    id: "loop-wind",
    label: "Looping texture",
    prompt: "Seamless looping wind through trees",
    duration_seconds: 8,
    loop: true,
    source: "openspeaker-catalog",
  },
] as const;

export const MUSIC_PROMPT_STARTERS = [
  {
    id: "border-simple",
    label: "Indie pop (simple)",
    create_mode: "simple" as const,
    gpt_description_prompt: "Percussive indie pop song about the border between two lives",
    make_instrumental: false,
    source: "owner-docs",
  },
  {
    id: "border-custom",
    label: "Border Lights (custom)",
    create_mode: "custom" as const,
    title: "Border Lights",
    lyrics: "[Verse 1]\nI walk the line between two lives",
    tags: "indie pop, emotional, cinematic drums",
    vocal_gender: "f" as const,
    source: "owner-docs",
  },
  {
    id: "instrumental-bed",
    label: "Instrumental bed",
    create_mode: "simple" as const,
    gpt_description_prompt: "Cinematic instrumental bed for a social video, no vocals",
    make_instrumental: true,
    source: "openspeaker-catalog",
  },
] as const;

export type LibraryClip = {
  id: string;
  source: "studio" | "vendor";
  kind: "sfx" | "music";
  title: string;
  play_url: string;
  alt_url: string | null;
  cover_url: string | null;
  prompt: string | null;
};

export async function ai33ListTasks(query: { type?: string; page?: number; limit?: number }) {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("limit", String(query.limit ?? 20));
  if (query.type) params.set("type", query.type);
  const res = await fetch(`${AI33_BASE_URL}/v1/tasks?${params}`, {
    headers: headers({ "Content-Type": "application/json" }),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await parseJson(res);
  if (!res.ok) throw new Error(messageOf(body, `tasks HTTP ${res.status}`));
  const data = Array.isArray(body.data) ? (body.data as Ai33Task[]) : [];
  const total = typeof body.total === "number" ? body.total : data.length;
  return { data, total };
}

function promptFromTask(task: Ai33Task): string | null {
  const meta = task.metadata || {};
  for (const key of ["text", "gpt_description_prompt", "title", "tags"]) {
    const v = meta[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function clipsFromVendorTasks(tasks: Ai33Task[], kind: "sfx" | "music"): LibraryClip[] {
  const clips: LibraryClip[] = [];
  for (const task of tasks) {
    if (task.status !== "done") continue;
    const extracted = extractAudioOutputs(task);
    const play = extracted.audioUrls[0];
    if (!play || !task.id) continue;
    clips.push({
      id: task.id,
      source: "vendor",
      kind,
      title: promptFromTask(task)?.slice(0, 72) || task.id,
      play_url: play,
      alt_url: extracted.audioUrls[1] || null,
      cover_url: extracted.coverUrl,
      prompt: promptFromTask(task),
    });
  }
  return clips;
}

/** Read-only. No generate. SFX/Suno have no preview_url catalog; this is history + prompt starters. */
export async function ai33SfxMusicHistory(): Promise<{
  sfx: LibraryClip[];
  music: LibraryClip[];
}> {
  const [sfx, music] = await Promise.all([
    ai33ListTasks({ type: "sound-effect", page: 1, limit: 20 }).catch(() => ({ data: [] as Ai33Task[] })),
    ai33ListTasks({ type: "suno_music", page: 1, limit: 20 }).catch(() => ({ data: [] as Ai33Task[] })),
  ]);
  return {
    sfx: clipsFromVendorTasks(sfx.data, "sfx"),
    music: clipsFromVendorTasks(music.data, "music"),
  };
}

export async function ai33Tts(opts: {
  text: string;
  voice_id: string;
  speed?: number;
  with_transcript?: boolean;
  pronunciation_dictionary_id?: string;
  file_name?: string;
}): Promise<string> {
  const form = new FormData();
  form.append("text", opts.text);
  form.append("voice_id", opts.voice_id);
  form.append("speed", String(opts.speed ?? 1));
  form.append("with_transcript", opts.with_transcript ? "true" : "false");
  if (opts.pronunciation_dictionary_id) {
    form.append("pronunciation_dictionary_id", opts.pronunciation_dictionary_id);
  }
  if (opts.file_name) form.append("file_name", opts.file_name);
  return createFromForm("/v3/text-to-speech", form, "tts");
}

export async function ai33Dialogue(opts: {
  text: string;
  speakers: Array<{ voice_id: string; speed?: number }>;
  delay?: number;
  with_transcript?: boolean;
  pronunciation_dictionary_id?: string;
}): Promise<string> {
  const form = new FormData();
  form.append("text", opts.text);
  form.append("speakers", JSON.stringify(opts.speakers));
  form.append("delay", String(opts.delay ?? 0));
  form.append("with_transcript", opts.with_transcript ? "true" : "false");
  if (opts.pronunciation_dictionary_id) {
    form.append("pronunciation_dictionary_id", opts.pronunciation_dictionary_id);
  }
  return createFromForm("/v3/text-to-speech/dialogue", form, "dialogue");
}

export type CloneResult = { voice_id: string; raw: Record<string, unknown> };

export function asCloneVoiceId(id: string) {
  return id.startsWith("clone_") ? id : `clone_${id}`;
}

export async function ai33CloneVoice(opts: {
  voice_name: string;
  audio: Buffer;
  filename: string;
  mime: string;
}): Promise<CloneResult> {
  const form = new FormData();
  form.append("voice_name", opts.voice_name);
  form.append("audio_file", blobFile(opts.audio, opts.mime, opts.filename), opts.filename);
  const res = await fetch(`${AI33_BASE_URL}/v3/text-to-speech/voice-clone`, {
    method: "POST",
    headers: headers(),
    body: form,
    signal: AbortSignal.timeout(120_000),
  });
  const body = await parseJson(res);
  if (!res.ok) throw new Error(messageOf(body, `clone HTTP ${res.status}`));
  const data = (body.data && typeof body.data === "object" ? body.data : body) as Record<string, unknown>;
  const rawId = data.voice_id;
  if (typeof rawId !== "string" || !rawId) {
    throw new Error("clone succeeded but no data.voice_id");
  }
  return { voice_id: asCloneVoiceId(rawId), raw: body };
}

export async function ai33DeleteClone(voiceCloneId: string): Promise<void> {
  const id = voiceCloneId.replace(/^clone_/, "");
  const res = await fetch(`${AI33_BASE_URL}/v3/text-to-speech/voice-clone/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: headers(),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await parseJson(res);
  if (!res.ok) throw new Error(messageOf(body, `delete clone HTTP ${res.status}`));
}

export async function ai33Dictionaries() {
  const res = await fetch(`${AI33_BASE_URL}/v3/dictionaries`, {
    headers: headers(),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await parseJson(res);
  if (!res.ok) throw new Error(messageOf(body, `dictionaries HTTP ${res.status}`));
  return body;
}

export async function ai33DictionaryCreate(payload: unknown) {
  const res = await fetch(`${AI33_BASE_URL}/v3/dictionaries`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await parseJson(res);
  if (!res.ok) throw new Error(messageOf(body, `create dictionary HTTP ${res.status}`));
  return body;
}

export async function ai33DictionaryGet(id: string) {
  const res = await fetch(`${AI33_BASE_URL}/v3/dictionaries/${encodeURIComponent(id)}`, {
    headers: headers(),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await parseJson(res);
  if (!res.ok) throw new Error(messageOf(body, `dictionary HTTP ${res.status}`));
  return body;
}

export async function ai33DictionaryUpdate(id: string, payload: unknown) {
  const res = await fetch(`${AI33_BASE_URL}/v3/dictionaries/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await parseJson(res);
  if (!res.ok) throw new Error(messageOf(body, `update dictionary HTTP ${res.status}`));
  return body;
}

export async function ai33DictionaryDelete(id: string) {
  const res = await fetch(`${AI33_BASE_URL}/v3/dictionaries/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: headers({ "Content-Type": "application/json" }),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await parseJson(res);
  if (!res.ok) throw new Error(messageOf(body, `delete dictionary HTTP ${res.status}`));
  return body;
}

export async function ai33DictionaryPreview(payload: unknown) {
  const res = await fetch(`${AI33_BASE_URL}/v3/dictionaries/preview`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await parseJson(res);
  if (!res.ok) throw new Error(messageOf(body, `preview dictionary HTTP ${res.status}`));
  return body;
}

/** Owner docs: receive_url is required on dubbing. We still poll; this URL is the documented example. */
const DUBBING_RECEIVE_URL = "https://example.com/api/callback";

export async function ai33Dub(opts: {
  file: Buffer | Blob;
  filename: string;
  mime: string;
  target_lang: string;
  source_lang?: string;
  num_speakers?: string;
  disable_voice_cloning?: boolean;
  voice_id?: string;
}): Promise<string> {
  const form = new FormData();
  form.append("file", blobFile(opts.file, opts.mime, opts.filename), opts.filename);
  form.append("target_lang", opts.target_lang);
  form.append("source_lang", opts.source_lang || "auto");
  form.append("num_speakers", opts.num_speakers ?? "0");
  form.append("disable_voice_cloning", opts.disable_voice_cloning ? "true" : "false");
  form.append("receive_url", DUBBING_RECEIVE_URL);
  if (opts.voice_id) form.append("voice_id", opts.voice_id);
  return createFromForm("/v1/task/dubbing", form, "dubbing");
}

export async function ai33VoiceChanger(opts: {
  file: Buffer | Blob;
  filename: string;
  mime: string;
  voice_id: string;
  model_id?: string;
  voice_settings?: Record<string, unknown>;
  remove_background_noise?: boolean;
}): Promise<string> {
  const form = new FormData();
  form.append("file", blobFile(opts.file, opts.mime, opts.filename), opts.filename);
  form.append("voice_id", opts.voice_id);
  form.append("model_id", opts.model_id || "eleven_multilingual_sts_v2");
  if (opts.voice_settings) form.append("voice_settings", JSON.stringify(opts.voice_settings));
  form.append("remove_background_noise", opts.remove_background_noise ? "true" : "false");
  return createFromForm("/v1/task/voice-changer", form, "voice-changer");
}

export async function ai33Isolate(opts: { file: Buffer | Blob; filename: string; mime: string }): Promise<string> {
  const form = new FormData();
  form.append("file", blobFile(opts.file, opts.mime, opts.filename), opts.filename);
  return createFromForm("/v1/task/voice-isolate", form, "voice-isolate");
}

export async function ai33Stt(opts: {
  file: Buffer | Blob;
  filename: string;
  mime: string;
  tag_audio_events?: boolean;
}): Promise<string> {
  const form = new FormData();
  form.append("file", blobFile(opts.file, opts.mime, opts.filename), opts.filename);
  form.append("tag_audio_events", opts.tag_audio_events === false ? "false" : "true");
  return createFromForm("/v1/task/speech-to-text", form, "speech-to-text");
}

export async function ai33Sfx(opts: {
  text: string;
  duration_seconds?: number;
  prompt_influence?: number;
  loop?: boolean;
}): Promise<string> {
  const payload: Record<string, unknown> = {
    text: opts.text,
    prompt_influence: opts.prompt_influence ?? 0.3,
    loop: Boolean(opts.loop),
    model_id: "eleven_text_to_sound_v2",
  };
  if (opts.duration_seconds != null) payload.duration_seconds = opts.duration_seconds;
  return createFromJson("/v1/task/sound-effect", payload, "sound-effect");
}

export async function ai33Music(opts: {
  create_mode?: "simple" | "custom";
  gpt_description_prompt?: string;
  make_instrumental?: boolean;
  title?: string;
  lyrics?: string;
  tags?: string;
  vocal_gender?: "f" | "m";
}): Promise<string> {
  const mode = opts.create_mode || "simple";
  const payload: Record<string, unknown> = { create_mode: mode };
  if (mode === "simple") {
    payload.gpt_description_prompt = opts.gpt_description_prompt;
    payload.make_instrumental = Boolean(opts.make_instrumental);
  } else {
    if (opts.title) payload.title = opts.title;
    if (opts.lyrics) payload.lyrics = opts.lyrics;
    if (opts.tags) payload.tags = opts.tags;
    if (opts.vocal_gender) payload.vocal_gender = opts.vocal_gender;
  }
  return createFromJson("/v1s/task/music-generation", payload, "suno");
}

function httpUrl(value: unknown): string | null {
  return typeof value === "string" && /^https?:\/\//.test(value) ? value : null;
}

export function extractAudioOutputs(task: Ai33Task): {
  audioUrls: string[];
  srtUrl: string | null;
  coverUrl: string | null;
  transcript: string | null;
} {
  const meta = task.metadata || {};
  const audioUrls: string[] = [];
  const push = (v: unknown) => {
    const u = httpUrl(v);
    if (u && !audioUrls.includes(u)) audioUrls.push(u);
  };
  push(meta.audio_url);
  push(meta.replacement_audio_url);
  if (Array.isArray(meta.all_audio_urls)) {
    for (const u of meta.all_audio_urls) push(u);
  }
  const suno = meta.suno_result;
  if (suno && typeof suno === "object") {
    const clips = (suno as { clips?: unknown }).clips;
    if (Array.isArray(clips)) {
      for (const clip of clips) {
        if (clip && typeof clip === "object") push((clip as { audio_url?: unknown }).audio_url);
      }
    }
  }
  const srtUrl = httpUrl(meta.srt_url);
  const coverUrl = httpUrl(meta.image_url);
  let transcript: string | null = null;
  for (const key of ["text", "transcript", "transcription"]) {
    const v = meta[key];
    if (typeof v === "string" && v.trim()) {
      transcript = v;
      break;
    }
  }
  return { audioUrls, srtUrl, coverUrl, transcript };
}

export async function downloadUrl(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(180_000) });
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** OpenSpeaker ~30 languages; codes are ISO-639-1 as owner/ElevenLabs v1 dubbing require. */
export const DUB_TARGET_LANGS: Array<{ code: string; label: string }> = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "zh", label: "Chinese" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "hi", label: "Hindi" },
  { code: "ar", label: "Arabic" },
  { code: "ru", label: "Russian" },
  { code: "tr", label: "Turkish" },
  { code: "pl", label: "Polish" },
  { code: "nl", label: "Dutch" },
  { code: "id", label: "Indonesian" },
  { code: "sv", label: "Swedish" },
  { code: "fi", label: "Finnish" },
  { code: "da", label: "Danish" },
  { code: "no", label: "Norwegian" },
  { code: "cs", label: "Czech" },
  { code: "ro", label: "Romanian" },
  { code: "hu", label: "Hungarian" },
  { code: "el", label: "Greek" },
  { code: "uk", label: "Ukrainian" },
  { code: "vi", label: "Vietnamese" },
  { code: "th", label: "Thai" },
  { code: "he", label: "Hebrew" },
  { code: "fil", label: "Filipino" },
  { code: "ms", label: "Malay" },
];
