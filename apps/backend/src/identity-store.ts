import { persistArtifacts } from "./artifacts.js";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./env.js";
import { db, dbEnabled, eq, ownerOf } from "./db.js";
import { extFromMime } from "./media.js";
import type { SavedAvatar } from "./types.js";

const STORE = path.join(DATA_DIR, "identities.json");
export const IDENTITY_DIR = path.join(DATA_DIR, "identities");

function ensure() {
  mkdirSync(IDENTITY_DIR, { recursive: true });
}

function normalize(row: SavedAvatar): SavedAvatar {
  return { ...row, owner_email: row.owner_email || "anonymous" };
}

function readAll(): SavedAvatar[] {
  ensure();
  if (!existsSync(STORE)) return [];
  try {
    const raw = JSON.parse(readFileSync(STORE, "utf8"));
    return Array.isArray(raw) ? (raw as SavedAvatar[]).map(normalize) : [];
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

export async function listIdentities(ownerEmail?: string): Promise<SavedAvatar[]> {
  const owner = ownerEmail ? ownerOf(ownerEmail) : null;
  if (dbEnabled()) {
    const query = owner
      ? `${eq("owner_email", owner)}&select=payload&order=created_at.desc`
      : `select=payload&order=created_at.desc`;
    const data = await db.select<{ payload: SavedAvatar }>("identities", query);
    return data.map((r) => normalize(r.payload));
  }
  const all = readAll().sort((a, b) => b.created_at.localeCompare(a.created_at));
  return owner ? all.filter((a) => ownerOf(a.owner_email) === owner) : all;
}

export async function getIdentity(id: string, ownerEmail?: string): Promise<SavedAvatar | undefined> {
  if (dbEnabled()) {
    const data = await db.selectOne<{ payload: SavedAvatar; owner_email: string }>(
      "identities",
      `${eq("id", id)}&select=payload,owner_email`,
    );
    if (!data) return undefined;
    if (ownerEmail && ownerOf(data.owner_email) !== ownerOf(ownerEmail)) return undefined;
    return normalize(data.payload);
  }
  const row = readAll().find((a) => a.id === id);
  if (!row) return undefined;
  if (ownerEmail && ownerOf(row.owner_email) !== ownerOf(ownerEmail)) return undefined;
  return row;
}

export async function identityForJob(jobId: string, ownerEmail?: string): Promise<SavedAvatar | undefined> {
  const all = await listIdentities(ownerEmail);
  return all.find((a) => a.job_id === jobId);
}

export async function renameIdentity(
  id: string,
  name: string,
  ownerEmail?: string,
): Promise<SavedAvatar> {
  const next = name.trim();
  if (!next) throw new Error("name required");
  const row = await getIdentity(id, ownerEmail);
  if (!row) throw new Error("not found");
  const updated = normalize({ ...row, name: next });
  if (dbEnabled()) {
    await db.update("identities", eq("id", id), { payload: updated });
    return updated;
  }
  const rows = readAll();
  const i = rows.findIndex((a) => a.id === id);
  if (i < 0) throw new Error("not found");
  rows[i] = updated;
  writeAll(rows);
  return updated;
}

export async function saveIdentityFromJob(opts: {
  id: string;
  name: string;
  job_id: string;
  mime: string;
  source_file: string;
  owner_email?: string;
}): Promise<SavedAvatar> {
  ensure();
  const dest = identityPath(opts.id, opts.mime);
  copyFileSync(opts.source_file, dest);
  const row = normalize({
    id: opts.id,
    name: opts.name.trim() || "Untitled avatar",
    job_id: opts.job_id,
    created_at: new Date().toISOString(),
    mime: opts.mime,
    image_url: `/api/identities/${opts.id}/image`,
    owner_email: ownerOf(opts.owner_email),
  });
  await persistArtifacts(row, ["identities"]);
  if (dbEnabled()) {
    const existing = await listIdentities(row.owner_email);
    for (const e of existing) {
      if (e.job_id === opts.job_id || e.id === opts.id) {
        await db.delete("identities", eq("id", e.id));
      }
    }
    await db.insert("identities", {
      id: row.id,
      owner_email: row.owner_email,
      payload: row,
      created_at: row.created_at,
    });
    return row;
  }
  const rows = readAll().filter((a) => a.id !== row.id && a.job_id !== row.job_id);
  rows.push(row);
  writeAll(rows);
  return row;
}

/** Migration updates metadata in place; it never recreates or reassigns an identity. */
export async function persistIdentityArtifacts(row: SavedAvatar): Promise<void> {
  await persistArtifacts(row, ["identities"]);
  if (dbEnabled()) { await db.update("identities", `${eq("id", row.id)}&${eq("owner_email", ownerOf(row.owner_email))}`, { payload: row }); return; }
  const rows = readAll(); const index = rows.findIndex(r => r.id === row.id);
  if (index >= 0) { rows[index] = row; writeAll(rows); }
}
