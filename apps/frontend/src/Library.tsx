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

type FilmStep = "script" | "cast" | "studio";

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
  const [films, setFilms] = useState<StudioProject[]>([]);

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
    if (!window.confirm("Delete this from your library? The file is removed.")) return;
    setBusyId(id);
    try {
      await onDelete(id);
      after?.();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="studio">
      <header className="page-head">
        <div>
          <p className="kicker">Your library</p>
          <h1>Everything you have generated</h1>
          <p className="lede">
            {done.length + films.length === 0
              ? "Generated images, videos, and films you save land here."
              : `${done.length + films.length} item${done.length + films.length === 1 ? "" : "s"}. Open one, download it, or jump back into a film.`}
          </p>
        </div>
      </header>

      {done.length === 0 && films.length === 0 ? (
        <div className="empty">
          <div className="empty-art" aria-hidden="true" />
          <h2>Nothing here yet</h2>
          <p className="muted">Create an avatar first if you have none. Then generate a look — it lands here.</p>
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
                      <video src={still.src} muted playsInline loop autoPlay preload="auto" />
                    ) : (
                      <img src={still.src} alt="" />
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
          {done.map((job, i) => {
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
                    <video src={outputUrl(job)} muted playsInline loop autoPlay preload="auto" />
                  ) : (
                    <img src={outputUrl(job)} alt={labels.get(job.template_id) ?? "Generated image"} />
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
                        void remove(job.id);
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
      )}

      {open !== null && items[open] ? (
        <Lightbox
          items={items}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          onDelete={(id) => {
            void remove(id, () => setOpen(null));
          }}
        />
      ) : null}
    </main>
  );
}
