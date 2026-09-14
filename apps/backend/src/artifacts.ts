import { existsSync, mkdirSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import type { Response } from "express";
import { DATA_DIR, R2_ACCESS_KEY, R2_BUCKET, R2_ENDPOINT, R2_SECRET_KEY } from "./env.js";
import { r2Has, r2PutFile, r2SignedUrl, r2ToFile } from "./r2.js";
import { mimeFromKey } from "./media.js";
export type ArtifactRow = { artifacts?: Record<string, string> };
export function artifactName(file: string) {
  const relative = path.relative(DATA_DIR, file);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Artifact outside DATA_DIR");
  return relative.split(path.sep).join("/");
}
export const artifactsEnabled = () => process.env.NODE_ENV !== "test" && Boolean(R2_BUCKET && R2_ENDPOINT && R2_ACCESS_KEY && R2_SECRET_KEY);
const dirs = ["uploads", "outputs", "identities", "audio-uploads", "audio-outputs", "studio-uploads", "studio-renders", "studio-work"];
export function initArtifactDirs() { for (const dir of dirs) mkdirSync(path.join(DATA_DIR, dir), { recursive: true }); }

/** Payload manifest is committed with the row only after the upload is durable. Legacy files remain a rollback cache. */
export async function persistArtifacts(row: ArtifactRow & { id: string }, directories: string[]) {
  if (!artifactsEnabled()) return;
  row.artifacts ??= {};
  for (const dir of directories) {
    const files = await readdir(path.join(DATA_DIR, dir)).catch((err: NodeJS.ErrnoException) => { if (err.code === "ENOENT") return []; throw err; });
    for (const name of files.filter(name => name.startsWith(`${row.id}.`) && !name.endsWith(".tmp"))) {
      const relative = `${dir}/${name}`;
      if (row.artifacts[relative]) continue;
      const key = `artifacts/${relative}`;
      if (!(await r2Has(key))) await r2PutFile(key, path.join(DATA_DIR, relative), mimeFromKey(name));
      if (!(await r2Has(key))) throw new Error("Artifact verification failed");
      row.artifacts[relative] = key;
    }
  }
}
export async function restoreArtifact(row: ArtifactRow, file: string, key?: string | null) {
  if (existsSync(file)) return file;
  const saved = key || row.artifacts?.[artifactName(file)];
  if (saved) await r2ToFile(saved, file);
  return file;
}
export async function restoreArtifacts(row: ArtifactRow) {
  for (const relative of Object.keys(row.artifacts || {})) await restoreArtifact(row, path.join(DATA_DIR, relative));
}
/** The caller must fetch the row with an owner filter first. Never cache an authorised redirect. */
export async function serveArtifact(res: Response, row: ArtifactRow, file: string, mime: string, key?: string | null, filename?: string) {
  const saved = key || row.artifacts?.[artifactName(file)];
  res.setHeader("Cache-Control", "private, no-store");
  if (saved) {
    res.status(302).setHeader("Location", await r2SignedUrl(saved, 300, filename));
    res.end(); return;
  }
  if (!existsSync(file)) { res.status(404).json({ error: "file missing" }); return; }
  if (filename) res.attachment(filename);
  res.type(mime).sendFile(path.resolve(file));
}
