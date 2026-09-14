import { useEffect, useMemo, useRef, useState } from "react";
import { Lightbox, type LightboxItem } from "./Lightbox";
import {
  downloadUrl,
  formatClip,
  formatDuration,
  formatElapsed,
  isLive,
  isVideoJob,
  isVideoTemplate,
  json,
  outputUrl,
  SWAP_STEPS,
  stepIndex,
  type Catalog,
  type SavedAvatar,
  type SwapJob,
} from "./studio";

export function TemplateStudio({
  templateId,
  catalog,
  jobs,
  identities,
  onJob,
  onBack,
  onLibrary,
  onGoAvatar,
  onEditInStudio,
  mode = "image",
}: {
  templateId: string;
  catalog: Catalog | null;
  jobs: SwapJob[];
  identities: SavedAvatar[];
  onJob: (job: SwapJob) => void;
  onBack: () => void;
  onLibrary: () => void;
  onGoAvatar: () => void;
  onEditInStudio?: (id: string) => Promise<void>;
  mode?: "image" | "video";
}) {
  const [face, setFace] = useState<File | null>(null);
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [faceUrl, setFaceUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [zoom, setZoom] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const template = catalog?.templates.find((t) => t.id === templateId) ?? null;
  const blocked = catalog?.cpu?.blocked ?? null;
  const liveAnywhere = jobs.find(isLive);
  const mine = useMemo(
    () =>
      jobs
        .filter((j) => j.template_id === templateId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [jobs, templateId],
  );
  const current = mine[0];
  const running = isLive(current) ? current : null;
  const result = current?.status === "COMPLETED" ? current : null;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    return () => {
      if (faceUrl) URL.revokeObjectURL(faceUrl);
    };
  }, [faceUrl]);

  function chooseFace(file: File | null) {
    setError(null);
    if (faceUrl) URL.revokeObjectURL(faceUrl);
    if (!file) {
      setFace(null);
      setFaceUrl(null);
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setFace(null);
      setFaceUrl(null);
      setError("Use a JPEG, PNG, or WebP photo.");
      return;
    }
    setFace(file);
    setAvatarId(null);
    setFaceUrl(URL.createObjectURL(file));
  }

  function chooseAvatar(id: string) {
    const row = identities.find((a) => a.id === id);
    setError(null);
    if (faceUrl) URL.revokeObjectURL(faceUrl);
    setFace(null);
    setAvatarId(id);
    setFaceUrl(row?.image_url ?? null);
  }

  async function recreate() {
    if ((!face && !avatarId) || !template) return;
    setError(null);
    if (liveAnywhere) {
      setError("Another generate is running. Wait for it to finish.");
      return;
    }
    if (blocked) {
      setError(blocked);
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.append("template_id", template.id);
      if (avatarId) body.append("avatar_id", avatarId);
      else if (face) body.append("image", face);
      onJob(await json<SwapJob>("/api/faceswaps", { method: "POST", body }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    if (!running) return;
    try {
      onJob(await json<SwapJob>(`/api/faceswaps/${running.id}/cancel`, { method: "POST" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (catalog && !template) {
    return (
      <main className="studio">
        <button type="button" className="btn ghost back" onClick={onBack}>
          ‹ All templates
        </button>
        <div className="empty">
          <h2>That template is gone</h2>
          <p className="muted">It is no longer in the template folder.</p>
        </div>
      </main>
    );
  }

  const shown = result ?? null;
  const videoLook = mode === "video" || isVideoTemplate(template);
  const items: LightboxItem[] = [];
  if (template) {
    items.push({
      id: `template-${template.id}`,
      src: videoLook ? (template.video_url ?? template.image_url ?? "") : (template.image_url ?? ""),
      download: videoLook ? (template.video_url ?? template.image_url ?? "") : (template.image_url ?? ""),
      title: `${template.label} · original`,
      subtitle: videoLook ? "Template clip, untouched" : "Template still, untouched",
      kind: videoLook ? "video" : "image",
    });
  }
  if (shown) {
    items.push({
      id: shown.id,
      src: outputUrl(shown),
      download: downloadUrl(shown),
      title: `${template?.label ?? "Generated"} · your ${videoLook ? "video" : "image"}`,
      subtitle: `Generated in ${formatDuration(shown.duration_ms)}`,
      kind: isVideoJob(shown) || videoLook ? "video" : "image",
    });
  }
  const resultIndex = items.length - 1;
  const active = stepIndex(running?.phase);

  return (
    <main className="studio">
      <button type="button" className="btn ghost back" onClick={onBack}>
        ‹ All templates
      </button>

      <div className="compose">
        <section className={`compose-stage${shown ? " paired" : ""}`}>
          <div className="stage-frame">
            {videoLook ? (
              <>
                <video
                  src={template?.video_url}
                  poster={template?.image_url}
                  controls
                  playsInline
                  muted
                  loop
                  autoPlay
                />
                <button
                  type="button"
                  className="stage-tag stage-tag-btn"
                  onClick={() => setZoom(0)}
                >
                  Original · full screen
                </button>
              </>
            ) : (
              <button
                type="button"
                className="stage-zoom"
                onClick={() => setZoom(0)}
                aria-label={`Open ${template?.label ?? "template"} full screen`}
              >
                <img src={template?.image_url} alt={template?.label ?? "Template"} />
                <span className="stage-tag">Original</span>
              </button>
            )}
            {running ? <div className="stage-working" aria-hidden="true" /> : null}
          </div>

          {shown ? (
            <div className="stage-frame">
              {isVideoJob(shown) || videoLook ? (
                <>
                  <video src={outputUrl(shown)} controls playsInline />
                  <button
                    type="button"
                    className="stage-tag stage-tag-btn"
                    onClick={() => setZoom(resultIndex)}
                  >
                    Your video · full screen
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="stage-zoom"
                  onClick={() => setZoom(resultIndex)}
                  aria-label="Open your generated image full screen"
                >
                  <img src={outputUrl(shown)} alt="Your generated image" />
                  <span className="stage-tag">Your image · click to enlarge</span>
                </button>
              )}
            </div>
          ) : null}
        </section>

        <section className="compose-panel">
          <p className="kicker">
            {template?.effect ? `${template.effect} · ${template.label}` : template?.label}
          </p>
          <h1>
            {shown
              ? videoLook
                ? "Your video is ready"
                : "Your image is ready"
              : "Add a reference still"}
          </h1>
          <p className="lede">
            {shown
              ? "Original on the left. Yours on the right. Saved to the library — download it, or run the prompt again with a different still."
              : videoLook
                ? `Add a reference still or a saved identity. A ${formatClip(template?.duration_s) || "30s clip"} takes several minutes.`
                : "Select a saved identity, or add one reference still. We generate from that prompt."}
          </p>

          <div className="identity-pick">
            <p className="kicker">Select a saved identity</p>
            {identities.length === 0 ? (
              <div className="need-avatar">
                <strong>Create an avatar first</strong>
                <p>Looks need a saved identity. Generate a portrait, name it, save it — then pick it here.</p>
                <button type="button" className="btn lime" onClick={onGoAvatar}>
                  Create avatar
                </button>
              </div>
            ) : (
              <div className="history-row">
                {identities.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={`identity-chip${avatarId === a.id ? " on" : ""}`}
                    onClick={() => chooseAvatar(a.id)}
                    title={a.name}
                  >
                    <img src={a.image_url} alt={a.name} />
                    <span>{a.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div
            className={`dropzone${dragging ? " over" : ""}${faceUrl ? " filled" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              chooseFace(e.dataTransfer.files?.[0] ?? null);
            }}
          >
            {faceUrl ? (
              <>
                <img className="drop-preview" src={faceUrl} alt="Reference still" />
                <div className="drop-text">
                  <strong>{face?.name ?? identities.find((a) => a.id === avatarId)?.name}</strong>
                  <span className="muted">{Math.round((face?.size ?? 0) / 1024)} KB</span>
                </div>
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => fileRef.current?.click()}
                >
                  Change
                </button>
              </>
            ) : (
              <button type="button" className="drop-empty" onClick={() => fileRef.current?.click()}>
                <span className="drop-icon" aria-hidden="true">
                  ＋
                </span>
                <strong>Add a reference still</strong>
                <span className="muted">Drag it here, or click to browse</span>
              </button>
            )}
            <input
              ref={fileRef}
              className="visually-hidden"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => chooseFace(e.target.files?.[0] ?? null)}
            />
          </div>

          {running ? (
            <div className="progress">
              <div className="progress-head">
                <span className="spinner" />
                <div>
                  <strong>{running.phase_label || "Generating…"}</strong>
                  <p className="muted">{formatElapsed(running.created_at, now)} elapsed</p>
                </div>
              </div>
              <ol className="steps">
                {SWAP_STEPS.map((s, i) => (
                  <li
                    key={s.phase}
                    className={i < active ? "done" : i === active ? "current" : undefined}
                  >
                    {s.label}
                  </li>
                ))}
              </ol>
              <button type="button" className="btn ghost small" onClick={() => void stop()}>
                Stop
              </button>
            </div>
          ) : (
            <div className="panel-actions">
              <button
                type="button"
                className="btn lime"
                disabled={(!face && !avatarId) || busy || Boolean(blocked) || Boolean(liveAnywhere)}
                onClick={() => void recreate()}
              >
                {busy ? "Starting…" : shown ? "Generate again" : "Generate"}
              </button>
              {shown ? (
                <>
                  <a className="btn ghost" href={downloadUrl(shown)} download>
                    Download
                  </a>
                  {onEditInStudio ? (
                    <button type="button" className="btn ghost" onClick={() => void onEditInStudio(shown.id)}>
                      Edit in Studio
                    </button>
                  ) : null}
                  <button type="button" className="btn ghost" onClick={onLibrary}>
                    View library
                  </button>
                </>
              ) : null}
            </div>
          )}

          {current?.status === "FAILED" ? (
            <p className="notice">{current.error || "That generate failed. Try another still."}</p>
          ) : null}
          {error ? <p className="notice">{error}</p> : null}
          {blocked && !error ? <p className="notice">{blocked}</p> : null}

          {mine.length > 1 ? (
            <div className="panel-history">
              <p className="kicker">Earlier with this template</p>
              <div className="history-row">
                {mine
                  .filter((j) => j.status === "COMPLETED" && j.id !== shown?.id)
                  .slice(0, 6)
                  .map((j) =>
                    isVideoJob(j) ? (
                      <video key={j.id} src={outputUrl(j)} muted playsInline preload="metadata" />
                    ) : (
                      <img key={j.id} src={outputUrl(j)} alt="Earlier result" />
                    ),
                  )}
              </div>
            </div>
          ) : null}
        </section>
      </div>

      {zoom !== null && items[zoom] ? (
        <Lightbox items={items} index={zoom} onIndex={setZoom} onClose={() => setZoom(null)} />
      ) : null}
    </main>
  );
}
