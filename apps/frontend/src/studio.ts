export type TemplateKind = "image" | "video";

export type Template = {
  id: string;
  kind?: TemplateKind;
  catalog?: "video" | "effect";
  effect?: string;
  label: string;
  filename: string;
  bytes: number;
  image_url?: string;
  video_url?: string;
  poster_url?: string;
  duration_s?: number | null;
  r2_key: string;
};

export type SwapStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED";

export type SwapJob = {
  id: string;
  status: SwapStatus;
  phase?: string;
  phase_label?: string;
  kind?: TemplateKind;
  template_id: string;
  created_at: string;
  duration_ms: number | null;
  estimated_usd: number | null;
  error: string | null;
  provider_job_id?: string | null;
};

export type SavedAvatar = {
  id: string;
  name: string;
  job_id: string;
  created_at: string;
  mime: string;
  image_url: string;
};

export type Catalog = {
  templates: Template[];
  r2?: { uploaded?: string[]; skipped?: string[]; error?: string | null };
  cpu?: {
    blocked?: string | null;
    health?: { workers?: { ready?: number; idle?: number; throttled?: number; initializing?: number } };
  };
};

export async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(body.error || res.statusText);
  return body;
}

export function isLive(job: SwapJob | undefined | null): job is SwapJob {
  return job?.status === "IN_PROGRESS" || job?.status === "PENDING";
}

export function isVideoJob(job: SwapJob | undefined | null) {
  return job?.kind === "video";
}

export function isVideoTemplate(t: Template | null | undefined) {
  return t?.kind === "video" || Boolean(t?.video_url);
}

export function formatClip(seconds?: number | null) {
  if (seconds == null || !Number.isFinite(seconds)) return "";
  const s = Math.round(seconds);
  return s < 60 ? `${s}s clip` : `${Math.floor(s / 60)}m ${s % 60}s clip`;
}

export function outputUrl(job: SwapJob) {
  return `/api/faceswaps/${job.id}/output`;
}

export function downloadUrl(job: SwapJob) {
  return `/api/faceswaps/${job.id}/output?download=1`;
}

/** Progress steps the CPU worker actually walks through, in order. */
export const SWAP_STEPS = [
  { phase: "checking_runpod", label: "Checking worker" },
  { phase: "uploading", label: "Uploading" },
    { phase: "waking_runpod", label: "Starting generate" },
    { phase: "swapping", label: "Generating" },
] as const;

export function stepIndex(phase?: string) {
  const i = SWAP_STEPS.findIndex((s) => s.phase === phase);
  return i < 0 ? 0 : i;
}

export function secondsBetween(fromIso: string, now: number) {
  return Math.max(0, Math.floor((now - Date.parse(fromIso)) / 1000));
}

export function formatElapsed(fromIso: string, now: number) {
  const s = secondsBetween(fromIso, now);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

export function formatDuration(ms: number | null) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

export function formatAgo(iso: string, now: number) {
  const s = secondsBetween(iso, now);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function formatClock(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
