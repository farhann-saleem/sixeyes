import { useEffect, useMemo, useState } from "react";
import { Lightbox, type LightboxItem } from "./Lightbox";
import {
  downloadUrl,
  formatAgo,
  formatClock,
  formatDuration,
  isVideoJob,
  outputUrl,
  type Catalog,
  type SwapJob,
} from "./studio";
import { api, type StudioProject } from "./video-studio/model";
import { DeferredVideo } from "./viewport-media";

type FilmStep = "script" | "cast" | "studio";

type LibraryAudio = {
  id: string;
  kind: string;
  title: string;
  created_at: string;
  status: string;
  has_cover?: boolean;
};

function filmStep(p: StudioProject): FilmStep {
  return ["studio", "exported"].includes(p.phase) ? "studio" : p.phase === "cast" ? "cast" : "script";
}

function filmStill(p: StudioProject): { src: string; video: boolean } | null {
  const clip = p.clips.find((c) => c.preview_url && (c.kind === "video" || c.kind === "image"));
  if (clip?.preview_url) return { src: clip.preview_url, video: clip.kind === "video" };
  for (const scene of p.script?.scenes ?? []) {
    const pick = scene.candidates.find((c) => c.upload_id === scene.picked_upload_id) ?? scene.candidates[0];
    if (pick) return { src: pick.preview_url, video: pick.kind === "video" };
  }
  return null;
}

