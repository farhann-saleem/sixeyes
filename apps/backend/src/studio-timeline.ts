import type { AudioBed, StudioClip, StudioProject, StudioTrack, VisualSlice } from "./studio-types.js";

export function footprint(clip: StudioClip): number {
  const start = Number.isFinite(clip.crop_start) ? clip.crop_start : 0;
  const end = Number.isFinite(clip.crop_end) ? clip.crop_end : clip.duration;
  return Math.max(0.05, end - start);
}

export function clipEnd(clip: StudioClip): number {
  return clip.start_sec + footprint(clip);
}

export function inPointAt(clip: StudioClip, timelineSec: number): number {
  return clip.crop_start + (timelineSec - clip.start_sec);
}

export function projectDuration(project: StudioProject): number {
  const ends = project.clips.map(clipEnd);
  return Math.max(1, ...ends, 1);
}

export function trackById(project: StudioProject, id: string): StudioTrack | undefined {
  return project.tracks.find((t) => t.id === id);
}

export function clipsOnTrack(project: StudioProject, trackId: string): StudioClip[] {
  return project.clips.filter((c) => c.track_id === trackId);
}

export function overlaps(a: StudioClip, b: StudioClip): boolean {
  return a.start_sec < clipEnd(b) - 1e-6 && b.start_sec < clipEnd(a) - 1e-6;
}

export function sameTrackCollision(
  project: StudioProject,
  clip: Pick<StudioClip, "id" | "track_id" | "start_sec" | "crop_start" | "crop_end" | "duration">,
): StudioClip | null {
  const candidate = clip as StudioClip;
  for (const other of clipsOnTrack(project, clip.track_id)) {
    if (other.id === clip.id) continue;
    if (overlaps(candidate, other)) return other;
  }
  return null;
}

