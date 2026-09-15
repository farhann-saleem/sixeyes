export type TierId = "free" | "pro" | "premium";

export type QuotaKind = "avatars" | "images" | "videos" | "documentaries" | "audio";

export type Tier = {
  id: TierId;
  name: string;
  price_usd: number;
  price_pkr: number;
  rate_per_min: number;
  quotas: Record<QuotaKind, number>;
  badge?: string;
};

export const QUOTA_KINDS: QuotaKind[] = ["avatars", "images", "videos", "documentaries", "audio"];

export const QUOTA_LABELS: Record<QuotaKind, string> = {
  avatars: "Avatars",
  images: "Image recreations",
  videos: "Videos",
  documentaries: "Documentaries",
  audio: "Audio credits",
};

export const TIERS: Record<TierId, Tier> = {
  free: {
    id: "free",
    name: "Free",
    price_usd: 0,
    price_pkr: 0,
    rate_per_min: 6,
    quotas: { avatars: 3, images: 10, videos: 3, documentaries: 20, audio: 500 },
  },
  pro: {
    id: "pro",
    name: "Pro",
    price_usd: 20,
    price_pkr: 5600,
    rate_per_min: 30,
    quotas: { avatars: 30, images: 100, videos: 30, documentaries: 200, audio: 5000 },
    badge: "Most popular",
  },
  premium: {
    id: "premium",
    name: "Premium",
    price_usd: 150,
    price_pkr: 42000,
    rate_per_min: 60,
    quotas: { avatars: 300, images: 1000, videos: 300, documentaries: 2000, audio: 50000 },
  },
};

export function getTier(id: string): Tier | null {
  return (TIERS as Record<string, Tier | undefined>)[id] ?? null;
}
