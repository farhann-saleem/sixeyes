import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ensureAuthed } from "./auth";
import { promptIssue } from "./prompt-guard";
import { SecureLine, SecurePrompt } from "./SecurePrompt";
import type { AudioDesk } from "./Nav";
import { formatDuration, json } from "./studio";
import { VoiceLibraryBrowse, VoicePicker } from "./VoiceLibrary";
import { AssetLibraryBrowse, PromptStarters, type MusicStarter, type SfxStarter } from "./AudioLibrary";
import { NowPlayingBar } from "./audio-ui";
import "./audio-studio.css";

type Mode =
  | "tts"
  | "change"
  | "dub"
  | "clone"
  | "voices"
  | "dialogue"
  | "dictionary"
  | "isolate"
  | "stt"
  | "sfx"
  | "music";

type AudioJob = {
  id: string;
  kind: string;
  title: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED";
  phase_label?: string;
  created_at: string;
  duration_ms: number | null;
  credit_cost: number | null;
  credits_remaining: number | null;
  error: string | null;
  has_srt?: boolean;
  has_video?: boolean;
  has_cover?: boolean;
  has_alt?: boolean;
  output_filename?: string | null;
  transcript?: string | null;
  params?: Record<string, unknown>;
  voice_id?: string;
};

type Health = {
  credits_remaining: number | null;
  ffmpeg: boolean;
  dub_target_langs: Array<{ code: string; label: string }>;
  voice_changer_models: Array<{ id: string; label: string }>;
  honest: { lip_sync: boolean; video_change: string };
};

const PRIMARY: Array<{ id: Mode; label: string }> = [
  { id: "tts", label: "Text to Speech" },
  { id: "voices", label: "Library" },
  { id: "change", label: "Voice Change" },
  { id: "dub", label: "Translate" },
  { id: "clone", label: "Clone" },
];

const EXTRA: Array<{ id: Mode; label: string }> = [
  { id: "dialogue", label: "Dialogue" },
  { id: "dictionary", label: "Dictionary" },
  { id: "isolate", label: "Isolate" },
  { id: "stt", label: "Speech to text" },
  { id: "sfx", label: "Sound effects" },
  { id: "music", label: "Suno music" },
];

const FORM_HEAD: Record<Mode, { kicker: string; title: string }> = {
  tts: { kicker: "Speak", title: "Text to speech" },
  voices: { kicker: "Library", title: "Voices and clips" },
  change: { kicker: "Change", title: "Swap the speaker" },
  dub: { kicker: "Translate", title: "Soundtrack only" },
  clone: { kicker: "Clone", title: "Save a voice" },
  dialogue: { kicker: "Speak", title: "Two speakers" },
  dictionary: { kicker: "Library", title: "Pronunciation" },
  isolate: { kicker: "Change", title: "Strip the noise" },
  stt: { kicker: "Change", title: "Speech to text" },
  sfx: { kicker: "Make", title: "Sound effect" },
  music: { kicker: "Make", title: "Suno music" },
};

function live(job?: AudioJob | null) {
  return job?.status === "IN_PROGRESS" || job?.status === "PENDING";
}

function deskToMode(desk?: AudioDesk): Mode {
  return desk ?? "tts";
}

