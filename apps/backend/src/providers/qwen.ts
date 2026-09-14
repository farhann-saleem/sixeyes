import { RUNPOD_API_KEY, RUNPOD_QWEN_ENDPOINT_ID } from "../env.js";

const BASE = `https://api.runpod.ai/v2/${RUNPOD_QWEN_ENDPOINT_ID}`;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export type RunpodHealth = {
  jobs?: { completed?: number; failed?: number; inProgress?: number; inQueue?: number };
  workers?: {
    idle?: number;
    initializing?: number;
    ready?: number;
    running?: number;
    throttled?: number;
    unhealthy?: number;
  };
};

export async function qwenHealth(): Promise<RunpodHealth> {
  if (!RUNPOD_API_KEY) throw new Error("RUNPOD_API_KEY missing");
  const res = await fetch(`${BASE}/health`, {
    headers: { Authorization: RUNPOD_API_KEY },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Qwen health HTTP ${res.status}`);
  return (await res.json()) as RunpodHealth;
}

export function qwenBlockedReason(health: RunpodHealth): string | null {
  const t = health.workers?.throttled ?? 0;
  if (t > 0) {
    return `Qwen endpoint throttled (${t}). Lock: do not generate while throttled > 0.`;
  }
  return null;
}

async function qwenRun(input: Record<string, unknown>): Promise<string> {
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
  const body = (await res.json()) as { id?: string; error?: string; status?: string };
  if (!res.ok || !body.id) {
    throw new Error(body.error || `Qwen /run HTTP ${res.status}`);
  }
  return body.id;
}

export async function qwenWait(jobId: string, timeoutMs: number): Promise<QwenPoll> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const poll = await qwenPoll(jobId);
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
  throw new Error(`Qwen job ${jobId} timed out after ${timeoutMs}ms`);
}

export type QwenPing = {
  ok?: boolean;
  volume_mounted?: boolean;
  comfy_up?: boolean;
  free_gb?: number | null;
  worker?: string;
  weight_root?: string;
};

/** Wake a scale-to-zero worker. Health does not start a GPU. Idle can be 5s — generate immediately after. */
export async function qwenPing(): Promise<{ jobId: string; ping: QwenPing }> {
  const jobId = await qwenRun({ op: "ping" });
  const poll = await qwenWait(jobId, 10 * 60 * 1000);
  if (poll.status !== "COMPLETED") {
    throw new Error(poll.error || poll.output?.error || `Qwen ping ${poll.status}`);
  }
  const ping = unwrapPing(poll.output);
  if (ping.ok === false) throw new Error("Qwen ping returned ok=false");
  if (ping.volume_mounted !== true) {
    throw new Error("Qwen ping: volume_mounted is not true. Volume DC must be EU-RO-1 only.");
  }
  if (typeof ping.free_gb === "number" && ping.free_gb < 35) {
    throw new Error(`Qwen ping: free_gb=${ping.free_gb}, need >> 35 for Qwen weights.`);
  }
  if (ping.comfy_up !== true) {
    throw new Error("Qwen ping: comfy_up is false. Worker woke but Comfy is not ready.");
  }
  return { jobId, ping };
}

export async function qwenSubmit(imageB64: string, prompt: string): Promise<string> {
  return qwenRun({
    op: "generate",
    prompt,
    image_b64: imageB64,
    width: 1024,
    height: 1024,
    steps: 20,
    cfg: 4.0,
  });
}

export type QwenPoll = {
  status: string;
  output?: {
    ok?: boolean;
    error?: string;
    png_b64?: string;
    duration_ms?: number;
    estimated_usd?: number;
    usd_per_hour_assumed?: number;
    width?: number;
    height?: number;
    steps?: number;
    seed?: number;
  };
  error?: string;
};

function unwrapPing(output: QwenPoll["output"] | unknown): QwenPing {
  if (!output) return {};
  if (typeof output === "string") {
    try {
      return JSON.parse(output) as QwenPing;
    } catch {
      return {};
    }
  }
  if (Array.isArray(output)) {
    const first = output[0];
    return first && typeof first === "object" ? (first as QwenPing) : {};
  }
  return output as QwenPing;
}

export async function qwenCancel(jobId: string): Promise<void> {
  if (!RUNPOD_API_KEY) throw new Error("RUNPOD_API_KEY missing");
  const res = await fetch(`${BASE}/cancel/${jobId}`, {
    method: "POST",
    headers: { Authorization: RUNPOD_API_KEY },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Qwen cancel HTTP ${res.status}`);
}

export async function qwenPoll(jobId: string): Promise<QwenPoll> {
  if (!RUNPOD_API_KEY) throw new Error("RUNPOD_API_KEY missing");
  const res = await fetch(`${BASE}/status/${jobId}`, {
    headers: { Authorization: RUNPOD_API_KEY },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Qwen status HTTP ${res.status}`);
  return (await res.json()) as QwenPoll;
}
