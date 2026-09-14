import { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./env.js";
import { db, dbEnabled, eq, ownerOf } from "./db.js";
import { listAudioJobs } from "./audio-store.js";
type Resource = { id: string; kind: string; owner_email: string; payload: Record<string, unknown> };
const file = path.join(DATA_DIR, "user-resources.json");
function read(): Resource[] { return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : []; }
export async function resources(email: string, kind = "dictionary"): Promise<Resource[]> {
  return dbEnabled() ? db.select<Resource>("user_resources", `${eq("owner_email", ownerOf(email))}&${eq("kind", kind)}&select=*`) : read().filter(r => r.owner_email === ownerOf(email) && r.kind === kind);
}
export async function saveResource(email: string, id: string, payload: Record<string, unknown>) {
  const row = { id, kind: "dictionary", owner_email: ownerOf(email), payload };
  if (dbEnabled()) { await db.insert("user_resources", row); return; }
  mkdirSync(DATA_DIR, { recursive: true });
  const rows = read(); rows.push(row);
  writeFileSync(`${file}.tmp`, JSON.stringify(rows)); renameSync(`${file}.tmp`, file);
}
export async function assertDictionaryOwner(email: string, id: unknown) {
  if (!id) return;
  if (!(await resources(email)).some(r => r.id === id)) throw new Error("Dictionary not found");
}
export async function assertVoiceOwner(email: string, id: unknown) {
  if (typeof id !== "string" || !id.startsWith("clone_")) return;
  if (!(await listAudioJobs(email)).some(j => j.kind === "clone" && j.params.voice_id === id && !j.params.deleted)) throw new Error("Voice not found");
}

export async function deleteResource(email: string, id: string) {
  if (dbEnabled()) { await db.delete("user_resources", `${eq("owner_email", ownerOf(email))}&${eq("kind", "dictionary")}&${eq("id", id)}`); return; }
  const rows = read().filter(r => !(r.owner_email === ownerOf(email) && r.id === id && r.kind === "dictionary"));
  writeFileSync(`${file}.tmp`, JSON.stringify(rows)); renameSync(`${file}.tmp`, file);
}
