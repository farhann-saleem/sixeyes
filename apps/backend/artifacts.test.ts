import assert from "node:assert/strict";
import { test, after } from "node:test";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
process.env.NODE_ENV = "test";
process.env.STUDIO_TEST_DATA_DIR = mkdtempSync(path.join(tmpdir(), "ms-artifacts-"));
process.env.R2_ENDPOINT = "https://fake.r2.cloudflarestorage.com";
process.env.R2_ACCESS_KEY = "fake"; process.env.R2_SECRET_KEY = "fake"; process.env.R2_BUCKET = "test-media";
const { initArtifactDirs, persistArtifacts, restoreArtifacts } = await import("./src/artifacts.js");
const { DATA_DIR } = await import("./src/env.js");
const { S3Client } = await import("@aws-sdk/client-s3");
const originalSend = S3Client.prototype.send;
const objects = new Map<string, Buffer>(); let puts = 0;
S3Client.prototype.send = (async function(command: any) {
  const key = command.input.Key;
  switch(command.constructor.name) {
    case "HeadObjectCommand": if (!objects.has(key)) throw Object.assign(new Error("Missing"), { name: "NotFound" }); return {};
    case "PutObjectCommand": { const chunks: Buffer[] = []; for await (const chunk of command.input.Body) chunks.push(Buffer.from(chunk)); objects.set(key, Buffer.concat(chunks)); puts++; return {}; }
    case "GetObjectCommand": return { Body: Readable.from(objects.get(key)!) };
    default: throw new Error("Unexpected S3 command");
  }
}) as any;
after(() => { S3Client.prototype.send = originalSend; rmSync(DATA_DIR, { recursive: true, force: true }); });
test("artifact migration is idempotent and restores media after local cache loss", async () => {
  initArtifactDirs(); const file = path.join(DATA_DIR, "audio-outputs", "job.mp3");
  writeFileSync(file, "audio bytes"); const row = { id: "job", artifacts: {} as Record<string,string> };
  process.env.NODE_ENV = "development";
  try {
    await persistArtifacts(row, ["audio-outputs"]); await persistArtifacts(row, ["audio-outputs"]);
    assert.equal(puts, 1); assert.equal(existsSync(file), true);
    assert.equal(row.artifacts["audio-outputs/job.mp3"], "artifacts/audio-outputs/job.mp3");
    rmSync(file); await restoreArtifacts(row); assert.equal(readFileSync(file, "utf8"), "audio bytes");
    const duplicate = { id: "job", artifacts: {} }; await persistArtifacts(duplicate, ["audio-outputs"]); assert.equal(puts, 1);
  } finally { process.env.NODE_ENV = "test"; }
});

test("streamed downloads publish only complete files and clean failures", async () => {
  const { downloadToFile } = await import("./src/download.js");
  const fetchOriginal = globalThis.fetch;
  const dest = path.join(DATA_DIR, "audio-outputs", "download.mp3");
  try {
    globalThis.fetch = async () => new Response("complete");
    assert.equal(await downloadToFile("https://fake.invalid/file", dest), 8);
    assert.equal(readFileSync(dest, "utf8"), "complete");
    globalThis.fetch = async () => new Response("too long");
    await assert.rejects(() => downloadToFile("https://fake.invalid/file", dest, AbortSignal.timeout(1000), 2), /size limit/);
    assert.equal(readFileSync(dest, "utf8"), "complete");
    const { readdirSync } = await import("node:fs");
    assert.equal(readdirSync(path.dirname(dest)).some(name => name.endsWith(".tmp")), false);
  } finally { globalThis.fetch = fetchOriginal; }
});