export function Library({
  imageCatalog,
  videoCatalog,
  effectCatalog,
  jobs,
  onBrowseImages,
  onBrowseVideos,
  onBrowseEffects,
  onGoAvatar,
  onDelete,
  onEditInStudio,
  onOpenFilm,
}: {
  imageCatalog: Catalog | null;
  videoCatalog: Catalog | null;
  effectCatalog?: Catalog | null;
  jobs: SwapJob[];
  onBrowseImages: () => void;
  onBrowseVideos: () => void;
  onBrowseEffects?: () => void;
  onGoAvatar?: () => void;
  onDelete: (id: string) => Promise<void>;
  onEditInStudio: (id: string) => Promise<void>;
  onOpenFilm: (id: string, step: FilmStep) => void;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [films, setFilms] = useState<StudioProject[]>([]);
  const [audioJobs, setAudioJobs] = useState<LibraryAudio[]>([]);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [limit, setLimit] = useState(12);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    api<{ projects: StudioProject[] }>("/api/studio/projects")
      .then((body) => {
        if (alive) setFilms(body.projects.filter((p) => p.in_library));
      })
      .catch(() => {
        if (alive) setFilms([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/audio/jobs", { headers: { Accept: "application/json" } })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { jobs?: LibraryAudio[] }) => {
        if (alive && Array.isArray(data?.jobs)) {
          setAudioJobs(data.jobs.filter((j) => j.status === "COMPLETED"));
        }
      })
      .catch(() => {
        if (alive) setAudioJobs([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  function togglePlayAudio(id: string) {
    if (playingAudioId === id) {
      setPlayingAudioId(null);
      return;
    }
    const audio = new Audio(`/api/audio/jobs/${encodeURIComponent(id)}/output`);
    setPlayingAudioId(id);
    audio.play().catch(() => setPlayingAudioId(null));
    audio.onended = () => setPlayingAudioId(null);
  }

  const labels = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of imageCatalog?.templates ?? []) map.set(t.id, t.label);
    for (const t of videoCatalog?.templates ?? []) map.set(t.id, t.label);
    for (const t of effectCatalog?.templates ?? []) map.set(t.id, t.label);
    return map;
  }, [imageCatalog, videoCatalog, effectCatalog]);

  const done = useMemo(
    () =>
      jobs
        .filter((j) => j.status === "COMPLETED")
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [jobs],
  );

  const items: LightboxItem[] = done.map((job) => ({
    id: job.id,
    src: outputUrl(job),
    download: downloadUrl(job),
    title: labels.get(job.template_id) ?? "Generated",
    subtitle: `${formatClock(job.created_at)} · ${formatDuration(job.duration_ms)}`,
    kind: isVideoJob(job) ? "video" : "image",
  }));

  async function remove(id: string, after?: () => void) {
    setBusyId(id);
    try {
      await onDelete(id);
      after?.();
    } finally {
      setBusyId(null);
    }
  }

  const totalCount = done.length + films.length + audioJobs.length;

  return (
    <main className="studio">
      <header className="page-head">
        <div>
          <p className="kicker">Your library</p>
          <h1>Everything you have generated</h1>
          <p className="lede">
            {totalCount === 0
              ? "Generated images, videos, and films you save land here."
              : `${totalCount} item${totalCount === 1 ? "" : "s"}. Open one, download it, or jump back into a film.`}
          </p>
        </div>
      </header>

      {totalCount === 0 ? (
        <div className="empty">
          <div className="empty-art" aria-hidden="true" />
          <h2>Nothing here yet</h2>
          <p className="muted">Create an avatar first if you have none. Generated looks, audio, and films appear here.</p>
          <div className="panel-actions">
            {onGoAvatar ? (
              <button type="button" className="btn lime" onClick={onGoAvatar}>
                Create avatar
              </button>
            ) : null}
            <button type="button" className="btn primary" onClick={onBrowseImages}>
              Browse images
            </button>
            <button type="button" className="btn ghost" onClick={onBrowseVideos}>
              Browse videos
            </button>
            {onBrowseEffects ? (
              <button type="button" className="btn ghost" onClick={onBrowseEffects}>
                Browse effects
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          {films.length > 0 && (
            <section className="library-shelf" style={{ marginBottom: done.length > 0 || audioJobs.length > 0 ? "48px" : "0" }}>
              <div className="library-shelf-head" style={{ marginBottom: "18px" }}>
                <p className="kicker" style={{ margin: "0 0 4px" }}>Documentary Suite</p>
                <h2 style={{ margin: "0 0 6px", fontSize: "1.5rem" }}>Your Documentaries & Saved Films</h2>
                <p className="muted" style={{ margin: 0 }}>
                  {films.length} documentary {films.length === 1 ? "film" : "films"}. Open any project to continue scripting, casting scene shots, or timeline editing.
                </p>
              </div>
              <div className="gallery library-grid">
                {films.map((film) => {
                  const still = filmStill(film);
                  return (
                    <figure key={film.id} className="tile">
                      <button
                        type="button"
                        className="tile-open"
                        onClick={() => onOpenFilm(film.id, filmStep(film))}
                        aria-label={`Open ${film.name}`}
                      >
                        {still ? (
                          still.video ? (
                            <DeferredVideo src={still.src} muted playsInline loop autoPlay />
                          ) : (
                            <img src={still.src} alt={film.name ? `${film.name} preview` : "Film preview"} loading="lazy" decoding="async" />
                          )
                        ) : (
                          <span className="tile-letter">{film.name.slice(0, 1).toUpperCase()}</span>
                        )}
                      </button>
                      <figcaption className="tile-meta">
                        <div className="tile-meta-text">
                          <strong>{film.name}</strong>
                          <span>Documentary · {film.phase}</span>
                        </div>
                        <div className="tile-actions">
                          <button type="button" className="btn ghost small" onClick={() => onOpenFilm(film.id, filmStep(film))}>
                            Open film
                          </button>
                        </div>
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            </section>
          )}

          {done.length > 0 && (
            <section className="library-shelf">
              {films.length > 0 && (
                <div className="library-shelf-head" style={{ marginBottom: "18px" }}>
                  <p className="kicker" style={{ margin: "0 0 4px" }}>Studio Media</p>
                  <h2 style={{ margin: "0 0 6px", fontSize: "1.5rem" }}>Generated Stills & Video Clips</h2>
                  <p className="muted" style={{ margin: 0 }}>
                    {done.length} item{done.length === 1 ? "" : "s"} from your image and video creations.
                  </p>
                </div>
              )}
              <div className="gallery library-grid">
                {done.slice(0, limit).map((job, i) => {
                  const video = isVideoJob(job);
                  return (
                    <figure
                      key={job.id}
                      className="tile stagger"
                      style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                    >
                      <button
                        type="button"
                        className="tile-open"
                        onClick={() => setOpen(i)}
                        aria-label={`Open ${labels.get(job.template_id) ?? (video ? "video" : "image")} full screen`}
                      >
                        {video ? (
                          <DeferredVideo src={outputUrl(job)} muted playsInline loop autoPlay />
                        ) : (
                          <img src={outputUrl(job)} alt={labels.get(job.template_id) ?? "Generated image"} loading="lazy" decoding="async" />
                        )}
                        <span className="tile-scrim" aria-hidden="true" />
                        <span className="tile-zoom" aria-hidden="true">
                          ⤢
                        </span>
                      </button>
                      <figcaption className="tile-meta">
                        <div className="tile-meta-text">
                          <strong>{labels.get(job.template_id) ?? "Generated"}</strong>
                          <span className="muted" title={formatClock(job.created_at)}>
                            {formatAgo(job.created_at, now)} · {formatDuration(job.duration_ms)}
                            {video ? " · video" : ""}
                          </span>
                        </div>
                        <div className="tile-actions">
                          <a
                            className="btn ghost small"
                            href={downloadUrl(job)}
                            download
                            onClick={(e) => e.stopPropagation()}
                          >
                            Download
                          </a>
                          <button
                            type="button"
                            className="btn ghost small"
                            onClick={(e) => {
                              e.stopPropagation();
                              void onEditInStudio(job.id);
                            }}
                          >
                            Edit in Studio
                          </button>
                          <button
                            type="button"
                            className="btn ghost small"
                            disabled={busyId === job.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(job.id);
                            }}
                          >
                            {busyId === job.id ? "Deleting…" : "Delete"}
                          </button>
                        </div>
                      </figcaption>
                    </figure>
                  );
                })}
              </div>

              {done.length > limit ? (
                <div style={{ textAlign: "center", margin: "24px 0" }}>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setLimit((l) => l + 12)}
                  >
                    Load more ({done.length - limit} remaining)
                  </button>
                </div>
              ) : null}
            </section>
          )}

          {audioJobs.length > 0 && (
            <section className="library-shelf" style={{ marginTop: "48px" }}>
              <div className="library-shelf-head" style={{ marginBottom: "18px" }}>
                <p className="kicker" style={{ margin: "0 0 4px" }}>Sound & Music</p>
                <h2 style={{ margin: "0 0 6px", fontSize: "1.5rem" }}>Generated Audio & Soundtracks</h2>
                <p className="muted" style={{ margin: 0 }}>
                  {audioJobs.length} audio track{audioJobs.length === 1 ? "" : "s"} from your speech, SFX, and Suno music creations.
                </p>
              </div>
              <div className="gallery library-grid">
                {audioJobs.map((aj) => {
                  const isPlaying = playingAudioId === aj.id;
                  return (
                    <figure key={aj.id} className="tile">
                      <div className="tile-open" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#1a1429", color: "#c2ef4e", minHeight: "160px" }}>
                        <button
                          type="button"
                          onClick={() => togglePlayAudio(aj.id)}
                          style={{
                            width: "56px",
                            height: "56px",
                            borderRadius: "50%",
                            background: isPlaying ? "#fa7faa" : "#c2ef4e",
                            border: "none",
                            color: "#150f23",
                            fontSize: "20px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
                          }}
                          aria-label={isPlaying ? "Pause audio preview" : "Play audio preview"}
                        >
                          {isPlaying ? "❚❚" : "▶"}
                        </button>
                        <span style={{ marginTop: "12px", fontSize: "0.8rem", color: "#a59cb8", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                          {aj.kind}
                        </span>
                      </div>
                      <figcaption className="tile-meta">
                        <div className="tile-meta-text">
                          <strong>{aj.title || "Audio Track"}</strong>
                          <span className="muted">{formatClock(aj.created_at)}</span>
                        </div>
                        <div className="tile-actions">
                          <a
                            className="btn ghost small"
                            href={`/api/audio/jobs/${encodeURIComponent(aj.id)}/output`}
                            download
                          >
                            Download
                          </a>
                        </div>
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      {confirmDeleteId && (
        <div
          className="nav-drawer-overlay"
          style={{ zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            className="film-auth-gate-card"
            style={{ margin: "auto", maxWidth: "420px", background: "#fffdf8" }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3>Delete from library?</h3>
            <p>This action is permanent. The media file will be removed from your cloud storage.</p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn primary"
                style={{ background: "#e53e3e", borderColor: "#c53030", color: "#fff" }}
                disabled={busyId !== null}
                onClick={async () => {
                  const id = confirmDeleteId;
                  setConfirmDeleteId(null);
                  if (id) await remove(id);
                }}
              >
                {busyId ? "Deleting…" : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {open !== null && items[open] ? (
        <Lightbox
          items={items}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          onDelete={(id) => {
            setConfirmDeleteId(id);
            setOpen(null);
          }}
        />
      ) : null}
    </main>
  );
}
