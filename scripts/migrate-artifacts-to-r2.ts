/** Default is a read-only inventory. --apply uploads/verifies and saves keys; never deletes local media. */
import path from "node:path";
import { existsSync } from "node:fs";
import { listJobs, saveJob } from "../apps/backend/src/store.js";
import { listSwapJobs, saveSwapJob } from "../apps/backend/src/swap-store.js";
import { listAudioJobs, saveAudioJob } from "../apps/backend/src/audio-store.js";
import { listIdentities, persistIdentityArtifacts } from "../apps/backend/src/identity-store.js";
import { listUploads, saveUpload, studioUploadPath } from "../apps/backend/src/studio-store.js";
import { artifactsEnabled } from "../apps/backend/src/artifacts.js";
import { extFromMime } from "../apps/backend/src/media.js";
import { r2Has, r2PutFile } from "../apps/backend/src/r2.js";
async function main() {
const apply = process.argv.includes("--apply");
if (apply && !artifactsEnabled()) throw new Error("R2 media bucket must be configured");
const groups = [
  ["avatars", await listJobs(), saveJob],
  ["faceswaps", await listSwapJobs(), saveSwapJob],
  ["audio", await listAudioJobs(), saveAudioJob],
  ["identities", await listIdentities(), persistIdentityArtifacts],
] as const;
for (const [label, rows, save] of groups) {
  let migrated = 0, active = 0;
  for (const row of rows) {
    if ("status" in row && ["PENDING", "IN_PROGRESS"].includes(row.status)) { active++; continue; }
    if (apply) await (save as (row: unknown) => Promise<unknown>)(row);
    migrated++;
  }
  console.log(`${label}: ${migrated} ${apply ? "processed" : "eligible"}, ${active} active skipped`);
}
const uploads = await listUploads();
for (const row of uploads) {
  if (!apply) continue;
  const ext = path.extname(row.filename) || extFromMime(row.mime);
  const file = studioUploadPath(row.id, ext);
  const key = row.r2_key || `artifacts/studio-uploads/${row.id}${ext}`;
  if (!(await r2Has(key))) {
    if (!existsSync(file)) throw new Error("An upload has neither a local file nor a remote object; migration stopped");
    await r2PutFile(key, file, row.mime);
  }
  if (!(await r2Has(key))) throw new Error("Upload verification failed");
  row.r2_key = key; await saveUpload(row);
}
console.log(`studio uploads: ${uploads.length} ${apply ? "verified" : "eligible"}`);
console.log(apply ? "Done. Local fallback files preserved. Re-running is safe." : "Dry run. Pass --apply to upload and persist keys. No vendor generation or deletion.");

}
void main().catch(error => { console.error(error instanceof Error ? error.message : "Migration failed"); process.exitCode = 1; });
