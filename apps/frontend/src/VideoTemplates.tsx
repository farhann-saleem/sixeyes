import { useMemo, useState } from "react";
import { VIDEO_MODELS } from "./model-catalog";
import { ModelStrip } from "./ModelStrip";
import { formatClip, isLive, isVideoJob, type Catalog, type SwapJob, type Template } from "./studio";
import { SkeletonGrid } from "./Skeleton";
import { DeferredVideo } from "./viewport-media";

function effectName(t: Template) {
  if (t.effect) return t.effect;
  const parts = t.filename.replace(/\.[^.]+$/, "").split("_");
  if (parts.length >= 2) {
    return parts[0]
      .split("-")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }
  return "Other";
}

export function VideoTemplates({
  catalog,
  jobs,
  error,
  onOpen,
  kicker = "Videos",
  title = "Image to video",
  lede = "Pick a clip. Choose a video model. Generate motion from your still image.",
  emptyHint = "Add clips to the video-template folder and they appear here.",
  groupByEffect = false,
}: {
  catalog: Catalog | null;
  jobs: SwapJob[];
  error: string | null;
  onOpen: (templateId: string, engine?: string) => void;
  kicker?: string;
  title?: string;
  lede?: string;
  emptyHint?: string;
  groupByEffect?: boolean;
}) {
  const templates = catalog?.templates ?? [];
  const blocked = catalog?.cpu?.blocked ?? null;
  const workers = catalog?.cpu?.health?.workers;
  const r2Error = catalog?.r2?.error ?? null;
  const live = jobs.find(isLive);
  const [engine, setEngine] = useState(VIDEO_MODELS[0]?.id ?? "");

  const countByTemplate = useMemo(() => {
    const map = new Map<string, number>();
    for (const job of jobs) {
      if (job.status !== "COMPLETED" || !isVideoJob(job)) continue;
      map.set(job.template_id, (map.get(job.template_id) ?? 0) + 1);
    }
    return map;
  }, [jobs]);

  const packs = useMemo(() => {
    if (!groupByEffect) return null;
    const map = new Map<string, Template[]>();
    for (const t of templates) {
      const name = effectName(t);
      const list = map.get(name) ?? [];
      list.push(t);
      map.set(name, list);
    }
    return [...map.entries()].map(([name, clips]) => ({ name, clips }));
  }, [groupByEffect, templates]);

  useEffect(() => {
    if (!packs || typeof window === "undefined") return;
    const requested = new URLSearchParams(window.location.search).get("pack");
    if (!requested) return;
    const targetId = requested.toLowerCase().replace(/\s+/g, "-");
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [packs]);

  function renderTile(t: Template, i: number) {
    const running = live?.template_id === t.id;
    const made = countByTemplate.get(t.id) ?? 0;
    return (
      <figure
        key={t.id}
        className={`tile stagger${running ? " running" : ""}`}
        style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
      >
        <button type="button" className="tile-open" onClick={() => onOpen(t.id, engine)}>
          {t.video_url ? (
            <DeferredVideo
              src={t.video_url}
              poster={t.image_url}
              muted
              playsInline
              loop
              autoPlay
            />
          ) : (
            <img src={t.image_url} alt={t.label} loading="lazy" decoding="async" />
          )}
          <span className="tile-scrim" aria-hidden="true" />
          <span className="tile-cta">{running ? "Generating…" : "Generate"}</span>
          {made > 0 ? <span className="tile-badge">{made} in library</span> : null}
        </button>
        <figcaption className="tile-meta">
          <div className="tile-meta-text">
            <strong>{t.label}</strong>
            <span className="muted">
              {running ? "Working on it…" : formatClip(t.duration_s) || "Template"}
            </span>
          </div>
        </figcaption>
      </figure>
    );
  }

  return (
    <main className="studio">
      <header className="page-head">
        <div>
          <p className="kicker">{kicker}</p>
          <h1>{title}</h1>
          <p className="lede">{lede}</p>
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

      <ModelStrip
        label={groupByEffect ? "Effects engines" : "Video models"}
        models={VIDEO_MODELS}
        value={engine}
        onChange={setEngine}
      />

      {blocked ? <p className="notice">{blocked}</p> : null}
      {r2Error ? <p className="notice">Storage: {r2Error}</p> : null}
      {error ? <p className="notice">{error}</p> : null}

      {catalog === null && !error ? (
        <SkeletonGrid count={6} />
      ) : templates.length === 0 ? (
        <div className="empty">
          <div className="empty-art" aria-hidden="true" />
          <h2>No clips published</h2>
          <p className="muted">{emptyHint}</p>
        </div>
      ) : packs ? (
        <div className="effect-packs">
          {packs.map((pack) => (
            <section key={pack.name} className="effect-pack" id={pack.name.toLowerCase().replace(/\s+/g, "-")}>
              <header className="effect-pack-head">
                <h2>{pack.name}</h2>
                <p className="muted">
                  {`${pack.clips.length} clip${pack.clips.length === 1 ? "" : "s"}`}
                </p>
              </header>
              <div className="gallery">{pack.clips.map((t, i) => renderTile(t, i))}</div>
            </section>
          ))}
        </div>
      ) : (
        <div className="gallery video-wall">{templates.map((t, i) => renderTile(t, i))}</div>
      )}
    </main>
  );
}
