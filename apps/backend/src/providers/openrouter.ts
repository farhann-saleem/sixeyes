import {
  OPENROUTER_API_KEY,
  OPENROUTER_BASE_URL,
  OPENROUTER_FLUX_MODEL,
  OPENROUTER_IMAGE_MODEL,
} from "../env.js";
import type { AvatarProvider } from "../types.js";

export type OpenRouterImageResult = {
  buffer: Buffer;
  mime: string;
  cost_usd: number | null;
  generation_id: string | null;
  model: string;
};

export type OpenRouterImageSpec = {
  vendor: string;
  listed_usd: number;
  label: string;
  aspect_ratio: string;
  resolution?: string;
};

export const OPENROUTER_IMAGE_SPECS: Record<
  Extract<AvatarProvider, "openrouter" | "openrouter-flux">,
  OpenRouterImageSpec
> = {
  openrouter: {
    vendor: OPENROUTER_IMAGE_MODEL,
    listed_usd: 0.01,
    label: "Muse",
    aspect_ratio: "3:4",
  },
  "openrouter-flux": {
    vendor: OPENROUTER_FLUX_MODEL,
    listed_usd: 0.014,
    label: "FLUX.2 Klein 4B",
    aspect_ratio: "3:4",
    resolution: "1K",
  },
};

export function isOpenRouterProvider(
  provider: AvatarProvider,
): provider is "openrouter" | "openrouter-flux" {
  return provider === "openrouter" || provider === "openrouter-flux";
}

function dataUrl(raw: Buffer, mime: string) {
  return `data:${mime};base64,${raw.toString("base64")}`;
}

export async function openrouterKeyOk(): Promise<{ ok: boolean; error: string | null }> {
  if (!OPENROUTER_API_KEY) return { ok: false, error: "OPENROUTER_API_KEY missing" };
  try {
    const res = await fetch(`${OPENROUTER_BASE_URL}/key`, {
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { ok: false, error: `OpenRouter key HTTP ${res.status}` };
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** @deprecated use openrouterKeyOk */
export const museKeyOk = openrouterKeyOk;

export async function openrouterGenerate(
  provider: "openrouter" | "openrouter-flux",
  raw: Buffer,
  mime: string,
  prompt: string,
): Promise<OpenRouterImageResult> {
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY missing");
  const spec = OPENROUTER_IMAGE_SPECS[provider];

  const bodyPayload: Record<string, unknown> = {
    model: spec.vendor,
    prompt,
    n: 1,
    aspect_ratio: spec.aspect_ratio,
    input_references: [
      {
        type: "image_url",
        image_url: { url: dataUrl(raw, mime) },
      },
    ],
  };
  if (spec.resolution) bodyPayload.resolution = spec.resolution;

  const res = await fetch(`${OPENROUTER_BASE_URL}/images`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://marketingstudioie.site",
      "X-OpenRouter-Title": "Marketing Studio",
    },
    body: JSON.stringify(bodyPayload),
    signal: AbortSignal.timeout(180_000),
  });

  const body = (await res.json()) as {
    id?: string;
    error?: { message?: string } | string;
    data?: Array<{ b64_json?: string; url?: string; media_type?: string }>;
    usage?: { cost?: number };
  };

  if (!res.ok) {
    const msg =
      typeof body.error === "string"
        ? body.error
        : body.error?.message || `OpenRouter /images HTTP ${res.status}`;
    throw new Error(msg);
  }

  const first = body.data?.[0];
  if (!first?.b64_json && !first?.url) {
    throw new Error(`${spec.label} completed with no image`);
  }

  let buffer: Buffer;
  let outMime = first.media_type || "image/png";
  if (first.b64_json) {
    buffer = Buffer.from(first.b64_json, "base64");
  } else {
    const img = await fetch(first.url as string, { signal: AbortSignal.timeout(60_000) });
    if (!img.ok) throw new Error(`${spec.label} result download HTTP ${img.status}`);
    buffer = Buffer.from(await img.arrayBuffer());
    outMime = img.headers.get("content-type") || outMime;
  }

  return {
    buffer,
    mime: outMime,
    cost_usd: typeof body.usage?.cost === "number" ? body.usage.cost : spec.listed_usd,
    generation_id: body.id ?? null,
    model: spec.vendor,
  };
}
