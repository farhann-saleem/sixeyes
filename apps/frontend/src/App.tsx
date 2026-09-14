import { apiUrl } from "./api";
import { FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ensureAuthed } from "./auth";
import { AVATAR_MODELS, displayNameForProvider } from "./model-catalog";
import { SaveNamePanel } from "./SaveNamePanel";
import { json, type SavedAvatar } from "./studio";

type Provider = "openrouter-flux" | "openrouter" | "qwen" | "ai33pro";

type AvatarJob = {
  id: string;
  name?: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED";
  phase_label?: string;
  provider: Provider;
  created_at: string;
  duration_ms: number | null;
  estimated_usd: number | null;
  error: string | null;
};

type ModelRow = {
  id: string;
  name: string;
  default?: boolean;
  blocked?: string | null;
  notes?: string;
};

type Models = {
  prompt: string;
  models: ModelRow[];
};

function isLive(job: AvatarJob | undefined): job is AvatarJob {
  return job?.status === "IN_PROGRESS" || job?.status === "PENDING";
}

export function App({ onIdentities }: { onIdentities?: (rows: SavedAvatar[]) => void }) {
  const [models, setModels] = useState<Models | null>(null);
  const [provider, setProvider] = useState<Provider>("openrouter-flux");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<AvatarJob[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [identities, setIdentities] = useState<SavedAvatar[]>([]);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [stageOpen, setStageOpen] = useState(false);
  const controlsRef = useRef<HTMLFormElement>(null);
  const previousLeft = useRef<number | null>(null);
  function openStage() {
    if (!stageOpen) previousLeft.current = controlsRef.current?.getBoundingClientRect().left ?? null;
    setStageOpen(true);
  }
  useLayoutEffect(() => {
    const el = controlsRef.current;
    if (el && previousLeft.current !== null && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const offset = previousLeft.current - el.getBoundingClientRect().left;
      el.animate([{ transform: `translateX(${offset}px)` }, { transform: "translateX(0)" }], { duration: 280, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
    }
    previousLeft.current = null;
  }, [stageOpen]);
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = models?.models.find((m) => m.id === provider);
  const current = jobs.find((j) => j.id === currentId) ?? null;
  const working = busy || isLive(current ?? undefined);

  const pickedIdentity = identities.find((a) => a.id === pickedId) ?? null;
  const pickedJob =
    jobs.find((j) => j.id === pickedId && j.status === "COMPLETED") ??
    (pickedIdentity ? jobs.find((j) => j.id === pickedIdentity.job_id) : null);
  const saveTargetJob = current?.status === "COMPLETED" ? current : pickedJob ?? null;
  const alreadySaved = saveTargetJob
    ? identities.find((a) => a.job_id === saveTargetJob.id) ?? null
    : pickedIdentity;

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function setIdentityRows(rows: SavedAvatar[]) {
    setIdentities(rows);
    onIdentities?.(rows);
  }

  async function refresh() {
    const [m, jobBody, ids] = await Promise.all([
      json<Models>("/api/models/avatar"),
      json<{ jobs: AvatarJob[] }>("/api/avatars"),
      json<{ identities: SavedAvatar[] }>("/api/identities"),
    ]);
    setModels(m);
    setIdentityRows(ids.identities);
    const ordered = jobBody.jobs;
    setJobs(ordered);
    const live = ordered.find(isLive) ?? null;
    if (live) openStage();
    setCurrentId((prev) => {
      if (live) return live.id;
      if (prev && ordered.some((j) => j.id === prev)) return prev;
      return prev;
    });
    if (m.models.find((x) => x.id === "qwen")?.blocked && provider === "qwen") {
      setProvider("openrouter-flux");
    }
  }

  useEffect(() => {
    refresh().catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!current || !isLive(current)) return;
    const jobId = current.id;
    const t = window.setInterval(() => {
      json<AvatarJob>(`/api/avatars/${jobId}`)
        .then((job) => {
          setJobs((prev) => [job, ...prev.filter((j) => j.id !== job.id)]);
          setCurrentId(job.id);
          if (job.status === "COMPLETED") {
            setBusy(false);
            setPickedId((prev) => prev ?? job.id);
          }
          if (job.status === "FAILED" || job.status === "CANCELLED") setBusy(false);
        })
        .catch((e: Error) => setError(e.message));
    }, 2000);
    return () => window.clearInterval(t);
  }, [current?.id, current?.status]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ensureAuthed()) return;
    if (!file) {
      setError("Upload a face photo first.");
      return;
    }
    if (working) {
      setError("A job is already running.");
      return;
    }
    setError(null);
    openStage();
    setCurrentId(null);
    setPickedId(null);
    setBusy(true);
    const body = new FormData();
    body.append("image", file);
    body.append("provider", provider);
    try {
      const job = await json<AvatarJob>("/api/avatars", { method: "POST", body });
      setJobs((prev) => [job, ...prev.filter((j) => j.id !== job.id)]);
      setCurrentId(job.id);
      setPickedId(null);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function stop() {
    if (!current || !isLive(current)) return;
    try {
      const job = await json<AvatarJob>(`/api/avatars/${current.id}/cancel`, { method: "POST" });
      setJobs((prev) => [job, ...prev.filter((j) => j.id !== job.id)]);
      setBusy(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function pickIdentity(row: SavedAvatar) {
    openStage();
    setPickedId(row.id);
    setCurrentId(row.job_id);
  }

  function clearUpload() {
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function pickUnsaved(job: AvatarJob) {
    openStage();
    setPickedId(job.id);
    setCurrentId(job.id);
  }

  async function savePicked(name: string) {
    const job = saveTargetJob;
    if (!job || job.status !== "COMPLETED") {
      setError("Generate a portrait first, then save it.");
      return;
    }
    if (!name.trim()) {
      setError("Type a name before you save.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (alreadySaved) {
        await json<SavedAvatar>(`/api/identities/${alreadySaved.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
        });
      } else {
        await json<SavedAvatar>("/api/identities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ job_id: job.id, name: name.trim() }),
        });
      }
      const ids = await json<{ identities: SavedAvatar[] }>("/api/identities");
      setIdentityRows(ids.identities);
      const row = ids.identities.find((a) => a.job_id === job.id);
      if (row) setPickedId(row.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const blocked = selected?.blocked ?? null;
  const unsavedJobs = jobs.filter(
    (j) => j.status === "COMPLETED" && !identities.some((a) => a.job_id === j.id),
  );
  const showResult = current?.status === "COMPLETED" || saveTargetJob?.status === "COMPLETED";
  const resultJob = current?.status === "COMPLETED" ? current : saveTargetJob;

  return (
    <main className="studio avatar-page">
      <header className="page-head avatar-heading">
        <div>
          <p className="kicker">Avatars</p>
          <h1>Imagine it. Then be in it.</h1>
          <p className="lede">Upload a face. Generate your look. Save the identity — then step into images, videos, and effects.</p>
        </div>
      </header>

      <div className={`avatar-workspace${stageOpen ? " has-stage" : ""}`}>
      <form ref={controlsRef} className="avatar-controls" onSubmit={(e) => void onSubmit(e)}>
        <div className="avatar-settings-column">
        <fieldset className="avatar-model-picker" disabled={working}>
          <legend className="avatar-section-label"><span>01</span> Model settings</legend>
          <div className="avatar-model-grid">
            {AVATAR_MODELS.map((row) => {
              const live = models?.models.find((m) => m.id === row.backendId);
              return (
                <label key={row.id} className={`avatar-model-option${provider === row.backendId ? " is-selected" : ""}${live?.blocked ? " is-blocked" : ""}`}>
                  <input type="radio" name="avatar-model" value={row.backendId} checked={provider === row.backendId} disabled={Boolean(live?.blocked)} onChange={() => setProvider(row.backendId)} />
                  <span className="avatar-model-name">{row.name}</span>
                  <span className="avatar-model-meta">{live?.blocked ? "Unavailable" : row.tag ?? row.vibe}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <details className="avatar-prompt">
          <summary>Prompt &amp; details</summary>
          <textarea readOnly value={models?.prompt ?? "loading…"} />
        </details>
        {selected?.notes ? <p className="muted avatar-dock-note">{selected.notes}</p> : null}
        {blocked ? <p className="notice">{blocked}</p> : null}
        </div>
        <div className="avatar-upload-column">
        <div className="avatar-section-label"><span>02</span> Upload your photo</div>
        <button
          type="button"
          className={`avatar-upload${preview ? " has-photo" : ""}`}
          disabled={working}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (working) return;
            const next = e.dataTransfer.files?.[0];
            if (next && ["image/jpeg", "image/png", "image/webp"].includes(next.type)) setFile(next);
            else if (next) setError("Choose a JPG, PNG or WebP photo.");
          }}
        >
          {preview ? <img src={preview} alt="Your reference photo" /> : (
            <>
              <span className="avatar-upload-icon" aria-hidden="true">↥</span>
              <strong>Start with a face</strong>
              <span>Drop your photo here or browse</span>
              <small>JPG, PNG or WebP · One clear face</small>
            </>
          )}
          {preview ? <span className="avatar-replace">Replace photo ↗</span> : null}
        </button>
        {preview ? <button type="button" className="avatar-remove" disabled={working} onClick={clearUpload}>Remove photo</button> : null}
        <input
          ref={fileRef}
          id="image"
          className="visually-hidden"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={working}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        {error ? <p className="notice" role="alert">{error}</p> : null}
        <div className="avatar-create-actions">
          <button type="submit" className="btn lime avatar-generate" disabled={working || Boolean(blocked) || !file}>
            <span aria-hidden="true">✦</span> {working ? "Creating your avatar…" : "Generate avatar"}
            {!working ? <span aria-hidden="true">↗</span> : null}
          </button>
          {working && current && isLive(current) ? <button type="button" className="avatar-remove" onClick={() => void stop()}>Stop generation</button> : null}
        </div>
        </div>
      </form>
      {stageOpen ? <div className="avatar-preview" aria-busy={working}>
        <div className="avatar-preview-top"><span>03 · YOUR AVATAR</span><span className={working ? "is-working" : ""}>● {working ? "Creating" : showResult ? "Ready" : "Ready when you are"}</span></div>
        {working ? (
          <div className="avatar-render" role="status" aria-live="polite">
            <div className="avatar-render-canvas" aria-hidden="true">
              {preview ? <img src={preview} alt="" /> : null}
              <div className="avatar-shimmer" />
              <span className="avatar-sparkle sparkle-one">✦</span><span className="avatar-sparkle sparkle-two">✦</span><span className="avatar-sparkle sparkle-three">✧</span>
            </div>
            <h2>A little magic in the making.</h2>
            <p>{current?.phase_label || "Creating your portrait…"}</p>
            <span className="avatar-render-caption">Your portrait will appear here when it’s ready.</span>
          </div>
        ) : showResult && resultJob ? (

        <SaveNamePanel
          key={resultJob.id}
          resultId={resultJob.id}
          imageSrc={apiUrl(`/api/avatars/${resultJob.id}/output`)}
          tag={`${alreadySaved?.name || "Not saved yet"} · ${displayNameForProvider(resultJob.provider)}`}
          alreadySaved={Boolean(alreadySaved)}
          existingName={alreadySaved?.name ?? ""}
          saving={saving}
          onSave={(name) => void savePicked(name)}
        />
      ) : (
        <div className="avatar-empty-stage">
          <h2>{current?.status === "CANCELLED" ? "Generation stopped" : "No portrait created"}</h2>
          <p>Choose your photo and try again when you’re ready.</p>
        </div>
      )}
      {!working ? <div className="avatar-result-actions">
        <button type="button" className="avatar-remove" onClick={() => { setStageOpen(false); setPickedId(null); setCurrentId(null); }}>Dismiss result</button>
      </div> : null}
      {current?.status === "FAILED" || current?.status === "CANCELLED" ? <p className="notice" role="status">{current.error || (current.status === "CANCELLED" ? "Generation stopped. You can try again when you’re ready." : "Generation failed. Please try again.")}</p> : null}
      </div> : null}
      </div>

      <section className="avatar-collection">
        <div className="avatar-collection-heading">
          <div><p className="kicker">YOUR CAST, COLLECTED</p><h2>Saved avatars <span>{identities.length.toString().padStart(2, "0")}</span></h2></div>
          <p>Select a portrait to view it or give it a name.</p>
        </div>
        {identities.length === 0 && unsavedJobs.length === 0 ? (
          <div className="need-avatar">
            <strong>Your cast is waiting</strong>
            <p>Create your first portrait above, then save it here for your next image or video.</p>
          </div>
        ) : (
          <div className="gallery compact">
            {unsavedJobs.map((job) => (
              <figure
                key={job.id}
                className={`tile${pickedId === job.id ? " selected" : ""}`}
              >
                <button type="button" className="tile-open" disabled={working} aria-label="Select unsaved portrait" onClick={() => pickUnsaved(job)}>
                  <img src={apiUrl(`/api/avatars/${job.id}/output`)} alt="Unsaved portrait" />
                </button>
                <figcaption className="tile-meta">
                  <div className="tile-meta-text">
                    <strong>Unsaved</strong>
                    <span className="muted">{displayNameForProvider(job.provider)}</span>
                  </div>
                </figcaption>
              </figure>
            ))}
            {identities.map((a) => (
              <figure
                key={a.id}
                className={`tile${pickedId === a.id ? " selected" : ""}`}
              >
                <button type="button" className="tile-open" disabled={working} aria-label={`Select ${a.name}`} onClick={() => pickIdentity(a)}>
                  <img src={a.image_url} alt={a.name} />
                </button>
                <figcaption className="tile-meta">
                  <div className="tile-meta-text">
                    <strong>{a.name}</strong>
                    <span className="muted">{pickedId === a.id ? "Selected" : "Saved"}</span>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
