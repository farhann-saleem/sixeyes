import { AI33_API_KEY, AI33_BASE_URL, AI33_IMAGE_MODEL } from "../env.js";
import { ai33AvatarPrompt } from "../prompt.js";

function headers(extra?: HeadersInit): HeadersInit {
  if (!AI33_API_KEY) throw new Error("AI33_API_KEY missing");
  return { "xi-api-key": AI33_API_KEY, ...extra };
}

export async function ai33Credits(): Promise<number | null> {
  const res = await fetch(`${AI33_BASE_URL}/v1/credits`, {
    headers: headers(),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { credits?: number };
  return typeof body.credits === "number" ? body.credits : null;
}

export async function ai33Quote(opts?: {
  aspect_ratio?: string;
  resolution?: string;
  assets?: number;
}): Promise<number> {
  const res = await fetch(`${AI33_BASE_URL}/v1i/task/price`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      model_id: AI33_IMAGE_MODEL,
      generations_count: 1,
      model_parameters: {
        aspect_ratio: opts?.aspect_ratio ?? "16:9",
        resolution: opts?.resolution ?? "2K",
      },
      assets: opts?.assets ?? 1,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await res.json()) as { success?: boolean; credits?: number; message?: string };
  if (!res.ok || typeof body.credits !== "number") {
    throw new Error(body.message || `ai33pro price HTTP ${res.status}`);
  }
  return body.credits;
}

export async function ai33Generate(image: Buffer, filename: string, mime: string): Promise<string> {
  const form = new FormData();
  form.append("prompt", ai33AvatarPrompt());
  form.append("model_id", AI33_IMAGE_MODEL);
  form.append("generations_count", "1");
  form.append(
    "model_parameters",
    JSON.stringify({ aspect_ratio: "16:9", resolution: "2K" }),
  );
  form.append("assets", new Blob([new Uint8Array(image)], { type: mime }), filename);

  const res = await fetch(`${AI33_BASE_URL}/v1i/task/generate-image`, {
    method: "POST",
    headers: headers(),
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  const body = (await res.json()) as {
    success?: boolean;
    task_id?: string;
    message?: string;
    error?: string;
  };
  if (!res.ok || !body.task_id) {
    throw new Error(body.message || body.error || `ai33pro generate HTTP ${res.status}`);
  }
  return body.task_id;
}

export type Ai33Task = {
  id?: string;
  status?: string;
  error_message?: string | null;
  credit_cost?: number;
  progress?: number;
  type?: string;
  metadata?: Record<string, unknown>;
};

export async function ai33Delete(taskId: string): Promise<void> {
  const res = await fetch(`${AI33_BASE_URL}/v1/task/delete`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ task_ids: [taskId] }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message || `ai33pro delete HTTP ${res.status}`);
  }
}

export async function ai33Poll(taskId: string): Promise<Ai33Task> {
  const res = await fetch(`${AI33_BASE_URL}/v1/task/${taskId}`, {
    headers: headers({ "Content-Type": "application/json" }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`ai33pro task HTTP ${res.status}`);
  return (await res.json()) as Ai33Task;
}

function httpUrl(value: unknown): string | null {
  return typeof value === "string" && /^https?:\/\//.test(value) ? value : null;
}

/** Owner docs: done tasks put the picture in metadata.result_images[].imageUrl */
export function extractImageUrl(task: Ai33Task): string | null {
  const meta = task.metadata || {};
  const results = meta.result_images;
  if (Array.isArray(results)) {
    for (const item of results) {
      if (!item || typeof item !== "object") continue;
      const row = item as { imageUrl?: string; previewUrl?: string; url?: string };
      const url = httpUrl(row.imageUrl) || httpUrl(row.previewUrl) || httpUrl(row.url);
      if (url) return url;
    }
  }
  const direct = httpUrl(meta.image_url) || httpUrl(meta.imageUrl);
  if (direct) return direct;
  const images = meta.images;
  if (Array.isArray(images) && images.length) {
    const first = images[0];
    if (typeof first === "string") return httpUrl(first);
    if (first && typeof first === "object") {
      const row = first as { imageUrl?: string; url?: string };
      return httpUrl(row.imageUrl) || httpUrl(row.url);
    }
  }
  const urls = meta.image_urls || meta.output_urls;
  if (Array.isArray(urls)) return httpUrl(urls[0]);
  return null;
}
