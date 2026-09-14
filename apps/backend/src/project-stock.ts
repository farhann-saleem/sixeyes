import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { PEXELS_API_KEY } from "./env.js";
import { r2Put } from "./r2.js";
import { saveUpload, studioUploadPath } from "./studio-store.js";
import type { ProjectScene, StockCandidate } from "./studio-types.js";

type Video = {
  id: number;
  url: string;
  duration: number;
  user: { name: string };
  video_files: { file_type: string; width: number; height: number; link: string }[];
};
type Photo = { id: number; url: string; photographer: string; src: { large: string; landscape: string } };

export const PEXELS_VIDEO_SEARCH = "https://api.pexels.com/videos/search";
export const PEXELS_PHOTO_SEARCH = "https://api.pexels.com/v1/search";

export function stockUrlAllowed(url: string): boolean {
  let host: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    host = parsed.hostname.toLowerCase();
  } catch {
    return false;
  }
  return (
    host === "pexels.com" ||
    host.endsWith(".pexels.com") ||
    host === "player.vimeo.com" ||
    host.endsWith(".vimeocdn.com") ||
    host.endsWith(".vimeo.com") ||
    host.endsWith(".akamaized.net")
  );
}

const PEXELS_HEADERS = {
  Authorization: PEXELS_API_KEY,
  Accept: "application/json",
  "User-Agent": "MarketingStudio/1.0 (documentary stock fetch)",
};

async function search<T>(url: string, query: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(`${url}?${new URLSearchParams({ query, per_page: "3", orientation: "landscape" })}`, {
    headers: PEXELS_HEADERS,
    signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
  });
  if (!res.ok) {
    throw new Error(
      `Pexels HTTP ${res.status}${res.status === 429 ? " — rate limit; retry later" : " — check PEXELS_API_KEY"}`,
    );
  }
  return res.json() as Promise<T>;
}

async function download(url: string, signal: AbortSignal): Promise<Buffer> {
  if (!stockUrlAllowed(url)) throw new Error("Unexpected stock media host");
  const res = await fetch(url, {
    headers: { "User-Agent": PEXELS_HEADERS["User-Agent"] },
    signal: AbortSignal.any([signal, AbortSignal.timeout(90_000)]),
    redirect: "follow",
  });
  if (res.url && !stockUrlAllowed(res.url)) throw new Error("Unexpected stock media host");
  if (!res.ok || !res.body) throw new Error(`Stock download HTTP ${res.status}`);
  const limit = 80 * 1024 * 1024;
  if (Number(res.headers.get("content-length")) > limit) throw new Error("Stock file exceeds 80 MB");
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) throw new Error("Stock file exceeds 80 MB");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(chunks);
}

export async function fetchSceneStock(
  projectId: string,
  scene: ProjectScene,
  signal: AbortSignal,
): Promise<StockCandidate[]> {
  if (!PEXELS_API_KEY) {
    throw new Error("PEXELS_API_KEY missing. Add it to .env and restart the backend, then retry stock.");
  }
  const body = await search<{ videos: Video[] }>(PEXELS_VIDEO_SEARCH, scene.stock_query, signal);
  const choices: {
    id: number;
    kind: "video" | "image";
    url: string;
    page: string;
    person: string;
    duration: number | null;
  }[] = [];
  for (const video of body.videos || []) {
    const file = video.video_files
      .filter((f) => f.file_type === "video/mp4" && f.width <= 1920 && f.height <= 1080 && stockUrlAllowed(f.link))
      .sort((a, b) => Math.abs(a.height - 720) - Math.abs(b.height - 720))[0];
    if (file && video.duration >= scene.duration_sec) {
      choices.push({
        id: video.id,
        kind: "video",
        url: file.link,
        page: video.url,
        person: video.user.name,
        duration: video.duration,
      });
    }
  }
  if (choices.length < 3) {
    const photos = await search<{ photos: Photo[] }>(PEXELS_PHOTO_SEARCH, scene.stock_query, signal);
    for (const photo of photos.photos || []) {
      if (choices.length === 3) break;
      const url = photo.src.landscape || photo.src.large;
      if (!stockUrlAllowed(url)) continue;
      choices.push({
        id: photo.id,
        kind: "image",
        url,
        page: photo.url,
        person: photo.photographer,
        duration: null,
      });
    }
  }
  const result: StockCandidate[] = [];
  for (const choice of choices.slice(0, 3)) {
    signal.throwIfAborted();
    const bytes = await download(choice.url, signal);
    signal.throwIfAborted();
    const id = randomUUID();
    const ext = choice.kind === "video" ? ".mp4" : ".jpg";
    const mime = choice.kind === "video" ? "video/mp4" : "image/jpeg";
    const key = `studio/projects/${projectId}/uploads/${id}${ext}`;
    await r2Put(key, bytes, mime);
    writeFileSync(studioUploadPath(id, ext), bytes);
    saveUpload({
      id,
      project_id: projectId,
      filename: `${scene.heading.slice(0, 70).replace(/[^\w -]/g, "")}-${choice.id}${ext}`,
      mime,
      bytes: bytes.length,
      kind: choice.kind,
      duration_s: choice.duration,
      r2_key: key,
      created_at: new Date().toISOString(),
    });
    result.push({
      upload_id: id,
      kind: choice.kind,
      label: `${scene.heading} · ${choice.person}`,
      preview_url: `/api/studio/uploads/${id}/file`,
      duration_s: choice.duration,
      pexels_id: choice.id,
      photographer: choice.person,
      pexels_url: choice.page,
      license_url: "https://www.pexels.com/license/",
    });
  }
  return result;
}
