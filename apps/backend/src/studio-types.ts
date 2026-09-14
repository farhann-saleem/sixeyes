import type { GenerationStatus } from "./types.js";

export type StudioClipKind = "video" | "image" | "audio" | "text";
export type StudioTrackKind = "video" | "audio" | "text";

export type StudioClipSource =
  | { type: "video-template"; id: string }
  | { type: "image-template"; id: string }
  | { type: "library"; id: string }
  | { type: "audio"; id: string }
  | { type: "upload"; id: string }
  | { type: "text" };

export type StudioClip = {
  id: string;
  track_id: string;
  kind: StudioClipKind;
  source: StudioClipSource;
  label: string;
  /** Timeline position in seconds. */
  start_sec: number;
  /** Source length in seconds (image/text default 5). */
  duration: number;
  crop_start: number;
  crop_end: number;
  volume: number;
  muted: boolean;
  text?: string;
  font_size?: number;
  color?: string;
  /** 0–1, text / overlay position. */
  x?: number;
  y?: number;
  preview_url?: string;
};

export type StudioTrack = {
  id: string;
  kind: StudioTrackKind;
  name: string;
  /** Higher video order wins during overlap (spec 09). */
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

export type StudioUpload = {
  id: string;
  project_id: string | null;
  filename: string;
  mime: string;
  bytes: number;
  kind: "video" | "image" | "audio";
  duration_s: number | null;
  r2_key: string;
  created_at: string;
};

export type StudioRenderJob = {
  id: string;
  project_id: string;
  created_at: string;
  updated_at: string;
  status: GenerationStatus;
  phase: string;
  phase_label: string;
  provider: "cpu";
  clip_keys: string[];
  audio_key: string | null;
  output_r2_key: string | null;
  output_mime: string | null;
  provider_job_id: string | null;
  error: string | null;
  duration_ms: number | null;
  estimated_usd: number | null;
  usd_per_hour_assumed: number | null;
  provider_meta: Record<string, unknown>;
};

export type VisualSlice = {
  start: number;
  end: number;
  clip: StudioClip | null;
  texts: StudioClip[];
};

export type AudioBed = {
  clip: StudioClip;
  delay_sec: number;
  trim_start: number;
  duration: number;
  volume: number;
};
