import { useEffect, useRef, useState } from "react";
import { textsAt, topVisualAt, type StudioClip, type StudioProject } from "./model";

function footprint(clip: StudioClip) {
  return Math.max(0.05, clip.crop_end - clip.crop_start);
}

function inRange(clip: StudioClip, t: number) {
  return clip.start_sec <= t && t < clip.start_sec + footprint(clip);
}

function absMediaUrl(src: string) {
  if (/^https?:\/\//i.test(src)) return src;
  if (typeof window === "undefined") return src;
  return new URL(src, window.location.origin).href;
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
  const videoA = useRef<HTMLVideoElement>(null);
  const videoB = useRef<HTMLVideoElement>(null);
  const activeSlot = useRef<0 | 1>(0);
  const shownClipId = useRef<string | null>(null);
  const audioEls = useRef<Map<string, HTMLAudioElement>>(new Map());
  const lastJump = useRef(project.playhead_sec);
  const playingWas = useRef(false);
  const [mixError, setMixError] = useState("");
  const [front, setFront] = useState<0 | 1>(0);
  const clip = topVisualAt(project, project.playhead_sec);
  const texts = textsAt(project, project.playhead_sec);
  const portrait = project.height > project.width;
  const mutePicture = !clip || clip.muted || clip.volume <= 0;
  const hasVideoTimeline = project.clips.some((c) => c.kind === "video" && c.preview_url);
  const showImage = clip?.kind === "image" && Boolean(clip.preview_url);
  const showVideo = Boolean(clip?.kind === "video" && clip.preview_url) || (hasVideoTimeline && !showImage);

  // Dual-buffer video: swap sources without remounting so cuts don't flash black.
  useEffect(() => {
    if (!clip || clip.kind !== "video" || !clip.preview_url) return;
    const want = clip.crop_start + (project.playhead_sec - clip.start_sec);
    const src = absMediaUrl(clip.preview_url);
    const sameClip = shownClipId.current === clip.id;
    const current = activeSlot.current === 0 ? videoA.current : videoB.current;
    const other = activeSlot.current === 0 ? videoB.current : videoA.current;
    if (!current || !other) return;

    const applyMute = (el: HTMLVideoElement) => {
      el.muted = mutePicture;
      el.volume = mutePicture ? 0 : Math.min(1, Math.max(0, clip.volume));
    };

    if (sameClip) {
      applyMute(current);
      if (!playing || Math.abs(current.currentTime - want) > 0.45) {
        try {
          current.currentTime = Math.max(0, want);
        } catch {
          /* seek may throw before metadata */
        }
      }
      if (playing) void current.play().catch(() => undefined);
      else current.pause();
      return;
    }

    const nextSlot: 0 | 1 = activeSlot.current === 0 ? 1 : 0;
    const nextEl = nextSlot === 0 ? videoA.current! : videoB.current!;
    applyMute(nextEl);

    const reveal = () => {
      shownClipId.current = clip.id;
      activeSlot.current = nextSlot;
      setFront(nextSlot);
      current.pause();
      if (playing) void nextEl.play().catch(() => undefined);
      else nextEl.pause();
    };

    const seekThenReveal = () => {
      const finish = () => {
        nextEl.removeEventListener("seeked", finish);
        reveal();
      };
      try {
        if (Math.abs(nextEl.currentTime - want) > 0.05) {
          nextEl.addEventListener("seeked", finish);
          nextEl.currentTime = Math.max(0, want);
          // If seek is sync / already there, still reveal after a tick.
          if (nextEl.readyState >= 2 && Math.abs(nextEl.currentTime - want) <= 0.12) {
            nextEl.removeEventListener("seeked", finish);
            reveal();
          }
        } else {
          reveal();
        }
      } catch {
        reveal();
      }
    };

    if (absMediaUrl(nextEl.currentSrc || nextEl.src) !== src) {
      const onData = () => {
        nextEl.removeEventListener("loadeddata", onData);
        seekThenReveal();
      };
      nextEl.src = src;
      nextEl.load();
      nextEl.addEventListener("loadeddata", onData);
    } else {
      seekThenReveal();
    }
  }, [
    clip?.id,
    clip?.preview_url,
    clip?.kind,
    clip?.volume,
    clip?.crop_start,
    clip?.start_sec,
    mutePicture,
    project.playhead_sec,
    playing,
  ]);

  // Preload the upcoming visual clip into the idle buffer.
  useEffect(() => {
    if (!playing || !clip || clip.kind !== "video") return;
    const end = clip.start_sec + footprint(clip);
    const upcoming = project.clips
      .filter((c) => c.kind === "video" && c.preview_url && c.start_sec >= end - 0.05 && c.id !== clip.id)
      .sort((a, b) => a.start_sec - b.start_sec)[0];
    if (!upcoming?.preview_url) return;
    const idle = activeSlot.current === 0 ? videoB.current : videoA.current;
    if (!idle) return;
    const src = absMediaUrl(upcoming.preview_url);
    if (absMediaUrl(idle.currentSrc || idle.src) === src) return;
    idle.muted = true;
    idle.preload = "auto";
    idle.src = src;
    idle.load();
  }, [playing, clip?.id, clip?.kind, clip?.start_sec, clip?.crop_start, clip?.crop_end, project.clips]);

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
        {showVideo ? (
          <>
            <video
              ref={videoA}
              className={`nle-stage-video${front === 0 ? " is-front" : ""}`}
              playsInline
              muted={mutePicture}
              preload="auto"
            />
            <video
              ref={videoB}
              className={`nle-stage-video${front === 1 ? " is-front" : ""}`}
              playsInline
              muted
              preload="auto"
            />
          </>
        ) : showImage ? (
          <img src={clip!.preview_url!} alt={clip!.label} />
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
