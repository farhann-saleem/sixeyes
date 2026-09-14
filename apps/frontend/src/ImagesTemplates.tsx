import { useMemo } from "react";
import { isLive, type Catalog, type SwapJob } from "./studio";

export function ImagesTemplates({
  catalog,
  jobs,
  error,
  onOpen,
}: {
  catalog: Catalog | null;
  jobs: SwapJob[];
  error: string | null;
  onOpen: (templateId: string) => void;
}) {
  const templates = catalog?.templates ?? [];
  const blocked = catalog?.cpu?.blocked ?? null;
  const workers = catalog?.cpu?.health?.workers;
  const r2Error = catalog?.r2?.error ?? null;
  const live = jobs.find(isLive);

  const countByTemplate = useMemo(() => {
    const map = new Map<string, number>();
    for (const job of jobs) {
      if (job.status !== "COMPLETED") continue;
      map.set(job.template_id, (map.get(job.template_id) ?? 0) + 1);
    }
    return map;
  }, [jobs]);

  return (
    <main className="studio">
      <header className="page-head">
        <div>
          <p className="kicker">Images</p>
          <h1>Image to image</h1>
          <p className="lede">
            Pick a still. Add a reference. We write a new image from that prompt.
          </p>
        </div>
        <div className="head-side">
          <div className={`chip ${blocked ? "bad" : "ok"}`}>
            <span className="dot" />
            {blocked
              ? "Worker busy"
              : `Ready${workers ? ` · ${(workers.idle ?? 0) + (workers.ready ?? 0)} workers` : ""}`}
          </div>
        </div>
      </header>

      {blocked ? <p className="notice">{blocked}</p> : null}
      {r2Error ? <p className="notice">Storage: {r2Error}</p> : null}
      {error ? <p className="notice">{error}</p> : null}

      {catalog === null && !error ? (
        <div className="gallery">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="tile skeleton" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="empty">
          <div className="empty-art" aria-hidden="true" />
          <h2>No stills published</h2>
          <p className="muted">Add photos to the image-template folder and they appear here.</p>
        </div>
      ) : (
        <div className="gallery">
          {templates.map((t, i) => {
            const running = live?.template_id === t.id;
            const made = countByTemplate.get(t.id) ?? 0;
            return (
              <figure
                key={t.id}
                className={`tile stagger${running ? " running" : ""}`}
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              >
                <button type="button" className="tile-open" onClick={() => onOpen(t.id)}>
                  <img src={t.image_url} alt={t.label} />
                  <span className="tile-scrim" aria-hidden="true" />
                  <span className="tile-cta">{running ? "Generating…" : "Generate"}</span>
                  {made > 0 ? <span className="tile-badge">{made} in library</span> : null}
                </button>
                <figcaption className="tile-meta">
                  <div className="tile-meta-text">
                    <strong>{t.label}</strong>
                    <span className="muted">{running ? "Working on it…" : "Still"}</span>
                  </div>
                </figcaption>
              </figure>
            );
          })}
        </div>
      )}
    </main>
  );
}
