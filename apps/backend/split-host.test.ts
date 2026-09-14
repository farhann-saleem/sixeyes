import assert from "node:assert/strict";
import { test } from "node:test";
import { createApiClient } from "../frontend/src/api-client.ts";

test("split host sends cookies and multipart directly to API and resolves nested media URLs", async () => {
  const original = globalThis.fetch;
  const client = createApiClient("https://api.example.test");
  const upload = new FormData(); upload.set("file", new Blob(["upload"]), "clip.mp4");
  globalThis.fetch = (async (url, init) => {
    assert.equal(url, "https://api.example.test/api/studio/uploads");
    assert.equal(init?.credentials, "include");
    assert.equal(init?.body, upload);
    assert.equal(new Headers(init?.headers).has("Content-Type"), false);
    return new Response(JSON.stringify({ clips: [{ preview_url: "/api/private/video", text: "/api/private/video", poster_url: "https://r2.example.test/poster" }] }));
  }) as typeof fetch;
  try {
    const body = await client.apiJson<any>("/api/studio/uploads", { method: "POST", body: upload });
    assert.equal(body.clips[0].preview_url, "https://api.example.test/api/private/video");
    assert.equal(body.clips[0].text, "/api/private/video");
    assert.equal(body.clips[0].poster_url, "https://r2.example.test/poster");
    assert.equal(client.apiUrl("/api/auth/callback?code=a&state=b"), "https://api.example.test/api/auth/callback?code=a&state=b");
    assert.equal(createApiClient("").apiUrl("/api/auth/me"), "/api/auth/me");
  } finally { globalThis.fetch = original; }
});
