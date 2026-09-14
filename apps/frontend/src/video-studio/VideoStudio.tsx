import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SecurePrompt } from "../SecurePrompt";
import { Preview } from "./Preview";
import { Timeline } from "./Timeline";
import {
  api,
  clipEnd,
  collision,
  formatTc,
  projectDuration,
  type ClipSource,
  type MediaItem,
  type StudioClip,
  type StudioProject,
  type StudioRender,
} from "./model";
import "./nle.css";

type BinTab = "templates" | "library" | "audio" | "uploads";

export function VideoStudio({ projectId, onHome }: { projectId: string; onHome: () => void }) {
  return <StudioEditor key={projectId} projectId={projectId} onHome={onHome} />;
}

function StudioEditor({ projectId, onHome }: { projectId: string; onHome: () => void }) {
  const [project, setProject] = useState<StudioProject | null>(null);
  const [media, setMedia] = useState<{
    templates: MediaItem[];
    library: MediaItem[];
    audio: MediaItem[];
    uploads: MediaItem[];
  } | null>(null);
  const [tab, setTab] = useState<BinTab>("audio");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pps, setPps] = useState(48);
  const [playing, setPlaying] = useState(false);
  const [auditionId, setAuditionId] = useState<string | null>(null);
  const auditionRef = useRef<HTMLAudioElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renders, setRenders] = useState<StudioRender[]>([]);
  const [blocked, setBlocked] = useState<string | null>(null);
  const history = useRef<StudioProject[]>([]);
  const persistTimer = useRef<number>(0);
  const projectRef = useRef<StudioProject | null>(null);
  projectRef.current = project;
  const playRef = useRef(false);
  playRef.current = playing;
  const lastTick = useRef(0);

  const selected = project?.clips.find((c) => c.id === selectedId) ?? null;
  const live = renders.find((r) => r.status === "PENDING" || r.status === "IN_PROGRESS") ?? null;
  const done = renders.find((r) => r.status === "COMPLETED") ?? null;

  const load = useCallback(async () => {
    const [p, m, r] = await Promise.all([
      api<StudioProject>(`/api/studio/projects/${projectId}`),
      api<{ templates: MediaItem[]; library: MediaItem[]; audio: MediaItem[]; uploads: MediaItem[] }>(
        `/api/studio/projects/${projectId}/media`,
      ),
      api<{ jobs: StudioRender[] }>(`/api/studio/projects/${projectId}/renders`),
    ]);
    setProject(p);
    setMedia(m);
    setRenders(r.jobs);
    api<{ blocked: string | null }>("/api/studio/health")
      .then((h) => setBlocked(h.blocked))
      .catch(() => setBlocked(null));
  }, [projectId]);

  useEffect(() => {
    load().catch((e: Error) => setError(e.message));
  }, [load]);

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => {
      api<StudioRender>(`/api/studio/renders/${live.id}`)
        .then((job) => setRenders((prev) => [job, ...prev.filter((x) => x.id !== job.id)]))
        .catch((e: Error) => setError(e.message));
    }, 2000);
    return () => window.clearInterval(id);
  }, [live?.id]);

  const saveChain = useRef<Promise<unknown>>(Promise.resolve());
  const dirtyProject = useRef<StudioProject | null>(null);
  const flush = useCallback(async () => {
    window.clearTimeout(persistTimer.current);
    const next = dirtyProject.current;
    if (next) {
      dirtyProject.current = null;
      saveChain.current = saveChain.current.catch(() => undefined).then(() => api(`/api/studio/projects/${next.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ width: next.width, height: next.height, fps: next.fps,
          playhead_sec: next.playhead_sec, tracks: next.tracks, clips: next.clips }),
      })).catch(err => { dirtyProject.current ??= next; throw err; });
    }
    await saveChain.current;
  }, []);
  const persist = useCallback((next: StudioProject) => {
    dirtyProject.current = next;
    window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => { void flush().catch((e: Error) => setError(e.message)); }, 350);
  }, [flush]);
  useEffect(() => () => { void flush().catch(() => undefined); }, [flush]);

  const apply = useCallback(
    (next: StudioProject, opts?: { persist?: boolean; history?: boolean }) => {
      if (opts?.history && projectRef.current) {
        history.current.push(structuredClone(projectRef.current));
        if (history.current.length > 40) history.current.shift();
      }
      setProject(next);
      if (opts?.persist !== false) persist(next);
    },
    [persist],
  );

  const setPlayhead = useCallback(
    (sec: number) => {
      const p = projectRef.current;
      if (!p) return;
      const next = { ...p, playhead_sec: Math.max(0, sec) };
      setProject(next);
      persist(next);
    },
    [persist],
  );

  const stopAudition = useCallback(() => {
    auditionRef.current?.pause();
    auditionRef.current = null;
    setAuditionId(null);
  }, []);

  useEffect(() => () => stopAudition(), [stopAudition]);

  function toggleAudition(item: MediaItem, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (auditionId === `${item.origin}-${item.id}`) {
      stopAudition();
      return;
    }
    stopAudition();
    setPlaying(false);
    const el = new Audio(item.preview_url);
    auditionRef.current = el;
    setAuditionId(`${item.origin}-${item.id}`);
    void el.play().catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
    el.onended = () => setAuditionId(null);
  }

  useEffect(() => {
    if (!playing) return;
    lastTick.current = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = projectRef.current;
      if (!p || !playRef.current) return;
      const dt = (now - lastTick.current) / 1000;
      lastTick.current = now;
      const dur = projectDuration(p);
      let t = p.playhead_sec + dt;
      if (t >= dur) {
        t = dur;
        setPlaying(false);
      }
      setProject({ ...p, playhead_sec: t });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const p = projectRef.current;
      if (!p) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") {
        if (e.key === "Escape") (e.target as HTMLElement).blur();
        return;
      }
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        stopAudition();
        setPlaying((v) => !v);
      }
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        void splitAtPlayhead();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (!selectedId) return;
        e.preventDefault();
        apply({ ...p, clips: p.clips.filter((c) => c.id !== selectedId) }, { history: true });
        setSelectedId(null);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        const prev = history.current.pop();
        if (prev) apply(prev, { history: false });
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setPlayhead(p.playhead_sec - (e.shiftKey ? 1 : 0.1));
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setPlayhead(p.playhead_sec + (e.shiftKey ? 1 : 0.1));
      }
      if (e.key === "Home") {
        e.preventDefault();
        setPlayhead(0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [apply, selectedId, setPlayhead, stopAudition]);

  async function splitAtPlayhead() {
    const p = projectRef.current;
    if (!p) return;
    const hit = p.clips.find((c) => c.start_sec < p.playhead_sec && clipEnd(c) > p.playhead_sec);
    if (!hit) return;
    try {
      await flush();
      const next = await api<StudioProject>(`/api/studio/projects/${p.id}/clips/${hit.id}/split`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ at: p.playhead_sec }),
      });
      apply(next, { persist: false, history: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function dropMedia(item: { origin: ClipSource["type"]; id: string }, trackId: string, startSec: number) {
    const p = projectRef.current;
    if (!p) return;
    try {
      await flush();
    const next = await api<StudioProject>(`/api/studio/projects/${p.id}/clips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin: item.origin, media_id: item.id, track_id: trackId, start_sec: startSec }),
      });
      apply(next, { persist: false, history: true });
      const added = next.clips.find((c) => !p.clips.some((x) => x.id === c.id));
      if (added) setSelectedId(added.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function addText() {
    const p = projectRef.current;
    if (!p) return;
    await flush();
    const next = await api<StudioProject>(`/api/studio/projects/${p.id}/clips`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin: "text", text: "Your text", start_sec: p.playhead_sec }),
    });
    apply(next, { persist: false, history: true });
    const added = next.clips.find((c) => !p.clips.some((x) => x.id === c.id));
    if (added) setSelectedId(added.id);
  }

  async function uploadFile(file: File) {
    const body = new FormData();
    body.append("project_id", projectId);
    body.append("file", file);
    const row = await api<MediaItem & { kind: MediaItem["kind"] }>("/api/studio/uploads", { method: "POST", body });
    const mediaBody = await api<{
      templates: MediaItem[];
      library: MediaItem[];
      audio: MediaItem[];
      uploads: MediaItem[];
    }>(`/api/studio/projects/${projectId}/media`);
    setMedia(mediaBody);
    setTab("uploads");
    await dropMedia({ origin: "upload", id: row.id }, "", 0);
  }

  async function exportProject() {
    const p = projectRef.current;
    if (!p) return;
    setError(null);
    try {
      await flush();
      const job = await api<StudioRender>(`/api/studio/projects/${p.id}/render`, { method: "POST" });
      setRenders((prev) => [job, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function deleteProject() {
    const p = projectRef.current;
    if (!p) return;
    if (!window.confirm(`Delete “${p.name}”? This cannot be undone.`)) return;
    setError(null);
    try {
      await flush();
      await api(`/api/studio/projects/${p.id}`, { method: "DELETE" });
      onHome();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function patchClip(patch: Partial<StudioClip>) {
    const p = projectRef.current;
    if (!p || !selected) return;
    const clips = p.clips.map((c) => (c.id === selected.id ? { ...c, ...patch } : c));
    const next = { ...p, clips };
    const moved = clips.find((c) => c.id === selected.id)!;
    if (collision(next, moved)) {
      setError("that edit overlaps another clip on the same track");
      return;
    }
    apply(next, { history: true });
  }

  const binItems = useMemo(() => {
    if (!media) return [];
    if (tab === "templates") return media.templates;
    if (tab === "library") return media.library;
    if (tab === "audio") return media.audio;
    return media.uploads;
  }, [media, tab]);

  if (!project) {
    return (
      <div className="nle-page">
        <div className="nle-home">
          <p className="nle-kicker">Video studio</p>
          <p>{error || "Loading project…"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="nle-page">
      <div className="nle-shell">
        <div className="nle-toolbar">
          <span className="nle-tc" title="Playhead">
            {formatTc(project.playhead_sec)}
          </span>
          <select
            className="nle-btn"
            aria-label="Canvas size"
            value={`${project.width}x${project.height}`}
            onChange={(e) => {
              const [w, h] = e.target.value.split("x").map(Number);
              apply({ ...project, width: w, height: h });
            }}
          >
            <option value="1280x720">16:9 720p</option>
            <option value="720x1280">9:16 720p</option>
            <option value="1080x1080">1:1 1080</option>
          </select>
          <span className="spacer" />
          <button
            type="button"
            className="nle-btn danger"
            disabled={Boolean(live)}
            onClick={() => void deleteProject()}
          >
            Delete
          </button>
          <button
            type="button"
            className="nle-btn lime"
            disabled={Boolean(live) || project.clips.length === 0 || Boolean(blocked)}
            onClick={() => void exportProject()}
          >
            {live ? live.phase_label || "Rendering…" : "Export"}
          </button>
        </div>

        <div className="nle-mid">
          <aside className="nle-bin">
            <div className="nle-bin-tabs">
              {(["templates", "library", "audio", "uploads"] as BinTab[]).map((t) => (
                <button key={t} type="button" className={tab === t ? "on" : undefined} onClick={() => setTab(t)}>
                  {t === "templates" ? "Clips" : t === "uploads" ? "Stock" : t[0].toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <div className="nle-bin-list">
              {tab === "audio" && !binItems.length ? (
                <div className="nle-bin-empty">
                  <p>No music or effects yet. Generate them in Audio studio, then they appear here.</p>
                  <a className="nle-btn lime" href="/audio">
                    Open Audio studio
                  </a>
                  <p>Sound effects and Suno music. Drag onto A2 under narration, or upload an mp3 in Stock.</p>
                </div>
              ) : (
                binItems.map((item) => (
                  <div key={`${item.origin}-${item.id}`} className="nle-media-wrap">
                    <button
                      type="button"
                      className="nle-media"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(
                          "application/x-ms-media",
                          JSON.stringify({ origin: item.origin, id: item.id }),
                        );
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onDoubleClick={() => void dropMedia({ origin: item.origin, id: item.id }, "", project.playhead_sec)}
                    >
                      {item.kind === "video" ? (
                        <video src={item.preview_url} muted playsInline preload="metadata" poster={item.poster_url} />
                      ) : item.kind === "image" ? (
                        <img src={item.preview_url} alt="" />
                      ) : (
                        <div className="nle-media-audio">♪</div>
                      )}
                      <span>
                        {item.bin === "sfx" ? "SFX · " : item.bin === "music" ? "Music · " : item.bin === "voice" ? "Voice · " : ""}
                        {item.label}
                      </span>
                    </button>
                    {item.kind === "audio" ? (
                      <button
                        type="button"
                        className={`nle-media-audition${auditionId === `${item.origin}-${item.id}` ? " on" : ""}`}
                        aria-label={auditionId === `${item.origin}-${item.id}` ? "Stop preview" : "Preview audio"}
                        onClick={(e) => toggleAudition(item, e)}
                      >
                        {auditionId === `${item.origin}-${item.id}` ? "Stop" : "Play"}
                      </button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
            <div className="nle-bin-upload">
              {tab === "audio" ? (
                <a className="nle-btn" href="/audio" style={{ display: "block", textAlign: "center" }}>
                  Make music / effects
                </a>
              ) : (
                <label className="nle-btn" style={{ display: "block", textAlign: "center" }}>
                  Upload file
                  <input
                    type="file"
                    accept="video/*,audio/*,image/*"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadFile(f).catch((e: Error) => setError(e.message));
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
          </aside>

          <Preview
            project={project}
            playing={playing}
            onToggle={() => {
              stopAudition();
              setPlaying((v) => !v);
            }}
          />

          <aside className="nle-inspector">
            <p className="nle-kicker">Inspector</p>
            {selected ? (
              <>
                <h3 style={{ margin: "0 0 8px", fontSize: "1rem" }}>{selected.label}</h3>
                {selected.kind === "text" ? (
                  <>
                    <label>Text</label>
                    <SecurePrompt
                      kind="overlay"
                      value={selected.text ?? ""}
                      onChange={(next) => patchClip({ text: next, label: next.slice(0, 40) })}
                    />
                    <label>Size</label>
                    <input
                      type="number"
                      min={12}
                      max={160}
                      value={selected.font_size ?? 48}
                      onChange={(e) => patchClip({ font_size: Number(e.target.value) })}
                    />
                    <label>Color</label>
                    <input
                      type="color"
                      value={selected.color || "#ffffff"}
                      onChange={(e) => patchClip({ color: e.target.value })}
                    />
                  </>
                ) : (
                  <>
                    <label>Volume {Math.round(selected.volume * 100)}%</label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={selected.volume}
                      onChange={(e) => patchClip({ volume: Number(e.target.value) })}
                    />
                    {selected.kind !== "audio" && selected.volume <= 0 ? (
                      <p style={{ color: "#8b90a0", fontSize: "0.78rem" }}>
                        B-roll is silent so Narration on A1 can be heard. Raise this to mix camera sound.
                      </p>
                    ) : null}
                    <label>
                      <input
                        type="checkbox"
                        checked={selected.muted}
                        onChange={(e) => patchClip({ muted: e.target.checked })}
                      />{" "}
                      Mute
                    </label>
                  </>
                )}
                <p style={{ color: "#8b90a0", fontSize: "0.78rem" }}>
                  Using {footprintLabel(selected)} of {selected.duration.toFixed(1)}s
                  <button
                    type="button"
                    className="nle-btn ghost"
                    style={{ marginLeft: 8 }}
                    onClick={() =>
                      patchClip({ crop_start: 0, crop_end: selected.duration, start_sec: selected.start_sec })
                    }
                  >
                    Reset crop
                  </button>
                </p>
                <button
                  type="button"
                  className="nle-btn"
                  onClick={() => {
                    apply({ ...project, clips: project.clips.filter((c) => c.id !== selected.id) }, { history: true });
                    setSelectedId(null);
                  }}
                >
                  Delete clip
                </button>
              </>
            ) : (
              <p style={{ color: "#8b90a0" }}>
                Select a clip. Space plays. S splits at the playhead. Delete removes. Drag edges to trim.
                Same-track overlaps snap back. Narration is on A1. Open the Audio bin for music and effects,
                or upload an mp3 in Stock.
              </p>
            )}
            {blocked ? <p className="nle-notice">{blocked}</p> : null}
            {error ? <p className="nle-notice">{error}</p> : null}
            {live ? (
              <div className="nle-render">
                <strong>{live.phase_label || "Rendering…"}</strong>
                <button
                  type="button"
                  className="nle-btn"
                  style={{ marginTop: 8 }}
                  onClick={() => void api(`/api/studio/renders/${live.id}/cancel`, { method: "POST" })}
                >
                  Stop
                </button>
              </div>
            ) : null}
            {done ? (
              <div className="nle-render">
                <strong>Last export</strong>
                <video src={`/api/studio/renders/${done.id}/output`} controls playsInline />
                <a className="nle-btn" href={`/api/studio/renders/${done.id}/output?download=1`}>
                  Download mp4
                </a>
              </div>
            ) : null}
          </aside>
        </div>

        <div className="nle-dock">
          <div className="nle-transport">
            <button
              type="button"
              className={`nle-hit play${playing ? " on" : ""}`}
              onClick={() => {
                stopAudition();
                setPlaying((v) => !v);
              }}
            >
              {playing ? "Pause" : "Play"}
            </button>
            <button type="button" className="nle-hit split" onClick={() => void splitAtPlayhead()}>
              Split
            </button>
            <button type="button" className="nle-hit text" onClick={() => void addText().catch((e: Error) => setError(e.message))}>
              Text
            </button>
            <span className="nle-tc big">{formatTc(project.playhead_sec)}</span>
            <label className="nle-zoom">
              <span>Zoom</span>
              <input
                type="range"
                min={24}
                max={120}
                value={pps}
                onChange={(e) => setPps(Number(e.target.value))}
              />
            </label>
          </div>
          <Timeline
            project={project}
            selectedId={selectedId}
            pps={pps}
            onSelect={setSelectedId}
            onChange={apply}
            onPlayhead={setPlayhead}
            onDropMedia={(m, trackId, start) => void dropMedia(m, trackId, start)}
          />
        </div>
      </div>
    </div>
  );
}

function footprintLabel(clip: StudioClip) {
  return `${(clip.crop_end - clip.crop_start).toFixed(1)}s`;
}
