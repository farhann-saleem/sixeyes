import { useEffect, useRef, useState } from "react";
import { textsAt, topVisualAt, type StudioClip, type StudioProject } from "./model";

function footprint(clip: StudioClip) {
  return Math.max(0.05, clip.crop_end - clip.crop_start);
}

function inRange(clip: StudioClip, t: number) {
  return clip.start_sec <= t && t < clip.start_sec + footprint(clip);
}

export function Preview({
  project,
  playing,
  onToggle,
}: {
  project: StudioProject;
  playing: boolean;
  onToggle: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioEls = useRef<Map<string, HTMLAudioElement>>(new Map());
  const lastJump = useRef(project.playhead_sec);
  const playingWas = useRef(false);
  const [mixError, setMixError] = useState("");
  const clip = topVisualAt(project, project.playhead_sec);
  const texts = textsAt(project, project.playhead_sec);
  const portrait = project.height > project.width;
  const mutePicture = !clip || clip.muted || clip.volume <= 0;

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !clip || clip.kind !== "video" || !clip.preview_url) return;
    el.muted = mutePicture;
    el.volume = mutePicture ? 0 : Math.min(1, Math.max(0, clip.volume));
    const want = clip.crop_start + (project.playhead_sec - clip.start_sec);
    if (!playing || Math.abs(el.currentTime - want) > 0.45) {
      try {
        el.currentTime = Math.max(0, want);
      } catch {
        /* seek may throw before metadata */
      }
    }
    if (playing) void el.play().catch(() => undefined);
    else el.pause();
  }, [clip?.id, clip?.preview_url, clip?.kind, clip?.volume, mutePicture, project.playhead_sec, playing, clip]);

  useEffect(() => {
    const jumped = Math.abs(project.playhead_sec - lastJump.current) > 0.45;
    const started = playing && !playingWas.current;
    lastJump.current = project.playhead_sec;
    playingWas.current = playing;
    const wanted = project.clips.filter((c) => {
      if (c.kind !== "audio" || !c.preview_url || c.muted || c.volume <= 0) return false;
      const track = project.tracks.find((t) => t.id === c.track_id);
      if (!track || track.muted) return false;
      return inRange(c, project.playhead_sec);
    });
    const map = audioEls.current;
    for (const [id, el] of map) {
      if (!wanted.some((c) => c.id === id)) el.pause();
    }
    for (const c of wanted) {
      const src = c.preview_url;
      if (!src) continue;
      let el = map.get(c.id);
      if (!el) {
        el = new Audio(src);
        el.preload = "auto";
        map.set(c.id, el);
      } else if (!el.src.includes(src.replace(/^\//, ""))) {
        el.src = src;
      }
      el.volume = Math.min(1, Math.max(0, c.volume));
      el.muted = false;
      const want = c.crop_start + (project.playhead_sec - c.start_sec);
      const shouldSeek =
        !playing || started || jumped || (!el.paused && Math.abs(el.currentTime - want) > 0.5);
      if (shouldSeek) {
        try {
          el.currentTime = Math.max(0, want);
        } catch {
          /* ignore */
        }
      }
      if (playing) {
        void el.play().catch((err: unknown) => {
          setMixError(err instanceof Error ? err.message : "Audio playback was blocked");
        });
      } else {
        el.pause();
      }
    }
    if (!wanted.length) setMixError("");
  }, [playing, project.playhead_sec, project.clips, project.tracks]);

  useEffect(
    () => () => {
      for (const el of audioEls.current.values()) {
        el.pause();
        el.src = "";
      }
      audioEls.current.clear();
    },
    [],
  );

  return (
    <div className="nle-monitor">
      <div className={`nle-stage${portrait ? " portrait" : ""}`}>
        {clip?.kind === "video" && clip.preview_url ? (
          <video key={clip.id} ref={videoRef} src={clip.preview_url} muted={mutePicture} playsInline />
        ) : clip?.kind === "image" && clip.preview_url ? (
          <img src={clip.preview_url} alt={clip.label} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "#000" }} />
        )}
        {texts.map((t) => (
          <div
            key={t.id}
            className="nle-overlay"
            style={{
              left: `${(t.x ?? 0.5) * 100}%`,
              top: `${(t.y ?? 0.82) * 100}%`,
              fontSize: t.font_size ?? 28,
              color: t.color || "#fff",
            }}
          >
            {t.text}
          </div>
        ))}
        {mixError ? <p className="nle-mix-error">{mixError}</p> : null}
        <button type="button" className="nle-stage-play" onClick={onToggle} aria-label={playing ? "Pause" : "Play"}>
          {playing ? "❚❚" : "▶"}
        </button>
      </div>
    </div>
  );
}
