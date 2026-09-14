import { test } from "node:test";
import assert from "node:assert/strict";
import { createApiClient } from "./src/api-client.ts";

test("public catalog cache deduplicates, expires and excludes private/options requests", async () => {
  const fetchBefore = globalThis.fetch;
  const nowBefore = Date.now;
  let now = 1_000;
  let count = 0;
  globalThis.fetch = async () => { count++; return new Response(JSON.stringify({ templates: [] })); };
  Date.now = () => now;
  try {
    const { apiJson } = createApiClient("");
    await Promise.all([apiJson("/api/effects"), apiJson("/api/effects")]);
    assert.equal(count, 1);
    await apiJson("/api/effects"); assert.equal(count, 1);
    now += 15_001;
    await apiJson("/api/effects"); assert.equal(count, 2);
    await apiJson("/api/effects", { cache: "no-store" }); assert.equal(count, 3);
    for (const path of ["/api/identities", "/api/avatars/123", "/api/auth/me", "/api/models/avatar", "/api/billing/plan"]) {
      await apiJson(path); await apiJson(path);
    }
    assert.equal(count, 13);
  } finally { globalThis.fetch = fetchBefore; Date.now = nowBefore; }
});

test("failed catalogs are retried, mutations bypass cache", async () => {
  const before = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => ++calls === 1
    ? new Response(JSON.stringify({ error: "temporary failure" }), { status: 503 })
    : new Response(JSON.stringify({ templates: [] }));
  try {
    const { apiJson } = createApiClient("");
    await assert.rejects(apiJson("/api/effects"), /temporary failure/);
    await apiJson("/api/effects");
    await apiJson("/api/effects", { method: "POST" });
    assert.equal(calls, 3);
  } finally { globalThis.fetch = before; }
});
