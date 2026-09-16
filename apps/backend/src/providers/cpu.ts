import type { CloudTimeline } from "../studio-cloud-plan.js";
import { RUNPOD_API_KEY, RUNPOD_CPU_ENDPOINT_ID } from "../env.js";
import type { RunpodHealth } from "./qwen.js";

const BASE = `https://api.runpod.ai/v2/${RUNPOD_CPU_ENDPOINT_ID}`;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export type CpuOutput = {
  ok?: boolean;
  timeline_version?: number;
  ffmpeg?: boolean;
  error?: string;
  output_key?: string;
  duration_ms?: number;
  estimated_usd?: number;
  usd_per_hour_assumed?: number;
  facefusion_ready?: boolean;
  allow_generate?: boolean;
  volume_mounted?: boolean;
  free_gb?: number | null;
  worker?: string;
  worker_id?: string;
  build?: string;
  init_error?: string | null;
  op?: string;
};

export type CpuPoll = {
  status: string;
  output?: CpuOutput | CpuOutput[] | string;
  error?: string;
};

export async function cpuHealth(): Promise<RunpodHealth> {
  if (!RUNPOD_API_KEY) throw new Error("RUNPOD_API_KEY missing");
  const res = await fetch(`${BASE}/health`, {
    headers: { Authorization: RUNPOD_API_KEY },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`CPU health HTTP ${res.status}`);
  return (await res.json()) as RunpodHealth;
}

let healthCache: { at: number; body: RunpodHealth } | null = null;

/** The templates page polls; RunPod health does not need a call per poll. */
export async function cpuHealthCached(maxAgeMs = 10_000): Promise<RunpodHealth> {
  if (healthCache && Date.now() - healthCache.at < maxAgeMs) return healthCache.body;
  const body = await cpuHealth();
  healthCache = { at: Date.now(), body };
  return body;
}

export function cpuBlockedReason(health: RunpodHealth): string | null {
  const t = health.workers?.throttled ?? 0;
  // RunPod can report throttled workers alongside available workers. Do not
  // turn a partial capacity reduction into an endpoint-wide outage. The runner
  // still checks the worker's capabilities with cpuPing before submitting work.
  const available = (health.workers?.ready ?? 0) > 0 || (health.workers?.idle ?? 0) > 0;
  if (t > 0 && !available) {
    return `CPU workers are temporarily unavailable (${t} throttled, none ready). Please try again shortly.`;
  }
  return null;
}

async function cpuRun(input: Record<string, unknown>): Promise<string> {
  if (!RUNPOD_API_KEY) throw new Error("RUNPOD_API_KEY missing");
  const res = await fetch(`${BASE}/run`, {
    method: "POST",
    headers: {
      Authorization: RUNPOD_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input }),
    signal: AbortSignal.timeout(30_000),
  });
  const body = (await res.json()) as { id?: string; error?: string };
  if (!res.ok || !body.id) {
    throw new Error(body.error || `CPU /run HTTP ${res.status}`);
  }
  return body.id;
}

export async function cpuPoll(jobId: string): Promise<CpuPoll> {
  if (!RUNPOD_API_KEY) throw new Error("RUNPOD_API_KEY missing");
  const res = await fetch(`${BASE}/status/${jobId}`, {
    headers: { Authorization: RUNPOD_API_KEY },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`CPU status HTTP ${res.status}`);
  return (await res.json()) as CpuPoll;
}

export async function cpuWait(jobId: string, timeoutMs: number): Promise<CpuPoll> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const poll = await cpuPoll(jobId);
    if (
      poll.status === "COMPLETED" ||
      poll.status === "FAILED" ||
      poll.status === "CANCELLED" ||
      poll.status === "TIMED_OUT"
    ) {
      return poll;
    }
    await sleep(3000);
  }
  throw new Error(`CPU job ${jobId} timed out after ${timeoutMs}ms`);
}

export function unwrapCpu(output: CpuPoll["output"] | unknown): CpuOutput {
  if (!output) return {};
  if (typeof output === "string") {
    try {
      return JSON.parse(output) as CpuOutput;
    } catch {
      return {};
    }
  }
  if (Array.isArray(output)) {
    const first = output[0];
    return first && typeof first === "object" ? (first as CpuOutput) : {};
  }
  return output as CpuOutput;
}

export async function cpuPing(forOp: "swap" | "stitch" = "swap"): Promise<{ jobId: string; ping: CpuOutput }> {
  const jobId = await cpuRun({ op: "ping" });
  const poll = await cpuWait(jobId, 10 * 60 * 1000);
  if (poll.status !== "COMPLETED") {
    throw new Error(poll.error || unwrapCpu(poll.output).error || `CPU ping ${poll.status}`);
  }
  const ping = unwrapCpu(poll.output);
  if (ping.ok === false) throw new Error(ping.error || "CPU ping returned ok=false");
  if (forOp === "swap" && ping.facefusion_ready !== true) {
    throw new Error(ping.init_error || "CPU ping: facefusion_ready is not true.");
  }
  if (forOp === "stitch" && ping.ffmpeg !== true) throw new Error("CPU ffmpeg is unavailable");
  if (ping.allow_generate !== true) {
    throw new Error("CPU ping: allow_generate is false. Worker gate is off.");
  }
  return { jobId, ping };
}

export async function cpuSubmitSwap(sourceKey: string, faceKey: string): Promise<string> {
  return cpuRun({
    op: "swap",
    source_key: sourceKey,
    target_face_key: faceKey,
  });
}

/** Concat clips on R2. Optional one audio bed replaces the stitched soundtrack. */
export async function cpuSubmitStitch(input: {
  clip_keys: string[];
  timeline?: CloudTimeline;
  audio_key?: string | null;
  width?: number;
  height?: number;
  fps?: number;
}): Promise<string> {
  return cpuRun({
    op: "stitch",
    timeline: input.timeline,
    clip_keys: input.clip_keys,
    audio_key: input.audio_key ?? undefined,
    width: input.width ?? 1280,
    height: input.height ?? 720,
    fps: input.fps ?? 30,
  });
}

export async function cpuCancel(jobId: string): Promise<void> {
  if (!RUNPOD_API_KEY) throw new Error("RUNPOD_API_KEY missing");
  const res = await fetch(`${BASE}/cancel/${jobId}`, {
    method: "POST",
    headers: { Authorization: RUNPOD_API_KEY },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`CPU cancel HTTP ${res.status}`);
}