export function validateProject(project: StudioProject): string | null {
  if (!Array.isArray(project.tracks) || !Array.isArray(project.clips)) return "tracks and clips required";
  if (project.tracks.some(t => !t || typeof t !== "object" || typeof t.id !== "string" || !["video", "audio", "text"].includes(t.kind))) return "invalid track";
  if (project.clips.some(c => !c || typeof c !== "object")) return "invalid clip";
  if (project.topic && projectDuration(project) > 90.001) return "Project duration exceeds 90 seconds";
  if (![project.width, project.height].every((n) => Number.isInteger(n) && n >= 2 && n <= 3840)) return "canvas must be 2–3840 pixels";
  if (new Set(project.tracks.map(t => t.id)).size !== project.tracks.length || new Set(project.clips.map(c => c.id)).size !== project.clips.length) return "duplicate track or clip id";
  if (!project.tracks.length) return "project has no tracks";
  if (project.width % 2 || project.height % 2) return "width and height must be even";
  if (!(project.fps >= 1 && project.fps <= 60)) return "fps must be 1–60";
  for (const clip of project.clips) {
    if (!clip || typeof clip !== "object") return "invalid clip";
    if (!clip.source || !["video-template", "image-template", "library", "audio", "upload", "text"].includes(clip.source.type)) return "invalid source";
    if (![clip.start_sec, clip.duration, clip.crop_start, clip.crop_end, clip.volume].every(Number.isFinite) || clip.start_sec < 0 || clip.volume < 0 || clip.volume > 1 || clip.crop_end > clip.duration + 0.001) return "invalid clip timing or volume";
    if (!trackById(project, clip.track_id)) return `clip ${clip.id} references missing track`;
    if (clip.crop_start < -1e-6 || clip.crop_end - clip.crop_start < 0.049) {
      return `clip ${clip.id} has an invalid crop`;
    }
    const track = trackById(project, clip.track_id)!;
    if (!["video", "image", "audio", "text"].includes(clip.kind) || track.kind !== (clip.kind === "image" ? "video" : clip.kind)) return "clip kind does not match track";
    if (clip.kind === "text" && (typeof clip.text !== "string" || clip.text.length > 2000 || !/^#[0-9a-fA-F]{6}$/.test(clip.color || "#ffffff") || ![clip.x ?? .5, clip.y ?? .82].every(n => Number.isFinite(n) && n >= 0 && n <= 1) || !Number.isFinite(clip.font_size ?? 48) || (clip.font_size ?? 48) < 8 || (clip.font_size ?? 48) > 300)) return "invalid text style";
    const hit = sameTrackCollision(project, clip);
    if (hit) return `same-track overlap: ${clip.id} vs ${hit.id}`;
  }
  return null;
}

function coveringAt(clips: StudioClip[], t: number): StudioClip[] {
  return clips.filter((c) => c.start_sec <= t + 1e-6 && clipEnd(c) > t + 1e-6);
}

function textKey(texts: StudioClip[]): string {
  return texts
    .map((c) => `${c.id}:${c.text ?? ""}:${c.x ?? 0.5}:${c.y ?? 0.82}:${c.font_size ?? 48}:${c.color ?? "#fff"}`)
    .sort()
    .join("|");
}

/** Higher video track replaces lower during overlap. Text overlays are collected, not replacing. Gaps = black. */
export function visualSlices(project: StudioProject): VisualSlice[] {
  const videoClips = project.clips.filter((c) => {
    if (c.kind !== "video" && c.kind !== "image") return false;
    const track = trackById(project, c.track_id);
    return Boolean(track && track.kind === "video" && !track.muted && !c.muted);
  });
  const textClips = project.clips.filter((c) => {
    if (c.kind !== "text") return false;
    const track = trackById(project, c.track_id);
    return Boolean(track && !track.muted && !c.muted && (c.text || "").trim());
  });

  const duration = projectDuration(project);
  const edges = new Set<number>([0, duration]);
  for (const clip of [...videoClips, ...textClips]) {
    edges.add(roundTime(clip.start_sec));
    edges.add(roundTime(clipEnd(clip)));
  }
  const times = [...edges].filter((t) => t >= -1e-6 && t <= duration + 1e-6).sort((a, b) => a - b);

  const raw: VisualSlice[] = [];
  for (let i = 0; i < times.length - 1; i++) {
    const start = times[i];
    const end = times[i + 1];
    if (end - start < 0.04) continue;
    const mid = (start + end) / 2;
    const covering = coveringAt(videoClips, mid);
    covering.sort((a, b) => {
      const oa = trackById(project, a.track_id)?.order ?? 0;
      const ob = trackById(project, b.track_id)?.order ?? 0;
      return ob - oa;
    });
    raw.push({
      start,
      end,
      clip: covering[0] ?? null,
      texts: coveringAt(textClips, mid),
    });
  }
  return mergeSlices(raw);
}

function roundTime(n: number) {
  return Math.round(n * 1000) / 1000;
}

function sourceInPoint(slice: VisualSlice): number {
  if (!slice.clip) return 0;
  return inPointAt(slice.clip, slice.start);
}

function mergeSlices(slices: VisualSlice[]): VisualSlice[] {
  const out: VisualSlice[] = [];
  for (const slice of slices) {
    const last = out[out.length - 1];
    if (
      last &&
      last.clip?.id === slice.clip?.id &&
      Math.abs(last.end - slice.start) < 1e-3 &&
      textKey(last.texts) === textKey(slice.texts) &&
      Math.abs(sourceInPoint(last) + (last.end - last.start) - sourceInPoint(slice)) < 0.04
    ) {
      last.end = slice.end;
    } else {
      out.push({ ...slice, texts: [...slice.texts] });
    }
  }
  return out;
}

export function audioBeds(project: StudioProject): AudioBed[] {
  const beds: AudioBed[] = [];
  for (const clip of project.clips) {
    const track = trackById(project, clip.track_id);
    if (!track || track.muted || clip.muted) continue;
    if (clip.volume <= 0.001) continue;
    const isAudio = clip.kind === "audio";
    const isVideoSound = clip.kind === "video";
    if (!isAudio && !isVideoSound) continue;
    beds.push({
      clip,
      delay_sec: Math.max(0, clip.start_sec),
      trim_start: clip.crop_start,
      duration: footprint(clip),
      volume: clip.volume,
    });
  }
  return beds;
}

export function emptyProject(id: string, name = "Untitled"): StudioProject {
  const now = new Date().toISOString();
  return {
    id,
    name,
    topic: "", target_duration_sec: 60, phase: "studio", status: "ready", script: null, tts_job_id: null, error: null,
    created_at: now,
    updated_at: now,
    width: 1280,
    height: 720,
    fps: 30,
    playhead_sec: 0,
    tracks: [
      { id: "v2", kind: "video", name: "V2", order: 2, muted: false, locked: false },
      { id: "v1", kind: "video", name: "V1", order: 1, muted: false, locked: false },
      { id: "t1", kind: "text", name: "Text", order: 3, muted: false, locked: false },
      { id: "a1", kind: "audio", name: "A1", order: 1, muted: false, locked: false },
      { id: "a2", kind: "audio", name: "A2", order: 2, muted: false, locked: false },
    ],
    clips: [],
    in_library: false,
  };
}