export function AudioStudio({ desk }: { desk?: AudioDesk } = {}) {
  const [mode, setMode] = useState<Mode>(() => deskToMode(desk));
  const [libraryPane, setLibraryPane] = useState<"voices" | "sfx" | "music">("voices");

  useEffect(() => {
    setMode(deskToMode(desk));
  }, [desk]);
  const [health, setHealth] = useState<Health | null>(null);
  const [jobs, setJobs] = useState<AudioJob[]>([]);
  const [current, setCurrent] = useState<AudioJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [voiceName, setVoiceName] = useState("");
  function chooseVoice(id: string, name = "") {
    setVoiceId(id);
    setVoiceName(name.trim() || "Selected voice");
  }
  const [speakers, setSpeakers] = useState<string[]>(["", ""]);
  const [speed, setSpeed] = useState("1");
  const [transcript, setTranscript] = useState(false);
  const [dictId, setDictId] = useState("");
  const [delay, setDelay] = useState("0.4");
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [cloneName, setCloneName] = useState("");
  const [targetLang, setTargetLang] = useState("en");
  const [numSpeakers, setNumSpeakers] = useState("0");
  const [disableClone, setDisableClone] = useState(false);
  const [changerModel, setChangerModel] = useState("eleven_multilingual_sts_v2");
  const [removeNoise, setRemoveNoise] = useState(true);
  const [sfxDuration, setSfxDuration] = useState("");
  const [sfxInfluence, setSfxInfluence] = useState("0.3");
  const [sfxLoop, setSfxLoop] = useState(false);
  const [musicMode, setMusicMode] = useState<"simple" | "custom">("simple");
  const [musicPrompt, setMusicPrompt] = useState("");
  const [instrumental, setInstrumental] = useState(false);
  const [lyrics, setLyrics] = useState("");
  const [tags, setTags] = useState("");
  const [title, setTitle] = useState("");
  const [gender, setGender] = useState("");
  const [dictName, setDictName] = useState("Brand names");
  const [dictFrom, setDictFrom] = useState("AI");
  const [dictTo, setDictTo] = useState("");
  const [dictPreview, setDictPreview] = useState<string | null>(null);
  const [dicts, setDicts] = useState<unknown>(null);
  const recChunks = useRef<Blob[]>([]);
  const recRef = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);

  const working = busy || live(current);

  function applySfxStarter(starter: SfxStarter) {
    setText(starter.prompt);
    setSfxDuration(starter.duration_seconds != null ? String(starter.duration_seconds) : "");
    setSfxLoop(Boolean(starter.loop));
    setMode("sfx");
  }

  function applyMusicStarter(starter: MusicStarter) {
    setMusicMode(starter.create_mode);
    if (starter.create_mode === "simple") {
      setMusicPrompt(starter.gpt_description_prompt || "");
      setInstrumental(Boolean(starter.make_instrumental));
    } else {
      setTitle(starter.title || "");
      setLyrics(starter.lyrics || "");
      setTags(starter.tags || "");
      setGender(starter.vocal_gender || "");
    }
    setMode("music");
  }

  function loadJobs() {
    return json<{ jobs: AudioJob[] }>("/api/audio/jobs").then((body) => {
      setJobs(body.jobs);
      const liveJob = body.jobs.find(live) ?? null;
      setCurrent((prev) => {
        if (prev?.id) {
          const updated = body.jobs.find((j) => j.id === prev.id);
          return updated ?? prev;
        }
        return liveJob;
      });
    });
  }

  useEffect(() => {
    json<Health>("/api/audio/health")
      .then(setHealth)
      .catch((e: Error) => setError(e.message));
    loadJobs().catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!live(current)) return;
    const t = window.setInterval(() => {
      if (!current?.id) return;
      json<AudioJob>(`/api/audio/jobs/${current.id}`)
        .then((job) => {
          setCurrent(job);
          if (job.status === "COMPLETED" || job.status === "FAILED" || job.status === "CANCELLED") {
            setBusy(false);
            loadJobs().catch(() => undefined);
            json<Health>("/api/audio/health").then(setHealth).catch(() => undefined);
          }
        })
        .catch((e: Error) => setError(e.message));
    }, 2000);
    return () => window.clearInterval(t);
  }, [current?.id, current?.status]);

  async function postJson(url: string, body: unknown) {
    if (!ensureAuthed()) return;
    setBusy(true);
    setError(null);
    try {
      const job = await json<AudioJob>(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setCurrent(job);
      if (job.status !== "IN_PROGRESS" && job.status !== "PENDING") setBusy(false);
      await loadJobs();
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function postFile(url: string, fields: Record<string, string>) {
    if (!file) {
      setError("Upload a file first.");
      return;
    }
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.append("file", file);
    for (const [k, v] of Object.entries(fields)) body.append(k, v);
    try {
      const job = await json<AudioJob>(url, { method: "POST", body });
      setCurrent(job);
      if (job.status !== "IN_PROGRESS" && job.status !== "PENDING") setBusy(false);
      await loadJobs();
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function onTts(e: FormEvent) {
    e.preventDefault();
    const blocked = promptIssue(text, "speech");
    if (blocked) { setError(blocked); return; }
    await postJson("/api/audio/tts", {
      text,
      voice_id: voiceId,
      speed: Number(speed),
      with_transcript: transcript,
      pronunciation_dictionary_id: dictId || undefined,
    });
  }

  async function onDialogue(e: FormEvent) {
    e.preventDefault();
    const blocked = promptIssue(text, "speech");
    if (blocked) { setError(blocked); return; }
    await postJson("/api/audio/dialogue", {
      text,
      delay: Number(delay),
      with_transcript: transcript,
      pronunciation_dictionary_id: dictId || undefined,
      speakers: speakers.map((id) => ({ voice_id: id, speed: Number(speed) })),
    });
  }

  async function onClone(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Record or upload a 3–30s sample.");
      return;
    }
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.append("audio", file);
    body.append("voice_name", cloneName);
    body.append("consent", consent ? "true" : "false");
    try {
      const job = await json<AudioJob & { voice_id?: string }>("/api/audio/clone", { method: "POST", body });
      setCurrent(job);
      if (job.voice_id) chooseVoice(job.voice_id, cloneName.trim() || "Cloned voice");
      setBusy(false);
      await loadJobs();
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function startRec() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream);
    recChunks.current = [];
    rec.ondataavailable = (ev) => {
      if (ev.data.size) recChunks.current.push(ev.data);
    };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(recChunks.current, { type: rec.mimeType || "audio/webm" });
      setFile(new File([blob], "clone-sample.webm", { type: blob.type }));
    };
    recRef.current = rec;
    rec.start();
    setRecording(true);
  }

  function stopRec() {
    recRef.current?.stop();
    setRecording(false);
  }

  async function stopJob() {
    if (!current || !live(current)) return;
    try {
      setCurrent(await json<AudioJob>(`/api/audio/jobs/${current.id}/cancel`, { method: "POST" }));
      setBusy(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function saveDict(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const created = await json<Record<string, unknown>>("/api/audio/dictionaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: dictName,
          rules: [{ from: dictFrom, to: dictTo, matchType: "word", caseSensitive: true }],
        }),
      });
      const nested = created.data && typeof created.data === "object" ? (created.data as { id?: unknown }) : null;
      const id = typeof created.id === "string" ? created.id : typeof nested?.id === "string" ? nested.id : null;
      if (id) setDictId(id);
      setDicts(await json("/api/audio/dictionaries"));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function previewDict() {
    try {
      const body = await json<{ output?: string; input?: string }>("/api/audio/dictionaries/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: dictFrom,
          rules: [{ from: dictFrom, to: dictTo, matchType: "word", caseSensitive: true }],
        }),
      });
      setDictPreview(body.output || JSON.stringify(body));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    if (mode !== "dictionary") return;
    json("/api/audio/dictionaries")
      .then(setDicts)
      .catch((e: Error) => setError(e.message));
  }, [mode]);

  const lede = useMemo(() => {
    if (mode === "tts") return "Paste a script or SRT, pick a voice, generate speech. Async — we poll the vendor.";
    if (mode === "voices") return "Hover a cover to preview. Voices are free demos. Effects and music need Generate before they play.";
    if (mode === "change") return "Swap the speaker. Upload audio, or a video and we mux the new voice onto the same picture.";
    if (mode === "dub") return "Translate the soundtrack and get SRT. This is audio dubbing, not lip-sync.";
    if (mode === "clone") return "3–30 second sample, 10MB. Consent required. Then pick it as a clone_ voice.";
    if (mode === "dialogue") return "Label lines A> and B>. Each speaker is a different voice.";
    if (mode === "dictionary") return "Replacement rules for brand names. Attach the id on TTS or dialogue.";
    if (mode === "isolate") return "Strip background noise from a recording.";
    if (mode === "stt") return "Audio to text. Download SRT when the vendor returns srt_url.";
    if (mode === "sfx") return "Describe a sound. Omit duration for auto (200 credits) or set 0.5–30s.";
    return "Simple: describe a song. Custom: title, lyrics, tags. Suno returns up to two clips.";
  }, [mode]);

  return (
    <main className="studio audio-studio audio-page">
      <header className="audio-toolbar">
        <div>
          <p className="kicker">Audio studio</p>
          <h1>Make the soundtrack</h1>
          <p className="lede">{lede}</p>
        </div>
        <p className="audio-credits">
          {health?.credits_remaining ?? "—"} credits
          {health && !health.ffmpeg ? " · ffmpeg missing" : ""}
        </p>
      </header>

      <div className="audio-tool-tabs" role="tablist" aria-label="Audio tools">
        {[...PRIMARY, ...EXTRA].map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            className={mode === m.id ? "active" : undefined}
            onClick={() => setMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "dub" ? (
        <p className="notice warn">
          Translate does not move lips. We replace the soundtrack and give you an SRT. Mouths stay on the original language.
        </p>
      ) : null}
      {mode === "change" ? (
        <p className="muted" style={{ margin: "0 22px 12px" }}>
          {health?.honest.video_change}
        </p>
      ) : null}

      {live(current) ? (
        <p className="notice">
          {current?.phase_label || "Working…"}{" "}
          <button type="button" className="btn ghost small" onClick={() => void stopJob()}>
            Stop
          </button>
        </p>
      ) : null}
      {error ? <p className="notice">{error}</p> : null}

      <div className="audio-body">
      {mode === "voices" ? (
        <div className="audio-layout">
          <section className="compose-panel">
            <p className="kicker">{FORM_HEAD.voices.kicker}</p>
            <h2>{FORM_HEAD.voices.title}</h2>
            <p className="lede">Hover a cover to preview. Voices are free demos. Effects and music play after you generate.</p>
          <div className="audio-bin-tabs" role="tablist" aria-label="Library shelves">
            {(
              [
                ["voices", "Voices"],
                ["sfx", "Effects"],
                ["music", "Music"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={libraryPane === id}
                className={libraryPane === id ? "active" : undefined}
                onClick={() => setLibraryPane(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {libraryPane === "voices" ? (
              <VoiceLibraryBrowse selected={voiceId} onSelect={chooseVoice} />
          ) : (
            <AssetLibraryBrowse pane={libraryPane} onUseSfx={applySfxStarter} onUseMusic={applyMusicStarter} />
          )}
          </section>
          <aside className="audio-result">
            <section className="compose-panel">
              <p className="kicker">Selected</p>
              <h2>{voiceName || "Nothing picked"}</h2>
              <p className="lede">
                {voiceId
                  ? "Use this voice on Text to Speech, Voice Change, or Translate."
                  : "Pick a voice on the left. It shows here, then you take it to a generate desk."}
              </p>
              {voiceId ? (
                <button type="button" className="btn lime" onClick={() => setMode("tts")}>
                  Use in Text to Speech
                </button>
              ) : null}
            </section>
          </aside>
        </div>
      ) : (
      <div className="audio-layout">
        <form
          className="compose-panel"
          onSubmit={(e) => {
            if (mode === "tts") void onTts(e);
            else if (mode === "dialogue") void onDialogue(e);
            else if (mode === "clone") void onClone(e);
            else if (mode === "change") {
              e.preventDefault();
              void postFile("/api/audio/voice-change", {
                voice_id: voiceId,
                model_id: changerModel,
                remove_background_noise: removeNoise ? "true" : "false",
              });
            } else if (mode === "dub") {
              e.preventDefault();
              void postFile("/api/audio/dub", {
                target_lang: targetLang,
                voice_id: voiceId,
                num_speakers: numSpeakers,
                disable_voice_cloning: disableClone ? "true" : "false",
              });
            } else if (mode === "isolate") {
              e.preventDefault();
              void postFile("/api/audio/isolate", {});
            } else if (mode === "stt") {
              e.preventDefault();
              void postFile("/api/audio/stt", {});
            } else if (mode === "sfx") {
              e.preventDefault();
              const blocked = promptIssue(text, "sfx");
              if (blocked) { setError(blocked); return; }
              void postJson("/api/audio/sfx", {
                text,
                duration_seconds: sfxDuration === "" ? undefined : Number(sfxDuration),
                prompt_influence: Number(sfxInfluence),
                loop: sfxLoop,
              });
            } else if (mode === "music") {
              e.preventDefault();
              const blocked = musicMode === "simple"
                ? promptIssue(musicPrompt, "music")
                : promptIssue(lyrics, "lyrics") || promptIssue(tags, "tags") || promptIssue(title, "name");
              if (blocked) { setError(blocked); return; }
              void postJson(
                "/api/audio/music",
                musicMode === "simple"
                  ? { create_mode: "simple", gpt_description_prompt: musicPrompt, make_instrumental: instrumental }
                  : { create_mode: "custom", title, lyrics, tags, vocal_gender: gender || undefined },
              );
            } else if (mode === "dictionary") void saveDict(e);
          }}
        >
          <p className="kicker">{FORM_HEAD[mode].kicker}</p>
          <h2>{FORM_HEAD[mode].title}</h2>
          {mode === "tts" || mode === "dialogue" || mode === "sfx" ? (
            <>
              <label htmlFor="script">{mode === "sfx" ? "Sound description" : "Script"}</label>
              <SecurePrompt
                id="script"
                kind={mode === "sfx" ? "sfx" : "speech"}
                rows={mode === "sfx" ? 4 : 8}
                value={text}
                disabled={working}
                placeholder={
                  mode === "dialogue"
                    ? "A> Hello.\nB> Hi there."
                    : mode === "sfx"
                      ? "Thunder rolling with heavy rain"
                      : "Paste script or SRT…"
                }
                onChange={setText}
              />
            </>
          ) : null}

          {mode === "tts" || mode === "change" || mode === "dub" ? (
            <>
              <label>{mode === "dub" ? "Replacement voice (optional)" : "Voice"}</label>
              <VoicePicker value={voiceId} onChange={chooseVoice} disabled={working} />
              <div className="audio-gen-bar">
                <span className="audio-gen-ava" aria-hidden>
                  {(voiceName || "?").slice(0, 1).toUpperCase()}
                </span>
                <span className="audio-gen-name">{voiceName || "Pick a voice"}</span>
                <button type="submit" className="btn lime" disabled={working}>
                  {working ? "Working…" : "Generate"}
                </button>
              </div>
            </>
          ) : null}

          {mode === "dialogue" ? (
            <>
              {speakers.map((id, i) => (
                <div key={i} className="speaker-row">
                  <label>Speaker {String.fromCharCode(65 + i)}</label>
                  <VoicePicker
                    value={id}
                    disabled={working}
                    onChange={(next) => setSpeakers((prev) => prev.map((v, j) => (j === i ? next : v)))}
                  />
                  {speakers.length > 2 ? (
                    <button
                      type="button"
                      className="btn ghost small"
                      disabled={working}
                      onClick={() => setSpeakers((prev) => prev.filter((_, j) => j !== i))}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              ))}
              {speakers.length < 26 ? (
                <button
                  type="button"
                  className="btn ghost small"
                  disabled={working}
                  onClick={() => setSpeakers((prev) => [...prev, ""])}
                >
                  Add speaker
                </button>
              ) : null}
              <label htmlFor="delay">Pause between lines (0–5s)</label>
              <input id="delay" value={delay} disabled={working} onChange={(e) => setDelay(e.target.value)} />
            </>
          ) : null}

          {mode === "tts" || mode === "dialogue" ? (
            <>
              <label htmlFor="speed">Speed (0.5–1.5)</label>
              <input id="speed" value={speed} disabled={working} onChange={(e) => setSpeed(e.target.value)} />
              <label htmlFor="dict">Pronunciation dictionary id (optional)</label>
              <input id="dict" value={dictId} disabled={working} onChange={(e) => setDictId(e.target.value)} />
              <label className="check">
                <input type="checkbox" checked={transcript} disabled={working} onChange={(e) => setTranscript(e.target.checked)} />
                Also ask for a transcript
              </label>
            </>
          ) : null}

          {mode === "change" || mode === "dub" || mode === "isolate" || mode === "stt" || mode === "clone" ? (
            <>
              <label htmlFor="media">
                {mode === "clone" ? "Sample (3–30s)" : mode === "dub" || mode === "change" ? "Audio or video" : "Audio"}
              </label>
              <input
                id="media"
                type="file"
                disabled={working}
                accept={mode === "clone" ? "audio/*" : "audio/*,video/*"}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file ? <p className="muted">{file.name}</p> : null}
            </>
          ) : null}

          {mode === "clone" ? (
            <>
              <div className="head-side">
                {!recording ? (
                  <button type="button" className="btn ghost" onClick={() => void startRec()} disabled={working}>
                    Record
                  </button>
                ) : (
                  <button type="button" className="btn" onClick={stopRec}>
                    Stop recording
                  </button>
                )}
              </div>
              <label htmlFor="cname">Voice name</label>
              <input id="cname" value={cloneName} disabled={working} onChange={(e) => setCloneName(e.target.value)} />
              <label className="check">
                <input type="checkbox" checked={consent} disabled={working} onChange={(e) => setConsent(e.target.checked)} />
                I own this voice or have permission to clone it
              </label>
            </>
          ) : null}

          {mode === "change" ? (
            <>
              <label htmlFor="cmodel">Model</label>
              <select id="cmodel" value={changerModel} disabled={working} onChange={(e) => setChangerModel(e.target.value)}>
                {(health?.voice_changer_models || []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <label className="check">
                <input
                  type="checkbox"
                  checked={removeNoise}
                  disabled={working}
                  onChange={(e) => setRemoveNoise(e.target.checked)}
                />
                Remove background noise
              </label>
            </>
          ) : null}

          {mode === "dub" ? (
            <>
              <label htmlFor="lang">Target language</label>
              <select id="lang" value={targetLang} disabled={working} onChange={(e) => setTargetLang(e.target.value)}>
                {(health?.dub_target_langs || []).map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label} ({l.code})
                  </option>
                ))}
              </select>
              <label htmlFor="spk">Speakers (0 = detect, 1–9)</label>
              <input id="spk" value={numSpeakers} disabled={working} onChange={(e) => setNumSpeakers(e.target.value)} />
              <label className="check">
                <input
                  type="checkbox"
                  checked={disableClone}
                  disabled={working}
                  onChange={(e) => setDisableClone(e.target.checked)}
                />
                Do not clone speakers from the source (use the replacement voice / generic)
              </label>
            </>
          ) : null}

          {mode === "sfx" ? (
            <>
              <PromptStarters kind="sfx" onUseSfx={applySfxStarter} onUseMusic={applyMusicStarter} />
              <label htmlFor="dur">Duration seconds (blank = auto, 200 credits)</label>
              <input id="dur" value={sfxDuration} disabled={working} placeholder="5" onChange={(e) => setSfxDuration(e.target.value)} />
              <label htmlFor="inf">Prompt influence (0–1)</label>
              <input id="inf" value={sfxInfluence} disabled={working} onChange={(e) => setSfxInfluence(e.target.value)} />
              <label className="check">
                <input type="checkbox" checked={sfxLoop} disabled={working} onChange={(e) => setSfxLoop(e.target.checked)} />
                Loop
              </label>
            </>
          ) : null}

          {mode === "music" ? (
            <>
              <PromptStarters kind="music" onUseSfx={applySfxStarter} onUseMusic={applyMusicStarter} />
              <label htmlFor="mmode">Mode</label>
              <select id="mmode" value={musicMode} disabled={working} onChange={(e) => setMusicMode(e.target.value as "simple" | "custom")}>
                <option value="simple">Simple description</option>
                <option value="custom">Custom lyrics / tags</option>
              </select>
              {musicMode === "simple" ? (
                <>
                  <label htmlFor="mp">Description (1–500)</label>
                  <SecurePrompt id="mp" kind="music" rows={4} value={musicPrompt} disabled={working} onChange={setMusicPrompt} />
                  <label className="check">
                    <input type="checkbox" checked={instrumental} disabled={working} onChange={(e) => setInstrumental(e.target.checked)} />
                    Instrumental
                  </label>
                </>
              ) : (
                <>
                  <label htmlFor="mt">Title</label>
                  <SecureLine id="mt" kind="name" value={title} disabled={working} onChange={setTitle} />
                  <label htmlFor="ly">Lyrics</label>
                  <SecurePrompt id="ly" kind="lyrics" rows={6} value={lyrics} disabled={working} onChange={setLyrics} />
                  <label htmlFor="tg">Style tags</label>
                  <SecureLine id="tg" kind="tags" value={tags} disabled={working} onChange={setTags} />
                  <label htmlFor="g">Vocal</label>
                  <select id="g" value={gender} disabled={working} onChange={(e) => setGender(e.target.value)}>
                    <option value="">Either</option>
                    <option value="f">Female</option>
                    <option value="m">Male</option>
                  </select>
                </>
              )}
            </>
          ) : null}

          {mode === "dictionary" ? (
            <>
              <label htmlFor="dn">Dictionary name</label>
              <input id="dn" value={dictName} onChange={(e) => setDictName(e.target.value)} />
              <label htmlFor="df">From</label>
              <input id="df" value={dictFrom} onChange={(e) => setDictFrom(e.target.value)} />
              <label htmlFor="dt">Said as</label>
              <input id="dt" value={dictTo} onChange={(e) => setDictTo(e.target.value)} />
              <button type="button" className="btn ghost" onClick={() => void previewDict()}>
                Preview
              </button>
              {dictPreview ? <p className="muted">Preview: {dictPreview}</p> : null}
              {dictId ? <p className="muted">Use this id on TTS / dialogue: {dictId}</p> : null}
              <pre className="dict-dump">{JSON.stringify(dicts, null, 2)}</pre>
            </>
          ) : null}

          {mode === "tts" || mode === "change" || mode === "dub" ? null : (
            <button type="submit" className="btn lime" disabled={working}>
              {working ? "Working…" : mode === "dictionary" ? "Save dictionary" : "Generate"}
            </button>
          )}
        </form>

        <aside className="audio-result">
          {working ? (
            <section className="compose-panel gen-wait" style={{ position: "relative", minHeight: 220 }}>
              <span className="gen-wait-veil" />
              <p>{current?.phase_label || "Mixing…"}</p>
            </section>
          ) : current?.status === "COMPLETED" ? (
            <section className="compose-panel">
              <p className="kicker">Result</p>
              {current.has_cover ? (
                <img src={`/api/audio/jobs/${current.id}/cover`} alt="" className="preview" />
              ) : null}
              {current.kind === "clone" ? (
                <audio controls src={`/api/audio/jobs/${current.id}/input`} />
              ) : current.output_filename || (current.kind !== "stt" && current.kind !== "clone") ? (
                <audio controls src={`/api/audio/jobs/${current.id}/output`} />
              ) : null}
              {current.has_alt ? (
                <audio controls src={`/api/audio/jobs/${current.id}/alt`} />
              ) : null}
              {current.has_video ? <video controls src={`/api/audio/jobs/${current.id}/output?video=1`} /> : null}
              {current.kind === "stt" ? (
                <p className="muted">
                  <a href={`/api/audio/jobs/${current.id}/transcript`}>Transcript / JSON</a>
                </p>
              ) : null}
              {current.transcript ? <pre className="dict-dump">{current.transcript}</pre> : null}
              <div className="head-side">
                {current.kind !== "clone" && current.kind !== "stt" ? (
                  <a className="btn ghost small" href={`/api/audio/jobs/${current.id}/output?download=1`}>
                    Download audio
                  </a>
                ) : null}
                {current.has_alt ? (
                  <a className="btn ghost small" href={`/api/audio/jobs/${current.id}/alt?download=1`}>
                    Second clip
                  </a>
                ) : null}
                {current.has_srt ? (
                  <a className="btn ghost small" href={`/api/audio/jobs/${current.id}/srt`}>
                    SRT
                  </a>
                ) : null}
                {current.has_video ? (
                  <a className="btn ghost small" href={`/api/audio/jobs/${current.id}/output?video=1&download=1`}>
                    Video
                  </a>
                ) : null}
                {current.params?.voice_id ? (
                  <span className="muted">
                    {String(current.params.voice_id) === voiceId && voiceName
                      ? voiceName
                      : String(current.params.voice_id)}
                  </span>
                ) : null}
              </div>
              <p className="muted">
                {formatDuration(current.duration_ms)}
                {current.credit_cost != null ? ` · ${current.credit_cost} credits` : ""}
              </p>
            </section>
          ) : current?.status === "FAILED" ? (
            <section className="compose-panel">
              <p className="kicker">Result</p>
              <p className="notice">{current.error}</p>
            </section>
          ) : (
            <section className="compose-panel">
              <p className="kicker">Result</p>
              <h2>Clip lands here</h2>
              <p className="lede">Generate on the left. The finished audio shows on this side, full width.</p>
            </section>
          )}
          <section className="compose-panel audio-history-block">
            <p className="shelf-label">History</p>
            {jobs.length === 0 ? (
              <p className="bin-empty">Generate on the left. Finished clips stack here.</p>
            ) : (
              <ul className="audio-history">
                {jobs.slice(0, 30).map((j) => (
                  <li key={j.id} className={current?.id === j.id ? "on" : undefined}>
                    <button type="button" onClick={() => setCurrent(j)}>
                      <strong>{j.title || j.kind}</strong>
                      <span>
                        {j.kind} · {j.status.toLowerCase()}
                        {j.credit_cost != null ? ` · ${j.credit_cost} cr` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
      )}
      </div>
      <NowPlayingBar />
    </main>
  );
}
