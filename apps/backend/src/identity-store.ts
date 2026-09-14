import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./env.js";
import { extFromMime } from "./media.js";
import type { SavedAvatar } from "./types.js";

const STORE = path.join(DATA_DIR, "identities.json");
export const IDENTITY_DIR = path.join(DATA_DIR, "identities");

function ensure() {
  mkdirSync(IDENTITY_DIR, { recursive: true });
}

function readAll(): SavedAvatar[] {
  ensure();
  if (!existsSync(STORE)) return [];
  try {
    const raw = JSON.parse(readFileSync(STORE, "utf8"));
    return Array.isArray(raw) ? (raw as SavedAvatar[]) : [];
  } catch {
    return [];
  }
}

function writeAll(rows: SavedAvatar[]) {
  ensure();
  writeFileSync(STORE, JSON.stringify(rows, null, 2) + "\n");
}

export function identityPath(id: string, mime: string) {
  return path.join(IDENTITY_DIR, `${id}${extFromMime(mime)}`);
}

export function listIdentities(): SavedAvatar[] {
  return readAll().sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getIdentity(id: string): SavedAvatar | undefined {
  return readAll().find((a) => a.id === id);
}

export function identityForJob(jobId: string): SavedAvatar | undefined {
  return readAll().find((a) => a.job_id === jobId);
}

export function renameIdentity(id: string, name: string): SavedAvatar {
  const next = name.trim();
  if (!next) throw new Error("name required");
  const rows = readAll();
  const i = rows.findIndex((a) => a.id === id);
  if (i < 0) throw new Error("not found");
  rows[i] = { ...rows[i], name: next };
  writeAll(rows);
  return rows[i];
}

export function saveIdentityFromJob(opts: {
  id: string;
  name: string;
  job_id: string;
  mime: string;
  source_file: string;
}): SavedAvatar {
  ensure();
  const dest = identityPath(opts.id, opts.mime);
  copyFileSync(opts.source_file, dest);
  const row: SavedAvatar = {
    id: opts.id,
    name: opts.name.trim() || "Untitled avatar",
    job_id: opts.job_id,
    created_at: new Date().toISOString(),
    mime: opts.mime,
    image_url: `/api/identities/${opts.id}/image`,
  };
  const rows = readAll().filter((a) => a.id !== row.id && a.job_id !== row.job_id);
  rows.push(row);
  writeAll(rows);
  return row;
}
