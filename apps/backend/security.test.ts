import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Server } from "node:http";
process.env.NODE_ENV = "test";
process.env.STUDIO_TEST_DATA_DIR = mkdtempSync(path.join(tmpdir(), "ms-security-"));
process.env.FRONTEND_URL = "http://localhost:5173";
process.env.R2_ENDPOINT = "https://test.r2.cloudflarestorage.com";
process.env.R2_ACCESS_KEY = "test-access";
process.env.R2_SECRET_KEY = "test-secret-not-real";
process.env.R2_BUCKET = "test-media";
process.env.GOOGLE_CLIENT_ID = "test-client";
process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";
const dir = process.env.STUDIO_TEST_DATA_DIR;
writeFileSync(path.join(dir, "auth-sessions.json"), JSON.stringify(Object.fromEntries(["alice", "bob"].map(name => [name, { email: `${name}@test.invalid`, name, picture: "", expires_at: Date.now() + 60000 }]))));
const { app } = await import("./src/index.js");
const { saveAudioJob, audioOutputPath } = await import("./src/audio-store.js");
const { saveSwapJob } = await import("./src/swap-store.js");
const { saveJob, inputPath, outputPath } = await import("./src/store.js");
const { saveProject, saveUpload, studioUploadPath } = await import("./src/studio-store.js");
const { emptyProject } = await import("./src/studio-timeline.js");
const { initArtifactDirs } = await import("./src/artifacts.js");
const { installSpa, errorHandler } = await import("./src/http.js");
const { assertVoiceOwner, assertDictionaryOwner, saveResource } = await import("./src/user-resources.js");
const express = (await import("express")).default;
let server: Server, base: string;
before(async () => {
  initArtifactDirs();
  const now = new Date().toISOString();
  const common = { id: "alice-audio", owner_email: "alice@test.invalid", created_at: now, updated_at: now, status: "COMPLETED", provider_meta: {}, params: {}, kind: "tts", title: "Alice private", input_mime: null, output_mime: "audio/mpeg", output_filename: "audio.mp3", has_cover: true, has_srt: true, transcript: "Alice transcript" };
  await saveAudioJob(common as any);
  for (const ext of [".mp3", ".cover.jpg", ".txt", ".json", ".srt"]) writeFileSync(audioOutputPath(common.id, ext), "0123456789");
  await saveJob({ ...common, id: "alice-avatar", provider: "qwen", input_mime: "image/png", output_mime: "image/png" } as any);
  writeFileSync(inputPath("alice-avatar", ".png"), "private"); writeFileSync(outputPath("alice-avatar"), "private");
  await saveSwapJob({ ...common, id: "alice-swap", kind: "video", face_mime: "image/png", output_mime: "video/mp4", output_r2_key: "outputs/cpu/alice.mp4" } as any);
  const p = emptyProject("bob-project", "Bob film"); p.owner_email = "bob@test.invalid"; await saveProject(p);
  await saveUpload({ id: "alice-upload", project_id: null, owner_email: "alice@test.invalid", filename: "x.mp4", mime: "video/mp4", bytes: 10, kind: "video", duration_s: 5, r2_key: "private/alice.mp4", created_at: now });
  writeFileSync(studioUploadPath("alice-upload", ".mp4"), "0123456789");
  await new Promise<void>((resolve, reject) => { server = app.listen(0, "127.0.0.1", resolve); server.on("error", reject); });
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
after(async () => { if(server) await new Promise<void>(resolve => server.close(() => resolve())); rmSync(dir, { recursive: true, force: true }); });
function request(url: string, user?: string, init: RequestInit = {}) {
  return fetch(base + url, { ...init, redirect: "manual", headers: { ...(user ? { Cookie: `ms_session=${user}` } : {}), ...init.headers } });
}
test("anonymous GET and HEAD cannot become unrestricted store reads", async () => {
  for (const route of ["/api/avatars", "/api/faceswaps", "/api/identities", "/api/studio/projects", "/api/studio/media", "/api/audio/jobs", "/api/audio/asset-library", "/api/costs"]) {
    for (const method of ["GET", "HEAD"]) assert.equal((await request(route, undefined, { method })).status, 401, route);
  }
});
test("cross-user metadata, covers, transcripts, inputs and signed outputs are blocked", async () => {
  for (const route of ["/api/audio/jobs/alice-audio", "/api/audio/jobs/alice-audio/cover", "/api/audio/jobs/alice-audio/transcript", "/api/audio/jobs/alice-audio/output", "/api/audio/jobs/alice-audio/srt", "/api/avatars/alice-avatar/input", "/api/avatars/alice-avatar/output", "/api/faceswaps/alice-swap/output", "/api/studio/uploads/alice-upload/file"]) {
    const res = await request(route, "bob"); assert.equal(res.status, 404, route); assert.equal(res.headers.get("location"), null);
  }
  assert.deepEqual((await (await request("/api/audio/jobs", "bob")).json()).jobs, []);
  assert.equal((await (await request("/api/audio/jobs", "alice")).json()).jobs[0].id, "alice-audio");
});
test("owner gets a 300s signed redirect without backend download or body", async () => {
  const res = await request("/api/faceswaps/alice-swap/output", "alice");
  assert.equal(res.status, 302); assert.equal(await res.text(), "");
  const url = new URL(res.headers.get("location")!);
  assert.equal(url.searchParams.get("X-Amz-Expires"), "300");
  assert.equal(url.toString().includes("test-secret-not-real"), false);
  assert.match(res.headers.get("cache-control")!, /no-store/);
});
test("legacy media streams and supports Range requests", async () => {
  const res = await request("/api/audio/jobs/alice-audio/output", "alice", { headers: { Range: "bytes=2-5" } });
  assert.equal(res.status, 206); assert.equal(await res.text(), "2345");
});
test("Studio rejects guessed foreign library, upload and audio ids on add and PATCH", async () => {
  for (const [origin, id] of [["library", "alice-swap"], ["audio", "alice-audio"], ["upload", "alice-upload"]]) {
    const res = await request("/api/studio/projects/bob-project/clips", "bob", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ origin, media_id: id }) });
    assert.equal(res.status, 400); assert.match((await res.json()).error, /belong/);
  }
  const res = await request("/api/studio/projects/bob-project", "bob", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clips: [{ id: "x", kind: "video", source: { type: "library", id: "alice-swap" }, track_id: "v1", start_sec: 0, duration: 5, crop_start: 0, crop_end: 5, volume: 1 }] }) });
  assert.equal(res.status, 400);
});
test("malformed cookies are harmless and cross-site mutations are rejected", async () => {
  assert.equal((await request("/api/auth/me", undefined, { headers: { Cookie: "ms_session=%ZZ" } })).status, 401);
  assert.equal((await request("/api/auth/logout", "alice", { method: "POST", headers: { Origin: "https://attacker.invalid" } })).status, 403);
  const preflight = await request("/api/auth/logout", undefined, { method: "OPTIONS", headers: { Origin: "http://localhost:5173", "Access-Control-Request-Method": "POST" } });
  assert.equal(preflight.headers.get("access-control-allow-origin"), "http://localhost:5173");
  assert.equal(preflight.headers.get("access-control-allow-credentials"), "true");
});
test("OAuth callback needs the initiating browser's state cookie", async () => {
  const login = await request("/api/auth/login");
  const state = new URL(login.headers.get("location")!).searchParams.get("state");
  const res = await request(`/api/auth/callback?code=fake&state=${state}`);
  assert.match(res.headers.get("location")!, /bad_state/);
});
test("SPA deep links work; missing API/MCP/health/assets never return index.html; async rejection returns JSON", async () => {
  const dist = path.join(dir, "dist"); mkdirSync(dist); writeFileSync(path.join(dist, "index.html"), "<html>SPA</html>");
  const sample = express(); sample.get("/api/fail", async () => { throw new Error("db down"); }); installSpa(sample, dist); sample.use(errorHandler);
  const local = await new Promise<Server>(resolve => { const s = sample.listen(0, "127.0.0.1", () => resolve(s)); });
  const address = `http://127.0.0.1:${(local.address() as any).port}`;
  try {
    for (const route of ["/callback", "/projects/abc/studio", "/mcp"]) { const res = await fetch(address + route); assert.equal(res.status, 200); assert.match(await res.text(), /SPA/); }
    for (const route of ["/api", "/api/nope", "/mcp/nope", "/health", "/health/nope", "/assets/missing.js"]) { const res = await fetch(address + route); assert.equal(res.status, 404, route); assert.doesNotMatch(await res.text(), /<html>SPA/); }
    const fail = await fetch(address + "/api/fail"); assert.equal(fail.status, 500); assert.deepEqual(await fail.json(), { error: "Request failed; please retry" });
  } finally { await new Promise<void>(resolve => local.close(() => resolve())); }
});
test("private voice and dictionary ownership cannot be guessed", async () => {
  await saveAudioJob({ id: "alice-clone", kind: "clone", owner_email: "alice@test.invalid", params: { voice_id: "clone_secret" }, created_at: new Date().toISOString() } as any);
  await assertVoiceOwner("alice@test.invalid", "clone_secret");
  await assert.rejects(() => assertVoiceOwner("bob@test.invalid", "clone_secret"));
  await saveResource("alice@test.invalid", "dict-secret", {});
  await assert.rejects(() => assertDictionaryOwner("bob@test.invalid", "dict-secret"));
  assert.equal((await request("/api/audio/clones/secret", "bob", { method: "DELETE" })).status, 404);
});
