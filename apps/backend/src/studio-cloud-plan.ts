import { extFromMime } from "./media.js";
import { r2PutFile } from "./r2.js";
import { projectScopeError, resolveSource } from "./studio-media.js";
import { audioBeds, inPointAt, projectDuration, visualSlices } from "./studio-timeline.js";
import type { StudioClipSource, StudioProject } from "./studio-types.js";
export type CloudTimeline = {
  version: 1; duration: number;
  slices: { key: string | null; kind: "video" | "image" | "black"; start: number; duration: number;
    texts: { text: string; x: number; y: number; font_size: number; color: string }[] }[];
  audio: { key: string; start: number; duration: number; delay: number; volume: number }[];
};
/** Metadata and original bytes only. All trim, composition, mix and encoding run on CPU worker. */
export async function buildCloudPlan(p: StudioProject, renderId: string): Promise<CloudTimeline> {
  const invalid = await projectScopeError(p); if (invalid) throw new Error(invalid);
  const keys = new Map<string, string>();
  async function keyFor(source: StudioClipSource) {
    const id = JSON.stringify(source); if (keys.has(id)) return keys.get(id)!;
    const media = await resolveSource(source);
    const key = media.r2_key || `studio/projects/${p.id}/renders/${renderId}/source-${keys.size}${extFromMime(media.mime)}`;
    if (!media.r2_key) await r2PutFile(key, media.file, media.mime);
    keys.set(id, key); return key;
  }
  const slices: CloudTimeline["slices"] = [];
  for (const s of visualSlices(p)) {
    slices.push({ key: s.clip ? await keyFor(s.clip.source) : null, kind: s.clip?.kind === "image" ? "image" : s.clip ? "video" : "black",
      start: s.clip ? inPointAt(s.clip, s.start) : 0, duration: s.end - s.start,
      texts: s.texts.map(t => ({ text: t.text || "", x: t.x ?? .5, y: t.y ?? .82, font_size: t.font_size ?? 48, color: t.color || "#ffffff" })) });
  }
  const audio: CloudTimeline["audio"] = [];
  for (const a of audioBeds(p)) audio.push({ key: await keyFor(a.clip.source), start: a.trim_start, duration: a.duration, delay: a.delay_sec, volume: a.volume });
  return { version: 1, duration: projectDuration(p), slices, audio };
}
