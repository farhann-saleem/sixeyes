export type ClipKind = "video" | "image" | "audio" | "text";
export type TrackKind = "video" | "audio" | "text";

export type ClipSource =
  | { type: "video-template"; id: string }
  | { type: "image-template"; id: string }
  | { type: "library"; id: string }
  | { type: "audio"; id: string }
  | { type: "upload"; id: string }
  | { type: "text" };

export type StudioClip = {
  id: string;
  track_id: string;
  kind: ClipKind;
  source: ClipSource;
  label: string;
  start_sec: number;
  duration: number;
  crop_start: number;
  crop_end: number;
  volume: number;
  muted: boolean;
  text?: string;
  font_size?: number;
  color?: string;
  x?: number;
  y?: number;
  preview_url?: string;
};

export type StudioTrack = {
  id: string;
  kind: TrackKind;
  name: string;
  order: number;
  muted: boolean;
  locked: boolean;
};

export type StockCandidate = {
  upload_id: string; kind: "video" | "image"; label: string; preview_url: string;
  duration_s: number | null; pexels_id: number; photographer: string;
  license_url: string; pexels_url: string;
};
export type ProjectScene = {
  id: string; index: number; heading: string; voiceover_line: string; stock_query: string;
  duration_sec: number; status: "pending" | "fetched" | "picked" | "skipped" | "failed";
  picked_upload_id: string | null; candidates: StockCandidate[]; error?: string | null;
};
export type ProjectScript = { title: string; voiceover_full: string; scenes: ProjectScene[] };

export type StudioProject = {
  id: string;
  name: string;
  topic: string;
  target_duration_sec?: 30 | 45 | 60 | 90;
  phase: "topic" | "script" | "cast" | "studio" | "exported";
  status: "draft" | "running" | "ready" | "failed" | "cancelled";
  script: ProjectScript | null;
  tts_job_id: string | null;
  error: string | null;
  operation?: "script" | "stock" | "assemble" | null;
  operation_id?: string | null;
  voice_id?: string | null;
  script_cost_usd?: number | null;
  created_at: string;
  updated_at: string;
  width: number;
  height: number;
  fps: number;
  playhead_sec: number;
  tracks: StudioTrack[];
  clips: StudioClip[];
  in_library?: boolean;
};

export type MediaItem = {
  id: string;
  origin: ClipSource["type"];
  kind: "video" | "image" | "audio";
  label: string;
  duration_s: number | null;
  preview_url: string;
  poster_url?: string;
  bin?: "sfx" | "music" | "voice";
};

export type StudioRender = {
  id: string;
  project_id: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED";
  phase_label?: string;
  error: string | null;
  duration_ms: number | null;
  created_at: string;
};

export function footprint(clip: StudioClip) {
  return Math.max(0.05, clip.crop_end - clip.crop_start);
}

export function clipEnd(clip: StudioClip) {
  return clip.start_sec + footprint(clip);
}

export function projectDuration(project: StudioProject) {
  return Math.max(8, ...project.clips.map(clipEnd), 8);
}

export function overlaps(a: StudioClip, b: StudioClip) {
  return a.start_sec < clipEnd(b) - 1e-6 && b.start_sec < clipEnd(a) - 1e-6;
}

export function collision(project: StudioProject, clip: StudioClip): StudioClip | null {
  for (const other of project.clips) {
    if (other.id === clip.id || other.track_id !== clip.track_id) continue;
    if (overlaps(clip, other)) return other;
  }
  return null;
}

export function topVisualAt(project: StudioProject, t: number): StudioClip | null {
  const covering = project.clips.filter((c) => {
    if (c.kind !== "video" && c.kind !== "image") return false;
    const track = project.tracks.find((tr) => tr.id === c.track_id);
    if (!track || track.kind !== "video" || track.muted || c.muted) return false;
    return c.start_sec <= t + 1e-6 && clipEnd(c) > t + 1e-6;
  });
  covering.sort((a, b) => {
    const oa = project.tracks.find((t) => t.id === a.track_id)?.order ?? 0;
    const ob = project.tracks.find((t) => t.id === b.track_id)?.order ?? 0;
    return ob - oa;
  });
  return covering[0] ?? null;
}

export function textsAt(project: StudioProject, t: number): StudioClip[] {
  return project.clips.filter((c) => {
    if (c.kind !== "text" || c.muted || !(c.text || "").trim()) return false;
    const track = project.tracks.find((tr) => tr.id === c.track_id);
    if (!track || track.muted) return false;
    return c.start_sec <= t + 1e-6 && clipEnd(c) > t + 1e-6;
  });
}

export function audiosAt(project: StudioProject, t: number): StudioClip[] {
  return project.clips.filter((c) => {
    if ((c.kind !== "audio" && c.kind !== "video") || c.muted || c.volume <= 0) return false;
    const track = project.tracks.find((tr) => tr.id === c.track_id);
    if (!track || track.muted) return false;
    if (c.kind === "video" && track.kind !== "video") return false;
    if (c.kind === "audio" && track.kind !== "audio") return false;
    return c.start_sec <= t + 1e-6 && clipEnd(c) > t + 1e-6;
  });
}

export function formatTc(sec: number) {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${String(m).padStart(2, "0")}:${r.toFixed(2).padStart(5, "0")}`;
}

export function snapTime(sec: number, playhead: number, pps: number) {
  const px = 8 / pps;
  if (Math.abs(sec - playhead) <= px) return Math.max(0, playhead);
  return Math.max(0, Math.round(sec * 10) / 10);
}

export { apiJson as api } from "../api";
