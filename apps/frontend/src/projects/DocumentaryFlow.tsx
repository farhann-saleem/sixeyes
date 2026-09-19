import { useEffect, useRef, useState } from "react";
import { ensureAuthed } from "../auth";
import { FILM_LENGTH_OPTIONS, sceneDurationBounds, type FilmLengthSec } from "../film-length";
import { promptIssue } from "../prompt-guard";
import { DOC_SHOT_MODELS } from "../model-catalog";
import { SecureLine, SecurePrompt } from "../SecurePrompt";
import { api, type StudioProject, type ProjectScript } from "../video-studio/model";
import { VideoStudio } from "../video-studio/VideoStudio";
import { DeferredVideo } from "../viewport-media";
import { FILM_PRESETS } from "./film-presets";
import { Lightbox, type LightboxItem } from "../Lightbox";
import { SkeletonGrid } from "../Skeleton";
import "./documentary.css";

type Step = "script" | "cast" | "studio";
type Desk = "topic" | Step;

const FILM_NAV: Array<{ id: Desk; kicker: string; title: string; hint: string }> = [
  { id: "topic", kicker: "01 · Topic", title: "Start a film", hint: "Topic, name, and length." },
  { id: "script", kicker: "02 · Script", title: "Director writes", hint: "AI narration and scenes." },
  { id: "cast", kicker: "03 · Shots", title: "Generate footage", hint: "AI clips per scene: Seedance, Kling, and LTX." },
  { id: "studio", kicker: "04 · Mix", title: "Assemble", hint: "Narration on A1. Music on A2." },
];

