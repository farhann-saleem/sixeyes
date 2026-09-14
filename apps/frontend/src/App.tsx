import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
  quoted_credits?: number | null;
  credits_remaining?: number | null;
  catalog?: { listed_usd?: number };
};

type Models = {
  prompt: string;
  models: ModelRow[];
};

const NAMES: Record<string, string> = {
  "openrouter-flux": "FLUX.2 Klein 4B",
  openrouter: "Muse on OpenRouter",
  qwen: "Qwen on RunPod",
  ai33pro: "Seedream 4.5",
};

const MODEL_PICK: Array<{
  id: Provider;
  title: string;
  vendor: string;
  price: string;
}> = [
  { id: "openrouter-flux", title: "FLUX.2 Klein 4B", vendor: "OpenRouter", price: "~$0.014" },
  { id: "openrouter", title: "Muse", vendor: "OpenRouter", price: "$0.01" },
  { id: "qwen", title: "Qwen Image Edit", vendor: "RunPod", price: "Self-host" },
  { id: "ai33pro", title: "Seedream 4.5", vendor: "ai33pro", price: "Credits" },
];

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
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = models?.models.find((m) => m.id === provider);
  const qwen = models?.models.find((m) => m.id === "qwen");
  const ai33 = models?.models.find((m) => m.id === "ai33pro");
  const current = jobs.find((j) => j.id === currentId) ?? null;
  const working = busy || isLive(current ?? undefined);

  const latestDone = useMemo(
    () => jobs.find((j) => j.status === "COMPLETED") ?? null,
    [jobs],
  );

  const pickedIdentity = identities.find((a) => a.id === pickedId) ?? null;
  const pickedJob =
    jobs.find((j) => j.id === pickedId && j.status === "COMPLETED") ??
    (pickedIdentity ? jobs.find((j) => j.id === pickedIdentity.job_id) : null);
  const saveTargetJob = pickedJob ?? latestDone;
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
    const done = ordered.find((j) => j.status === "COMPLETED") ?? null;
    setCurrentId((prev) => {
      if (live) return live.id;
      if (prev && ordered.some((j) => j.id === prev)) return prev;
      return done?.id ?? prev;
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
    if (!file) {
      setError("Upload a face photo first.");
      return;
    }
    if (working) {
      setError("A job is already running.");
      return;
    }
    setError(null);
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
    setPickedId(row.id);
    setCurrentId(row.job_id);
  }

  function clearUpload() {
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function pickUnsaved(job: AvatarJob) {
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
      <header className="page-head">
        <div>
          <p className="kicker">Avatars</p>
          <h1>Create an avatar</h1>
          <p className="lede">
            Upload a face. Generate a portrait. Name it. Use that identity on images, videos, and
            effects.
          </p>
        </div>
      </header>

      <div className="avatar-desk">
      <form className="compose-panel" onSubmit={(e) => void onSubmit(e)}>
        <p className="kicker">Generate</p>
        <h2>Photo, then a model</h2>
        <p className="lede">Same order every time. Face first. Pick a model you can actually read. Then generate.</p>

        <div className="avatar-block">
          <p className="avatar-block-label">1 · Face photo</p>
        <div
          className="avatar-shot"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const next = e.dataTransfer.files?.[0] ?? null;
            if (next) setFile(next);
          }}
        >
          {preview ? (
            <img src={preview} alt="Selected reference" />
          ) : (
            <button type="button" className="avatar-shot-empty" onClick={() => fileRef.current?.click()}>
              <strong>Drop a face photo here</strong>
              JPEG, PNG, or WebP. The whole still stays in frame.
            </button>
          )}
          {working ? (
            <div className="gen-wait" aria-live="polite">
              <span className="gen-wait-veil" />
              <p>{current?.phase_label || "Painting the portrait…"}</p>
            </div>
          ) : null}
          <div className="avatar-shot-actions">
            {preview ? (
              <button type="button" className="btn ghost small" disabled={working} onClick={clearUpload}>
                Remove
              </button>
            ) : null}
            <button type="button" className="btn ghost small" disabled={working} onClick={() => fileRef.current?.click()}>
              {preview ? "Replace" : "Upload"}
            </button>
          </div>
        </div>
        </div>
        <input
          ref={fileRef}
          id="image"
          className="visually-hidden"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={working}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        <div className="avatar-block">
          <p className="avatar-block-label" id="model-label">
            2 · Model
          </p>
          <div className="avatar-models" role="radiogroup" aria-labelledby="model-label">
            {MODEL_PICK.map((row) => {
              const live = models?.models.find((m) => m.id === row.id);
              const isOn = provider === row.id;
              const isBlocked = Boolean(live?.blocked);
              const price =
                row.id === "ai33pro" && live?.quoted_credits != null
                  ? `${live.quoted_credits} credits`
                  : row.price;
              return (
                <button
                  key={row.id}
                  type="button"
                  role="radio"
                  aria-checked={isOn}
                  className={`avatar-model${isOn ? " on" : ""}${isBlocked ? " is-blocked" : ""}`}
                  disabled={working}
                  onClick={() => setProvider(row.id)}
                >
                  <strong>{row.title}</strong>
                  <span className="avatar-tags">
                    <span className="avatar-tag">{row.vendor}</span>
                    <span className="avatar-tag">{price}</span>
                    {row.id === "openrouter-flux" ? <span className="avatar-tag ok">Default</span> : null}
                    {isBlocked ? <span className="avatar-tag warn">Blocked</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
          {selected?.notes ? <p className="muted">{selected.notes}</p> : null}
          {provider === "qwen" && qwen?.blocked ? <p className="notice">{qwen.blocked}</p> : null}
          {provider === "ai33pro" && ai33 ? (
            <p className="muted">
              Quoted {ai33.quoted_credits ?? "—"} credits · balance {ai33.credits_remaining ?? "—"}
            </p>
          ) : null}
        </div>

        <details className="avatar-prompt">
          <summary>Locked prompt we send</summary>
          <textarea readOnly value={models?.prompt ?? "loading…"} />
        </details>

        <div className="head-side">
          <button
            type="submit"
            className="btn lime"
            disabled={working || Boolean(blocked) || !file}
          >
            {working ? "Working…" : "Generate portrait"}
          </button>
          {working ? (
            <button type="button" className="btn ghost" onClick={() => void stop()}>
              Stop
            </button>
          ) : null}
        </div>
        {blocked ? <p className="notice">{blocked}</p> : null}
        {error ? <p className="notice">{error}</p> : null}
      </form>
      <div className="avatar-rail">
      {showResult && resultJob ? (
        <SaveNamePanel
          key={resultJob.id}
          resultId={resultJob.id}
          imageSrc={`/api/avatars/${resultJob.id}/output`}
          tag={`${alreadySaved?.name || "Not saved yet"} · ${NAMES[resultJob.provider] || resultJob.provider}`}
          alreadySaved={Boolean(alreadySaved)}
          existingName={alreadySaved?.name ?? ""}
          saving={saving}
          onSave={(name) => void savePicked(name)}
        />
      ) : null}

      <section className="compose-panel">
        <p className="kicker">Identities</p>
        <h2>{showResult ? "Saved and waiting" : "No avatar yet"}</h2>
        <p className="lede">
          {showResult
            ? "Click a still to select it. Unsaved portraits wait here until you name them."
            : "Generate on the left. The portrait and your saved names land on this side."}
        </p>
        {identities.length === 0 && unsavedJobs.length === 0 ? (
          <div className="need-avatar">
            <strong>Create an avatar first</strong>
            <p>Drop a face, pick a model, generate, type a name, then Save avatar.</p>
          </div>
        ) : (
          <div className="gallery compact">
            {unsavedJobs.map((job) => (
              <figure
                key={job.id}
                className={`tile${pickedId === job.id ? " selected" : ""}`}
              >
                <button type="button" className="tile-open" onClick={() => pickUnsaved(job)}>
                  <img src={`/api/avatars/${job.id}/output`} alt="Unsaved portrait" />
                </button>
                <figcaption className="tile-meta">
                  <div className="tile-meta-text">
                    <strong>Unsaved</strong>
                    <span className="muted">{NAMES[job.provider] || job.provider}</span>
                  </div>
                </figcaption>
              </figure>
            ))}
            {identities.map((a) => (
              <figure
                key={a.id}
                className={`tile${pickedId === a.id ? " selected" : ""}`}
              >
                <button type="button" className="tile-open" onClick={() => pickIdentity(a)}>
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
      </div>
      </div>
    </main>
  );
}
