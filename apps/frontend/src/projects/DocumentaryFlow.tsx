import { useEffect, useRef, useState } from "react";
import { FILM_LENGTH_OPTIONS, sceneDurationBounds, type FilmLengthSec } from "../film-length";
import { promptIssue } from "../prompt-guard";
import { SecureLine, SecurePrompt } from "../SecurePrompt";
import { api, type StudioProject, type ProjectScript } from "../video-studio/model";
import { VideoStudio } from "../video-studio/VideoStudio";
import { FILM_PRESETS } from "./film-presets";
import "./documentary.css";

type Step = "script" | "cast" | "studio";
type Desk = "topic" | Step;

const FILM_NAV: Array<{ id: Desk; kicker: string; title: string; hint: string }> = [
  { id: "topic", kicker: "01 · Topic", title: "Start a film", hint: "Topic, name, and length." },
  { id: "script", kicker: "02 · Script", title: "Write the story", hint: "Narration and scenes." },
  { id: "cast", kicker: "03 · Cast", title: "Pick the shots", hint: "One Pexels pick per scene." },
  { id: "studio", kicker: "04 · Mix", title: "Open Studio", hint: "Narration on A1. Music on A2." },
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
  if (/stock query/i.test(raw)) return "The writer sent a weak shot list. Retry the script — each scene needs a short filmable search.";
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

export function ProjectsHome({ onOpen: _onOpen }: { onOpen: (id: string, step: Step) => void }) {
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [topic, setTopic] = useState(""); const [name, setName] = useState("");
  const [filmLength, setFilmLength] = useState<FilmLengthSec>(60);
  const [presetId, setPresetId] = useState("");
  const [saveToLibrary, setSaveToLibrary] = useState(true);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [desk, setDesk] = useState<Desk>("topic");
  const [workingId, setWorkingId] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => api<{ projects: StudioProject[] }>(base).then(b => { if (alive) setProjects(b.projects); }).catch(e => { if (alive) setError(message(e)); });
    void load(); const timer = setInterval(() => void load(), 4000);
    return () => { alive = false; clearInterval(timer); };
  }, []);
  async function create() {
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
  async function rename(id: string) {
    if (!renameValue.trim()) { setRenamingId(null); return; }
    try { const p = await api<StudioProject>(`${base}/${id}`, request("PATCH", { name: renameValue.trim() }));
      setProjects(prev => prev.map(x => x.id === id ? p : x)); setRenamingId(null);
    } catch(e) { setError(message(e)); }
  }
  async function remove(p: StudioProject) {
    if (!window.confirm(`Delete “${p.name}”? This cannot be undone.`)) return;
    try {
      await api(`${base}/${p.id}`, request("DELETE"));
      setProjects(prev => prev.filter(x => x.id !== p.id));
      if (workingId === p.id) { setWorkingId(null); setDesk("topic"); }
    }
    catch(e) { setError(message(e)); }
  }
  return <main className="studio projects-page">
    <header className="page-head films-hero">
      <div>
        <p className="kicker">Documentaries</p>
        <h1>Your films</h1>
        <p className="lede">
          Same product as MCP: topic, script, cast, mix. Creations land below. Not lip-sync.
        </p>
      </div>
    </header>
    <div className="film-workbench">
    <FilmNav desk={desk} onDesk={setDesk} />
    {error ? <p className="project-error" role="alert">{error}</p> : null}
    <section className={`film-stage${desk === "topic" ? " is-topic" : desk === "script" ? " is-script" : desk === "cast" ? " is-cast" : desk === "studio" ? " is-mix" : ""}`}>
      {desk === "topic" ? (
        <form className="film-topic" onSubmit={e => { e.preventDefault(); void create(); }}>
          <div className="film-topic-intro">
          <img className="film-brand" src="/brand/marketing-studio-logo.svg" width="160" height="160" alt="" />
          <p className="kicker">01 · Topic</p>
          <h2>Start a film</h2>
          <p className="lede">Pick a coffee story — the script is already written — or type your own topic. Choose how long the film should run.</p>
          </div>
          <div className="film-topic-fields">
          <label>Story
            <select
              value={presetId}
              onChange={(e) => {
                const next = e.target.value;
                setPresetId(next);
                const preset = FILM_PRESETS.find((x) => x.id === next);
                if (preset) { setName(preset.name); setTopic(preset.topic); }
              }}
            >
              <option value="">Write your own topic</option>
              {FILM_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
          <label>Topic
            <SecurePrompt
              kind="topic"
              required
              rows={4}
              placeholder="Coffee shop morning — first grind to the rush"
              value={topic}
              onChange={(next) => { setTopic(next); setPresetId(""); }}
            />
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
            <p>{FILM_LENGTH_OPTIONS.find((o) => o.sec === filmLength)?.hint} Hard cap is 90 seconds.</p>
          </fieldset>
          <label>Name <span>(optional)</span>
            <SecureLine kind="name" value={name} onChange={setName} placeholder="Give it a name" />
          </label>
          <label className="project-library-opt"><input type="checkbox" checked={saveToLibrary} onChange={e => setSaveToLibrary(e.target.checked)} /> Also keep in Library</label>
          <button className="project-primary" disabled={busy || !topic.trim() || Boolean(promptIssue(topic, "topic"))}>{busy ? "Creating…" : "New project"}</button>
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
          <p>Start one in Topic, or open a film below. Then Script, Cast, and Mix appear here.</p>
        </div>
      )}
    </section>
    </div>
    <section className="films-shelf">
      <div className="films-shelf-head">
        <h2>Your films</h2>
        <span className="project-count">{projects.length} {projects.length === 1 ? "film" : "films"}</span>
      </div>
      {projects.length === 0 && !error ? <p className="projects-empty-wall">Nothing here yet. Start a topic in step 01.</p> : null}
      <div className="project-grid films-grid">{projects.map(p => {
        const still = filmStill(p);
        return <article className="project-card" key={p.id}>
        <button className="project-card-open" aria-label={`Open ${p.name}`} onClick={() => { setWorkingId(p.id); setDesk(projectStep(p)); }}>
        <div className="project-card-art">{still ? still.video ? <video src={still.src} muted loop playsInline autoPlay preload="auto" /> : <img src={still.src} alt="" /> : <span>{p.name.slice(0, 1).toUpperCase()}</span>}<em>{p.phase} · {p.status}</em></div>
        <h2>{p.name}</h2></button><p>{p.topic || "Existing Studio project"}</p><footer>{p.target_duration_sec ?? 60}s · {p.clips.length} clips <span>{new Date(p.updated_at).toLocaleDateString()}</span></footer>
        {renamingId === p.id && <input autoFocus aria-label="Rename project" maxLength={80} value={renameValue} onChange={e => setRenameValue(e.target.value)} onBlur={() => void rename(p.id)} onKeyDown={e => { if(e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } if(e.key === "Escape") setRenamingId(null); }} />}
        <div className="project-card-actions"><button onClick={() => { setWorkingId(p.id); setDesk(projectStep(p)); }}>Edit</button><button disabled={p.status === "running"} onClick={() => { setRenamingId(p.id); setRenameValue(p.name); }}>Rename</button><button disabled={p.status === "running"} onClick={() => void remove(p)}>Delete</button></div>
      </article>;
      })}</div>
    </section>
  </main>;
}

export function ProjectWorkspace({ id, step, onStep, onHome, chrome = "full" }: { id: string; step: Step; onStep: (step: Step) => void; onHome: () => void; chrome?: "full" | "none" }) {
  const [project, setProject] = useState<StudioProject | null>(null);
  const [draft, setDraft] = useState<ProjectScript | null>(null);
  const [name, setName] = useState(""); const nameDirty = useRef(false);
  const dirty = useRef(false); const [hasEdits, setHasEdits] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
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
    void load(); const timer = setInterval(() => void load(), 2000);
    return () => { alive = false; clearInterval(timer); };
  }, [id]);
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
  if (!project) return <div className="film-stage-empty"><button type="button" className="project-primary" onClick={onHome}>← Films</button><p role="status">{error || "Loading project…"}</p></div>;
  const running = project.status === "running"; const disabled = running || busy;
  const assembled = ["studio", "exported"].includes(project.phase);
  const editable = project.phase === "script" && !disabled;
  const scenes = project.script?.scenes || [];
  const castReady = scenes.length > 0 && scenes.every(s => ["picked", "skipped"].includes(s.status)) && scenes.some(s => s.status === "picked");
  const body = <>
    {chrome === "full" ? <FilmNav desk={step} onDesk={(d) => { if (d === "topic") onHome(); else onStep(d); }} /> : null}
    {(error || project.error) && <div className="project-error" role="alert">{error || friendlyError(project.error || "")}</div>}
    {running && <div className="project-progress" role="status"><span className="project-spinner" />{project.operation === "script" ? "Writing your script…" : project.operation === "stock" ? `Finding stock · ${scenes.filter(s => s.status !== "pending").length}/${scenes.length} scenes` : "Preparing narration and timeline…"}<button onClick={() => void action("cancel")} disabled={busy}>Stop</button></div>}
    {step === "script" ? <section className="project-content">
      <div className="project-section-heading"><div><p className="project-eyebrow">01 / THE STORY</p><h1>Shape your script</h1><p>{project.topic || "This existing project starts in Studio."} Aimed at {project.target_duration_sec ?? 60}s.</p></div>{draft && <span>{draft.scenes.length} scenes · {draft.scenes.reduce((n, s) => n + Number(s.duration_sec), 0)}s</span>}</div>
      {!draft ? <div className="project-empty"><h2>{running ? "A story is taking shape" : "Your script isn’t ready yet"}</h2><p>Stock is only fetched after you review and approve your script.</p>{!running && project.topic && <button className="project-primary" disabled={busy} onClick={() => void action("retry-script")}>Retry script</button>}{!project.topic && <button onClick={() => onStep("studio")}>Open Studio</button>}</div> : <>
        <div className="project-script"><label>Title<SecureLine kind="title" value={draft.title} disabled={!editable} onChange={next => edit({ ...draft, title: next })} /></label><label>Full voiceover <span>Used for narration, including when visuals are skipped</span><SecurePrompt kind="scriptVo" className="project-vo" value={draft.voiceover_full} disabled={!editable} onChange={next => edit({ ...draft, voiceover_full: next })} /></label></div>
        <div className="project-scene-list">{draft.scenes.map((scene, index) => <article className="project-scene-edit" key={scene.id}><span className="scene-number">{String(index + 1).padStart(2, "0")}</span><div>
          <label>Scene heading<SecureLine kind="heading" disabled={!editable} value={scene.heading} onChange={next => edit({ ...draft, scenes: draft.scenes.map(s => s.id === scene.id ? { ...s, heading: next } : s) })} /></label>
          <label>Scene narration<SecurePrompt kind="sceneVo" disabled={!editable} value={scene.voiceover_line} onChange={next => { const nextScenes = draft.scenes.map(s => s.id === scene.id ? { ...s, voiceover_line: next } : s); const followsScenes = draft.voiceover_full === draft.scenes.map(s => s.voiceover_line).join(" "); edit({ ...draft, scenes: nextScenes, voiceover_full: followsScenes ? nextScenes.map(s => s.voiceover_line).join(" ") : draft.voiceover_full }); }} /></label>
          <div className="project-row"><label>Shot search<SecureLine kind="stock" disabled={!editable} value={scene.stock_query} onChange={next => edit({ ...draft, scenes: draft.scenes.map(s => s.id === scene.id ? { ...s, stock_query: next } : s) })} /></label><label className="scene-duration">Seconds<input type="number" min={sceneDurationBounds(project.target_duration_sec).min} max={sceneDurationBounds(project.target_duration_sec).max} step={0.5} disabled={!editable} value={scene.duration_sec} onChange={e => edit({ ...draft, scenes: draft.scenes.map(s => s.id === scene.id ? { ...s, duration_sec: Number(e.target.value) } : s) })} /></label></div>
        </div></article>)}</div>
        {project.phase === "script" && <footer className="project-actions"><span>{hasEdits ? "Unsaved script changes" : "Script saved"}</span><button disabled={!editable || !hasEdits} onClick={() => { setBusy(true); void saveScript().catch(e => setError(message(e))).finally(() => setBusy(false)); }}>Save script</button><button className="project-primary" disabled={disabled} onClick={() => void approve()}>Approve & fetch stock →</button></footer>}
      </>}
    </section> : step === "cast" ? <section className="project-content">
      <div className="project-section-heading"><div><p className="project-eyebrow">02 / THE SCENES</p><h1>Cast your story</h1><p>Pick one visual per scene, or skip it. <a href="https://www.pexels.com" target="_blank" rel="noreferrer">Stock provided by Pexels</a>.</p></div><span>{scenes.filter(s => s.status === "picked").length} picked · {scenes.filter(s => s.status === "skipped").length} skipped</span></div>
      {!["cast", "studio", "exported"].includes(project.phase) ? <button onClick={() => onStep("script")}>Review your script first</button> : scenes.map((scene, index) => <article className={`cast-scene ${scene.status === "skipped" ? "skipped" : ""}`} key={scene.id}>
        <header><span className="scene-number">{String(index + 1).padStart(2, "0")}</span><div><h2>{scene.heading}</h2><p>{scene.voiceover_line}</p><small>{scene.stock_query} · {scene.duration_sec}s · {scene.status}</small></div><button disabled={disabled || assembled} onClick={() => void action(`scenes/${scene.id}/pick`, { skip: true })}>{scene.status === "skipped" ? "Skipped" : "Skip scene"}</button></header>
        <div className="cast-candidates">{scene.candidates.map(c => <div className={`cast-candidate ${c.upload_id === scene.picked_upload_id ? "picked" : ""}`} key={c.upload_id}>
          {c.kind === "video" ? <video src={c.preview_url} controls preload="metadata" playsInline /> : <img src={c.preview_url} alt={c.label} loading="lazy" />}
          <div><a href={c.pexels_url} target="_blank" rel="noreferrer">{c.photographer} on Pexels</a><a href={c.license_url} target="_blank" rel="noreferrer">License ↗</a></div>
          <button disabled={disabled || assembled} className={c.upload_id === scene.picked_upload_id ? "project-primary" : ""} onClick={() => void action(`scenes/${scene.id}/pick`, { upload_id: c.upload_id })}>{c.upload_id === scene.picked_upload_id ? "✓ Selected" : "Pick this shot"}</button>
        </div>)}</div>
        {!scene.candidates.length && <p className="project-empty-small">{scene.status === "skipped" ? "No visual selected. This scene is skipped." : scene.error || "Stock candidates will appear here."}</p>}
      </article>)}
      {!assembled && <footer className="project-actions cast-actions"><div><label>Narration voice<select value={voiceId} disabled={disabled || !!project.tts_job_id} onChange={e => setVoiceId(e.target.value)}><option value="">First available English voice</option>{voices.map(v => <option key={v.voice_id} value={v.voice_id}>{v.name || v.voice_name || v.voice_id}</option>)}</select></label>{voiceError && <small role="alert">Voice catalog: {voiceError}</small>}<small>Your full narration stays intact. The final pick repeats if needed to cover it.</small></div>
        {project.status !== "running" && scenes.some(s => ["pending", "failed"].includes(s.status)) && <button disabled={busy} onClick={() => void action("fetch-stock")}>Retry stock</button>}
        <button className="project-primary" disabled={disabled || !castReady} onClick={() => void action("assemble", { voice_id: voiceId })}>{project.tts_job_id ? "Resume assembly →" : "Assemble timeline →"}</button>
      </footer>}
    </section> : assembled ? <VideoStudio projectId={id} onHome={onHome} /> : <section className="project-content project-empty"><h1>Cast your scenes first</h1><p>Your timeline opens after assembly.</p><button onClick={() => onStep(projectStep(project))}>Continue project</button></section>}
  </>;
  return chrome === "none" ? <div className={`project-embed${step === "studio" ? " in-studio" : ""}`}>{body}</div> : <main className={`studio project-workspace ${step === "studio" ? "in-studio" : ""}`}>{body}</main>;
}
