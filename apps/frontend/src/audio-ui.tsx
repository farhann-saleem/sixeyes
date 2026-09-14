import { useEffect, useState } from "react";

type PreviewInfo = {
  id: string | null;
  title: string;
  cover: string | null;
  progress: number;
  duration: number;
};

let sharedAudio: HTMLAudioElement | null = null;
let preview: PreviewInfo = { id: null, title: "", cover: null, progress: 0, duration: 0 };
const listeners = new Set<(info: PreviewInfo) => void>();

function emit() {
  listeners.forEach((fn) => fn({ ...preview }));
}

export function coverTone(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 33 + seed.charCodeAt(i)) >>> 0;
  const a = h % 360;
  const b = (a + 48 + (h % 40)) % 360;
  return `linear-gradient(145deg, hsl(${a} 38% 32%) 0%, hsl(${b} 46% 14%) 100%)`;
}

export function togglePreview(id: string, url: string, meta?: { title?: string; cover?: string | null }) {
  if (!url) return;
  if (sharedAudio && sharedAudio.dataset.voiceId === id && !sharedAudio.paused) {
    sharedAudio.pause();
    preview = { id: null, title: "", cover: null, progress: 0, duration: 0 };
    emit();
    return;
  }
  sharedAudio?.pause();
  const audio = new Audio(url);
  audio.dataset.voiceId = id;
  sharedAudio = audio;
  preview = {
    id,
    title: meta?.title || id,
    cover: meta?.cover || null,
    progress: 0,
    duration: 0,
  };
  emit();
  audio.ontimeupdate = () => {
    if (sharedAudio !== audio) return;
    preview = {
      ...preview,
      progress: audio.duration ? audio.currentTime / audio.duration : 0,
      duration: Number.isFinite(audio.duration) ? audio.duration : 0,
    };
    emit();
  };
  audio.onended = () => {
    if (sharedAudio !== audio) return;
    preview = { id: null, title: "", cover: null, progress: 0, duration: 0 };
    emit();
  };
  audio.play().catch(() => {
    preview = { id: null, title: "", cover: null, progress: 0, duration: 0 };
    emit();
  });
}

export function seekPreview(ratio: number) {
  if (!sharedAudio || !sharedAudio.duration) return;
  sharedAudio.currentTime = Math.min(1, Math.max(0, ratio)) * sharedAudio.duration;
}

export function usePreview() {
  const [info, setInfo] = useState<PreviewInfo>(preview);
  useEffect(() => {
    listeners.add(setInfo);
    return () => {
      listeners.delete(setInfo);
    };
  }, []);
  return info;
}

export function usePlayingId() {
  return usePreview().id;
}

function formatClock(seconds: number) {
  if (!seconds || !Number.isFinite(seconds)) return "0:00";
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function WaveBars({ active }: { active: boolean }) {
  return (
    <span className={active ? "wave-bars on" : "wave-bars"} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

export function CoverArt({
  src,
  seed,
  playing,
  onPlay,
  label,
  size = "sm",
}: {
  src?: string | null;
  seed: string;
  playing?: boolean;
  onPlay?: () => void;
  label: string;
  size?: "sm" | "lg";
}) {
  return (
    <button
      type="button"
      className={`cover-art ${size}${playing ? " playing" : ""}`}
      style={src ? undefined : { background: coverTone(seed) }}
      onClick={(e) => {
        e.stopPropagation();
        onPlay?.();
      }}
      disabled={!onPlay}
      aria-label={playing ? `Stop ${label}` : `Preview ${label}`}
    >
      {src ? <img src={src} alt="" /> : <span className="cover-glyph">{seed.slice(0, 1).toUpperCase()}</span>}
      {onPlay ? (
        <span className="cover-play">
          {playing ? <WaveBars active /> : <span className="play-tri" />}
        </span>
      ) : null}
    </button>
  );
}

export function NowPlayingBar() {
  const info = usePreview();
  if (!info.id) return null;
  return (
    <div className="now-playing" role="status">
      <span className="now-playing-cover" style={info.cover ? undefined : { background: coverTone(info.title) }}>
        {info.cover ? <img src={info.cover} alt="" /> : null}
      </span>
      <strong>{info.title}</strong>
      <button
        type="button"
        className="now-playing-seek"
        aria-label="Seek preview"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          seekPreview((e.clientX - rect.left) / rect.width);
        }}
      >
        <span style={{ width: `${Math.round(info.progress * 100)}%` }} />
      </button>
      <span className="now-playing-time">
        {formatClock(info.progress * info.duration)} / {formatClock(info.duration)}
      </span>
    </div>
  );
}
