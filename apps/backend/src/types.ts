export type GenerationStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED";
export type AvatarProvider = "qwen" | "ai33pro" | "openrouter" | "openrouter-flux";
export type MeterProvider = AvatarProvider | "cpu" | "ai33pro";
export type AudioKind =
  | "tts"
  | "dialogue"
  | "clone"
  | "voice-change"
  | "dub"
  | "isolate"
  | "stt"
  | "sfx"
  | "music";

export type AudioJob = {
  id: string;
  owner_email?: string;
  artifacts?: Record<string, string>;
  created_at: string;
  updated_at: string;
  status: GenerationStatus;
  phase: JobPhase;
  phase_label: string;
  kind: AudioKind;
  provider: "ai33pro";
  title: string;
  input_mime: string | null;
  input_filename: string | null;
  output_mime: string | null;
  output_filename: string | null;
  has_srt: boolean;
  has_video: boolean;
  has_cover: boolean;
  has_alt: boolean;
  provider_job_id: string | null;
  error: string | null;
  duration_ms: number | null;
  estimated_usd: number | null;
  usd_per_hour_assumed: number | null;
  quoted_credits: number | null;
  credit_cost: number | null;
  credits_remaining: number | null;
  vendor_progress: number | null;
  vendor_type: string | null;
  params: Record<string, unknown>;
  provider_meta: Record<string, unknown>;
  transcript: string | null;
};
export type SwapPhase =
  | "queued"
  | "checking_runpod"
  | "uploading"
  | "waking_runpod"
  | "swapping"
  | "done"
  | "failed"
  | "cancelled";
export type JobPhase =
  | "queued"
  | "checking_runpod"
  | "waking_runpod"
  | "loading_model"
  | "generating"
  | "quoting"
  | "done"
  | "failed"
  | "cancelled";

export type AvatarJob = {
  id: string;
  owner_email?: string;
  artifacts?: Record<string, string>;
  created_at: string;
  updated_at: string;
  status: GenerationStatus;
  phase: JobPhase;
  phase_label: string;
  suggest_provider: AvatarProvider | null;
  provider: AvatarProvider;
  name: string;
  prompt: string;
  input_mime: string;
  input_filename: string;
  output_mime: string | null;
  provider_job_id: string | null;
  error: string | null;
  duration_ms: number | null;
  estimated_usd: number | null;
  usd_per_hour_assumed: number | null;
  quoted_credits: number | null;
  credit_cost: number | null;
  credits_remaining: number | null;
  provider_meta: Record<string, unknown>;
  input_bytes?: number | null;
};

export type SavedAvatar = {
  id: string;
  owner_email?: string;
  artifacts?: Record<string, string>;
  name: string;
  job_id: string;
  created_at: string;
  mime: string;
  image_url: string;
};

export type SwapKind = "image" | "video";

export type SwapJob = {
  id: string;
  owner_email?: string;
  artifacts?: Record<string, string>;
  created_at: string;
  updated_at: string;
  status: GenerationStatus;
  phase: SwapPhase;
  phase_label: string;
  kind: SwapKind;
  template_id: string;
  template_r2_key: string;
  face_r2_key: string;
  output_r2_key: string | null;
  face_mime: string;
  face_filename: string;
  output_mime: string | null;
  provider_job_id: string | null;
  error: string | null;
  duration_ms: number | null;
  estimated_usd: number | null;
  usd_per_hour_assumed: number | null;
  provider_meta: Record<string, unknown>;
};

export type CostLedgerRow = {
  at: string;
  job_id: string;
  provider: MeterProvider;
  status: GenerationStatus;
  duration_ms: number | null;
  estimated_usd: number | null;
  usd_per_hour_assumed: number | null;
  quoted_credits: number | null;
  credit_cost: number | null;
  credits_remaining: number | null;
  error: string | null;
};