function FilmNav({ desk, onDesk }: { desk: Desk; onDesk: (d: Desk) => void }) {
  return (
    <nav className="film-steps" aria-label="Film steps">
      {FILM_NAV.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`film-step${desk === item.id ? " on" : ""}`}
          aria-current={desk === item.id ? "step" : undefined}
          onClick={() => onDesk(item.id)}
        >
          <p className="kicker">{item.kicker}</p>
          <h2>{item.title}</h2>
          <p>{item.hint}</p>
        </button>
      ))}
    </nav>
  );
}
const base = "/api/studio/projects";
const request = (method: string, body?: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const message = (e: unknown) => friendlyError(e instanceof Error ? e.message : String(e));
function friendlyError(raw: string) {
  if (/stock query/i.test(raw)) return "The director sent a weak shot list. Retry the script: each scene needs a short filmable prompt.";
  return raw;
}
function projectStep(p: StudioProject): Step { return ["studio", "exported"].includes(p.phase) ? "studio" : p.phase === "cast" ? "cast" : "script"; }

function filmStill(p: StudioProject): { src: string; video: boolean } | null {
  const clip = p.clips.find((c) => c.preview_url && (c.kind === "video" || c.kind === "image"));
  if (clip?.preview_url) return { src: clip.preview_url, video: clip.kind === "video" };
  for (const scene of p.script?.scenes ?? []) {
    const pick = scene.candidates.find((c) => c.upload_id === scene.picked_upload_id) ?? scene.candidates[0];
    if (pick) return { src: pick.preview_url, video: pick.kind === "video" };
  }
  return null;
}

export function ProjectsHome({
  onOpen: _onOpen,
  onGoLibrary,
}: {
  onOpen: (id: string, step: Step) => void;
  onGoLibrary?: () => void;
}) {
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [_loading, setLoading] = useState(true);
  const [topic, setTopic] = useState(""); const [name, setName] = useState("");
  const [filmLength, setFilmLength] = useState<FilmLengthSec>(60);
  const [presetId, setPresetId] = useState("");
  const [saveToLibrary, setSaveToLibrary] = useState(true);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [desk, setDesk] = useState<Desk>("topic");
  const [workingId, setWorkingId] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      api<{ projects: StudioProject[] }>(base)
        .then((b) => {
          if (alive) setProjects(b.projects);
        })
        .catch((e) => {
          if (alive) setError(message(e));
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    void load();
    const timer = setInterval(() => void load(), 8000);
    return () => { alive = false; clearInterval(timer); };
  }, []);
  async function create() {
    if (!ensureAuthed()) return;
    setBusy(true); setError("");
    try {
      const preset = FILM_PRESETS.find((x) => x.id === presetId);
      const p = await api<StudioProject>(base, request("POST", { topic, name, in_library: saveToLibrary, script: preset?.script, duration_sec: filmLength }));
      setWorkingId(p.id);
      setDesk("script");
      setProjects((prev) => [p, ...prev.filter((x) => x.id !== p.id)]);
    }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  return (
    <main className="studio projects-page">
      <header className="page-head films-hero">
        <div>
          <p className="kicker">Documentaries</p>
          <h1>Documentary Studio</h1>
          <p className="lede">
            Full AI pipeline: Topic → Director Script → AI Scene Footage → Timeline Mix.
          </p>
        </div>
        <div className="head-side">
          <button
            type="button"
            className="btn ghost film-library-jump-btn"
            onClick={() => onGoLibrary ? onGoLibrary() : (window.location.href = "/library")}
          >
            View your films ({projects.length}) →
          </button>
        </div>
      </header>

      <div className="film-workbench">
        <FilmNav desk={desk} onDesk={setDesk} />
        {error ? <p className="project-error" role="alert">{error}</p> : null}
        <section className={`film-stage${desk === "topic" ? " is-topic" : desk === "script" ? " is-script" : desk === "cast" ? " is-cast" : desk === "studio" ? " is-mix" : ""}`}>
          {desk === "topic" ? (
            <form className="film-topic" onSubmit={e => { e.preventDefault(); void create(); }}>
              {/* Left Column: Write script on left */}
              <div className="film-topic-col-left">
                <label className="field-group">
                  <div className="field-head-row">
                    <span>Topic / Script</span>
                    <span className="field-count">{topic.length}/500</span>
                  </div>
                  <SecurePrompt
                    kind="topic"
                    required
                    rows={8}
                    placeholder="Coffee shop morning: first grind to the rush. Type your topic or draft your storyline..."
                    value={topic}
                    onChange={(next) => { setTopic(next.slice(0, 500)); setPresetId(""); }}
                  />
                </label>
              </div>

              {/* Right Column: Start a film Intro + Presets + Length + Name + Actions */}
              <div className="film-topic-col-right">
                <div className="film-topic-intro">
                  <h2>Story setup</h2>
                  <p className="lede">Pick a preset story or type your own. Choose how long the film should run.</p>
                </div>

                <label className="field-group">
                  <span>Story preset</span>
                  <select
                    value={presetId}
                    onChange={(e) => {
                      const next = e.target.value;
                      setPresetId(next);
                      const preset = FILM_PRESETS.find((x) => x.id === next);
                      if (preset) { setName(preset.name.slice(0, 60)); setTopic(preset.topic.slice(0, 500)); }
                    }}
                  >
                    <option value="">Write your own topic</option>
                    {FILM_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </label>

                <fieldset className="film-length">
                  <legend>How long</legend>
                  <div className="film-length-pills" role="radiogroup" aria-label="Film length">
                    {FILM_LENGTH_OPTIONS.map((opt) => (
                      <button
                        key={opt.sec}
                        type="button"
                        role="radio"
                        aria-checked={filmLength === opt.sec}
                        className={`film-length-pill${filmLength === opt.sec ? " on" : ""}`}
                        onClick={() => setFilmLength(opt.sec)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="hint-muted">{FILM_LENGTH_OPTIONS.find((o) => o.sec === filmLength)?.hint} Hard cap is 90 seconds.</p>
                </fieldset>

                <label className="field-group">
                  <div className="field-head-row">
                    <span>Story name <em>(optional)</em></span>
                    <span className="field-count">{name.length}/60</span>
                  </div>
                  <SecureLine
                    kind="name"
                    value={name}
                    onChange={(next) => setName(next.slice(0, 60))}
                    placeholder="Give it a name"
                  />
                </label>

                <div className="film-topic-action-group">
                  <label className="project-library-opt">
                    <input type="checkbox" checked={saveToLibrary} onChange={e => setSaveToLibrary(e.target.checked)} />
                    Also keep in Library
                  </label>
                  <button className="project-primary" disabled={busy || !topic.trim() || Boolean(promptIssue(topic, "topic"))}>
                    {busy ? "Creating film…" : "New project"}
                  </button>
                </div>

                {busy && (
                  <div className="film-creating-state" role="status">
                    <span className="project-spinner" />
                    <div>
                      <strong>Creating your film…</strong>
                      <p>Initializing project, director outline, and scenes.</p>
                    </div>
                  </div>
                )}
              </div>
            </form>
          ) : workingId ? (
            <ProjectWorkspace
              key={`${workingId}-${desk}`}
              id={workingId}
              step={desk}
              chrome="none"
              onStep={(s) => setDesk(s)}
              onHome={() => setDesk("topic")}
            />
          ) : (
            <div className="film-stage-empty">
              <h2>Pick a film first</h2>
              <p>Start one in Topic, or open a film in your library.</p>
              <div className="film-stage-empty-actions" style={{ marginTop: "16px", display: "flex", gap: "12px", justifyContent: "center" }}>
                <button type="button" className="project-primary" onClick={() => setDesk("topic")}>
                  ← Back to Start a film
                </button>
                {onGoLibrary && (
                  <button type="button" className="btn ghost" onClick={onGoLibrary}>
                    Open Library →
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export function ProjectWorkspace({ id, step, onStep, onHome, chrome = "full" }: { id: string; step: Step; onStep: (step: Step) => void; onHome: () => void; chrome?: "full" | "none" }) {
  const [project, setProject] = useState<StudioProject | null>(null);
  const [draft, setDraft] = useState<ProjectScript | null>(null);
  const [name, setName] = useState(""); const nameDirty = useRef(false);
  const dirty = useRef(false); const [hasEdits, setHasEdits] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [inspectItem, setInspectItem] = useState<LightboxItem | null>(null);
  const [voices, setVoices] = useState<{ voice_id: string; name?: string; voice_name?: string }[]>([]);
  const [voiceId, setVoiceId] = useState(""); const [voiceError, setVoiceError] = useState("");
  const prior = useRef<StudioProject | null>(null);
  const stepRef = useRef(onStep); stepRef.current = onStep;
  function accept(p: StudioProject) {
    const prev = prior.current; prior.current = p; setProject(p);
    if (!dirty.current) setDraft(p.script);
    if (!nameDirty.current) setName(p.name);
    if (prev?.operation === "assemble" && p.phase === "studio") stepRef.current("studio");
  }
  useEffect(() => {
    let alive = true;
    const load = async () => { try { const p = await api<StudioProject>(`${base}/${id}`); if (alive) accept(p); } catch (e) { if (alive) setError(message(e)); } };
    void load();
    const interval = project?.status === "running" ? 2000 : 5000;
    const timer = setInterval(() => void load(), interval);
    return () => { alive = false; clearInterval(timer); };
  }, [id, project?.status]);
  useEffect(() => {
    if (step !== "cast") return;
    let alive = true;
    api<{ data?: { voice_id: string; name?: string; voice_name?: string }[] }>("/api/audio/voices?provider=edge&locale=en-US&page_size=100")
      .then(b => { if (alive) setVoices((b.data || []).filter(v => v.voice_id)); })
      .catch(e => { if (alive) setVoiceError(message(e)); });
    return () => { alive = false; };
  }, [step]);
  async function action(suffix: string, body?: unknown) {
    setBusy(true); setError("");
    try { const p = await api<StudioProject>(`${base}/${id}/${suffix}`, request("POST", body)); accept(p); if (suffix === "fetch-stock") onStep("cast"); if (suffix === "assemble" && p.phase === "studio") onStep("studio"); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function saveScript() {
    const p = await api<StudioProject>(`${base}/${id}/script`, request("PATCH", draft));
    dirty.current = false; setHasEdits(false); accept(p);
  }
  async function approve() { setBusy(true); setError(""); try { if (dirty.current) await saveScript(); await action("fetch-stock"); } catch(e) { setError(message(e)); } finally { setBusy(false); } }
  function edit(next: ProjectScript) { dirty.current = true; setHasEdits(true); setDraft(next); }
  if (!project) {
    const isAuth = /sign in|auth|unauthorized/i.test(error || "");
    return (
      <div className="film-stage-empty">
        <button type="button" className="project-primary" onClick={onHome}>← Films</button>
        {isAuth ? (
          <div className="film-auth-gate-card">
            <h3>Sign in to access your film</h3>
            <p>This documentary project is private to its creator. Sign in with Google to view and edit it.</p>
            <a className="btn lime" href="/login" style={{ display: "inline-block", padding: "12px 24px" }}>
              Sign in with Google
            </a>
          </div>
        ) : (
          <p role="status">{error || "Loading project…"}</p>
        )}
      </div>
    );
  }
  const running = project.status === "running"; const disabled = running || busy;
  const assembled = ["studio", "exported"].includes(project.phase);
  const editable = project.phase === "script" && !disabled;
  const scenes = project.script?.scenes || [];
  const castReady = scenes.length > 0 && scenes.every(s => ["picked", "skipped"].includes(s.status)) && scenes.some(s => s.status === "picked");
  const scriptDuration = draft?.scenes.reduce((n, s) => n + Number(s.duration_sec), 0) ?? 0;
  const body = <>
    {chrome === "full" ? <FilmNav desk={step} onDesk={(d) => { if (d === "topic") onHome(); else onStep(d); }} /> : null}
    {(error || project.error) && <div className="project-error" role="alert">{error || friendlyError(project.error || "")}</div>}
    {running && <div className="project-progress" role="status"><span className="project-spinner" />{project.operation === "script" ? "Director is writing your script…" : project.operation === "stock" ? `Generating AI scenes · ${scenes.filter(s => s.status !== "pending").length}/${scenes.length}` : "Building voice and timeline…"}<button onClick={() => void action("cancel")} disabled={busy}>Stop</button></div>}
    {step === "script" ? <section className="project-content">
      <div className="project-section-heading"><div><p className="project-eyebrow">02 / SCRIPT</p><h1>Shape your script</h1><p>{project.topic || "This existing project starts in Studio."} Aimed at {project.target_duration_sec ?? 60}s. Full AI pipeline: Topic → Script → Shots → Mix.</p></div>{draft && <span style={scriptDuration > 90 ? { color: "#fa7faa", fontWeight: 700 } : undefined}>{draft.scenes.length} scenes · {scriptDuration}s{scriptDuration > 90 ? " (exceeds 90s cap)" : ""}</span>}</div>
      {!draft ? <div className="project-empty"><h2>{running ? "A story is taking shape" : "Your script isn’t ready yet"}</h2><p>Scene footage generates only after you approve the script: Seedance, Kling, and LTX for every beat.</p>{!running && project.topic && <button className="project-primary" disabled={busy} onClick={() => void action("retry-script")}>Retry script</button>}{!project.topic && <button onClick={() => onStep("studio")}>Open Studio</button>}</div> : <>
        <div className="project-script"><label>Title<SecureLine kind="title" value={draft.title} disabled={!editable} onChange={next => edit({ ...draft, title: next })} /></label><label>Full voiceover <span>Used for narration, including when visuals are skipped</span><SecurePrompt kind="scriptVo" className="project-vo" value={draft.voiceover_full} disabled={!editable} onChange={next => edit({ ...draft, voiceover_full: next })} /></label></div>
        <div className="project-scene-list">{draft.scenes.map((scene, index) => <article className="project-scene-edit" key={scene.id}><span className="scene-number">{String(index + 1).padStart(2, "0")}</span><div>
          <label>Scene heading<SecureLine kind="heading" disabled={!editable} value={scene.heading} onChange={next => edit({ ...draft, scenes: draft.scenes.map(s => s.id === scene.id ? { ...s, heading: next } : s) })} /></label>
          <label>Scene narration<SecurePrompt kind="sceneVo" disabled={!editable} value={scene.voiceover_line} onChange={next => { const nextScenes = draft.scenes.map(s => s.id === scene.id ? { ...s, voiceover_line: next } : s); const followsScenes = draft.voiceover_full === draft.scenes.map(s => s.voiceover_line).join(" "); edit({ ...draft, scenes: nextScenes, voiceover_full: followsScenes ? nextScenes.map(s => s.voiceover_line).join(" ") : draft.voiceover_full }); }} /></label>
          <div className="project-row"><label>Shot prompt<SecureLine kind="stock" disabled={!editable} value={scene.stock_query} onChange={next => edit({ ...draft, scenes: draft.scenes.map(s => s.id === scene.id ? { ...s, stock_query: next } : s) })} /></label><label className="scene-duration">Seconds<input type="number" min={sceneDurationBounds(project.target_duration_sec).min} max={sceneDurationBounds(project.target_duration_sec).max} step={0.5} disabled={!editable} value={scene.duration_sec} onChange={e => edit({ ...draft, scenes: draft.scenes.map(s => s.id === scene.id ? { ...s, duration_sec: Number(e.target.value) } : s) })} /></label></div>
        </div></article>)}</div>
        {project.phase === "script" && <footer className="project-actions"><span>{hasEdits ? "Unsaved script changes" : "Script saved"}</span><button disabled={!editable || !hasEdits} onClick={() => { setBusy(true); void saveScript().catch(e => setError(message(e))).finally(() => setBusy(false)); }}>Save script</button><button className="project-primary" disabled={disabled || scriptDuration > 90} onClick={() => void approve()}>Approve & generate scenes →</button></footer>}
      </>}
    </section> : step === "cast" ? <section className="project-content">
      <div className="project-section-heading"><div><p className="project-eyebrow">03 / AI SHOTS</p><h1>Pick generated shots</h1><p>Every candidate is AI-generated scene footage (Seedance 1.5 Pro, Kling 3.0, LTX-2.5). Pick one per beat, or skip it.</p></div><span>{scenes.filter(s => s.status === "picked").length} picked · {scenes.filter(s => s.status === "skipped").length} skipped</span></div>
      {!["cast", "studio", "exported"].includes(project.phase) ? <button onClick={() => onStep("script")}>Review your script first</button> : scenes.map((scene, index) => <article className={`cast-scene ${scene.status === "skipped" ? "skipped" : ""}`} key={scene.id}>
        <header><span className="scene-number">{String(index + 1).padStart(2, "0")}</span><div><h2>{scene.heading}</h2><p>{scene.voiceover_line}</p><small>{scene.stock_query} · {scene.duration_sec}s · {scene.status}</small></div><button disabled={disabled || assembled} onClick={() => void action(`scenes/${scene.id}/pick`, { skip: true })}>{scene.status === "skipped" ? "Skipped" : "Skip scene"}</button></header>
        <div className="cast-candidates">{scene.candidates.map((c, ci) => <div className={`cast-candidate ${c.upload_id === scene.picked_upload_id ? "picked" : ""}`} key={c.upload_id}>
          <div className="cast-preview-frame">
            {c.kind === "video" ? <video src={c.preview_url} controls preload="metadata" playsInline /> : <img src={c.preview_url} alt={c.label} loading="lazy" />}
            <button
              type="button"
              className="cast-inspect-btn"
              title="Inspect larger"
              aria-label="Inspect candidate clip"
              onClick={() => setInspectItem({ id: c.upload_id, src: c.preview_url, download: c.preview_url, title: scene.heading, subtitle: c.label || "AI Scene", kind: c.kind })}
            >
              ⤢
            </button>
          </div>
          <div className="cast-candidate-meta"><span className="cast-ai-tag">{DOC_SHOT_MODELS[ci % DOC_SHOT_MODELS.length]}</span><span>AI scene</span></div>
          <button disabled={disabled || assembled} className={c.upload_id === scene.picked_upload_id ? "project-primary" : ""} onClick={() => void action(`scenes/${scene.id}/pick`, { upload_id: c.upload_id })}>{c.upload_id === scene.picked_upload_id ? "✓ Selected" : "Pick this shot"}</button>
        </div>)}</div>
        {!scene.candidates.length && <p className="project-empty-small">{scene.status === "skipped" ? "No visual selected. This scene is skipped." : scene.error || "Generated scene options will appear here."}</p>}
      </article>)}
      {!assembled && <footer className="project-actions cast-actions"><div><label>Narration voice<select value={voiceId} disabled={disabled || !!project.tts_job_id} onChange={e => setVoiceId(e.target.value)}><option value="">First available English voice</option>{voices.map(v => <option key={v.voice_id} value={v.voice_id}>{v.name || v.voice_name || v.voice_id}</option>)}</select></label>{voiceError && <small role="alert">Voice catalog: {voiceError}</small>}<small>Your full narration stays intact. The final pick repeats if needed to cover it.</small></div>
        {project.status !== "running" && scenes.some(s => ["pending", "failed"].includes(s.status)) && <button disabled={busy} onClick={() => void action("fetch-stock")}>Retry scene generate</button>}
        <div>
          <button className="project-primary" disabled={disabled || !castReady} onClick={() => void action("assemble", { voice_id: voiceId })}>{project.tts_job_id ? "Resume assembly →" : "Assemble timeline →"}</button>
          {!castReady && <small className="hint-muted" style={{ display: "block", marginTop: "4px", textAlign: "right", color: "#d5cde0" }}>Pick at least 1 shot and decide each scene before assembling.</small>}
        </div>
      </footer>}
    </section> : assembled ? <VideoStudio projectId={id} onHome={onHome} /> : <section className="project-content project-empty"><h1>Generate your scenes first</h1><p>Your timeline opens after assembly.</p><button onClick={() => onStep(projectStep(project))}>Continue project</button></section>}
    {inspectItem && (
      <Lightbox
        items={[inspectItem]}
        index={0}
        onIndex={() => {}}
        onClose={() => setInspectItem(null)}
      />
    )}
  </>;
  return chrome === "none" ? <div className={`project-embed${step === "studio" ? " in-studio" : ""}`}>{body}</div> : <main className={`studio project-workspace ${step === "studio" ? "in-studio" : ""}`}>{body}</main>;
}
