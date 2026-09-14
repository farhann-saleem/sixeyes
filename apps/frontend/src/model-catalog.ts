/** Frontend-only premium model catalog. Display names — no prices, no credits. */

export type CatalogModel = {
  id: string;
  name: string;
  vibe: string;
  /** Real avatar/backend provider when this card drives a generate. */
  backendId?: "openrouter-flux" | "openrouter" | "qwen" | "ai33pro";
  tag?: string;
};

export const IMAGE_MODELS: CatalogModel[] = [
  { id: "nano-banana-2", name: "Nano Banana 2", vibe: "Fast Gemini stills & edits", tag: "Default", backendId: "openrouter" },
  { id: "nano-banana-pro", name: "Nano Banana Pro", vibe: "Higher-fidelity Gemini frames" },
  { id: "flux-klein", name: "FLUX.2 Klein", vibe: "Clean identity portraits", tag: "Portrait", backendId: "openrouter-flux" },
  { id: "seedream-45", name: "Seedream 4.5", vibe: "Polished studio looks", backendId: "ai33pro" },
  { id: "krea-2-turbo", name: "Krea 2 Turbo", vibe: "Rapid text → image" },
  { id: "qwen-edit", name: "Qwen Image Edit", vibe: "Image → image rewrite", backendId: "qwen" },
  { id: "ideogram-3", name: "Ideogram 3", vibe: "Sharp type & brand frames" },
];

export const VIDEO_MODELS: CatalogModel[] = [
  { id: "seedance-15-pro", name: "Seedance 1.5 Pro", vibe: "Portrait motion · native audio feel", tag: "Hero" },
  { id: "kling-3", name: "Kling 3.0", vibe: "Cinematic image → video" },
  { id: "ltx-25", name: "LTX-2.5", vibe: "Fast I2V on cloud GPU", tag: "Studio" },
  { id: "hailuo-02", name: "Hailuo 02", vibe: "Director-style camera moves" },
  { id: "veo-31", name: "Veo 3.1", vibe: "Photoreal hero shots" },
];

/** Avatar desk — four live providers, premium labels only. */
export const AVATAR_MODELS: Array<CatalogModel & { backendId: NonNullable<CatalogModel["backendId"]> }> = [
  { id: "flux-klein", name: "FLUX.2 Klein", vibe: "Default identity still", tag: "Default", backendId: "openrouter-flux" },
  { id: "nano-banana-2", name: "Nano Banana 2", vibe: "Gemini image desk", backendId: "openrouter" },
  { id: "qwen-edit", name: "Qwen Image Edit", vibe: "Face-locked rewrite", backendId: "qwen" },
  { id: "seedream-45", name: "Seedream 4.5", vibe: "Studio portrait finish", backendId: "ai33pro" },
];

export const DOC_SHOT_MODELS = VIDEO_MODELS.map((m) => m.name);

export function displayNameForProvider(provider: string): string {
  return AVATAR_MODELS.find((m) => m.backendId === provider)?.name
    ?? IMAGE_MODELS.find((m) => m.backendId === provider)?.name
    ?? provider;
}
