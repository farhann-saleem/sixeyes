import assert from "node:assert/strict";
import { test, after } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHmac } from "node:crypto";
process.env.NODE_ENV = "test";
process.env.STUDIO_TEST_DATA_DIR = mkdtempSync(path.join(tmpdir(), "billing-tests-"));

const { TIERS, getTier, QUOTA_KINDS } = await import("./src/plans.js");
const {
  completeOrder,
  createOrder,
  effectiveTier,
  getBillingUser,
  getOrder,
  quotaOk,
  recordUsage,
  setTier,
  usageForMonth,
} = await import("./src/billing-store.js");
const { allowHit } = await import("./src/billing-guard.js");
const { callbackChecksum, checkoutChecksum, verifyCallback } = await import("./src/swichnow.js");

after(() => rmSync(process.env.STUDIO_TEST_DATA_DIR!, { recursive: true, force: true }));

test("tier table matches the owner pricing lock", () => {
  assert.deepEqual(TIERS.free.quotas, { avatars: 3, images: 10, videos: 3, documentaries: 20, audio: 500 });
  assert.deepEqual(TIERS.pro.quotas, { avatars: 30, images: 100, videos: 30, documentaries: 200, audio: 5000 });
  assert.deepEqual(TIERS.premium.quotas, { avatars: 300, images: 1000, videos: 300, documentaries: 2000, audio: 50000 });
  assert.equal(TIERS.free.rate_per_min, 6);
  assert.equal(TIERS.pro.rate_per_min, 30);
  assert.equal(TIERS.premium.rate_per_min, 60);
  assert.equal(TIERS.pro.price_usd, 20);
  assert.equal(TIERS.premium.price_usd, 150);
  assert.equal(TIERS.pro.price_pkr, 5600);
  assert.equal(TIERS.premium.price_pkr, 42000);
  assert.equal(getTier("pro")?.name, "Pro");
  assert.equal(getTier("nope"), null);
  assert.deepEqual(QUOTA_KINDS, ["avatars", "images", "videos", "documentaries", "audio"]);
});

test("usage counts against the free tier and blocks over quota", async () => {
  const email = "quota@test.dev";
  assert.equal(await effectiveTier(email), "free");
  assert.equal(await quotaOk(email, "avatars"), true);
  for (let i = 0; i < 3; i++) await recordUsage(email, "avatars");
  assert.deepEqual((await usageForMonth(email)).avatars, 3);
  assert.equal(await quotaOk(email, "avatars"), false);
  assert.equal(await quotaOk(email, "videos"), true);
});

test("pro tier raises quotas and expiry falls back to free", async () => {
  const email = "pro@test.dev";
  await setTier(email, "pro", 30);
  assert.equal(await effectiveTier(email), "pro");
  assert.equal(await quotaOk(email, "avatars"), true);
  for (let i = 0; i < 30; i++) await recordUsage(email, "avatars");
  assert.equal(await quotaOk(email, "avatars"), false);
  await setTier(email, "pro", -1);
  assert.equal(await effectiveTier(email), "free");
});

test("orders grant once and record swich order ids", async () => {
  const email = "buyer@test.dev";
  const order = await createOrder({ id: "tx-1", email, tier: "pro", amount_pkr: 5600 });
  assert.equal(order.status, "pending");
  await completeOrder("tx-1", "SW123");
  assert.equal((await getOrder("tx-1"))?.status, "success");
  assert.equal((await getOrder("tx-1"))?.order_id, "SW123");
  assert.equal((await getOrder("tx-1"))?.granted, true);
  await completeOrder("tx-1", "SW123");
  assert.equal((await getOrder("tx-1"))?.granted, true);
});

test("swich checkout and callback checksums match the documented HMAC formulas", () => {
  process.env.SWICHNOW_SECRET = "test-secret";
  const expected = createHmac("sha256", "test-secret").update("Swich:tx-9:MarketingStudioPro:5600").digest("hex");
  assert.equal(checkoutChecksum("tx-9", "MarketingStudioPro", 5600), expected);
  const cb = callbackChecksum("tx-9", "SW9", "5600", "success");
  assert.equal(
    createHmac("sha256", "test-secret").update("SWCallback:tx-9:SW9:5600:success").digest("hex"),
    cb,
  );
  assert.deepEqual(verifyCallback({
    CustomerTransactionId: "tx-9", OrderId: "SW9", Amount: "5600", Status: "success", Checksum: cb,
  }), { ok: true, customerTransactionId: "tx-9", orderId: "SW9", amount: "5600", status: "success" });
  assert.equal(verifyCallback({
    CustomerTransactionId: "tx-9", OrderId: "SW9", Amount: "5600", Status: "success", Checksum: "bad",
  }).ok, false);
  delete process.env.SWICHNOW_SECRET;
});

test("rate limit allows N hits per window then refuses with retry seconds", () => {
  const email = "burst@test.dev";
  const t0 = Date.now();
  for (let i = 0; i < 6; i++) assert.equal(allowHit(email, 6, t0 + i).allowed, true);
  const refused = allowHit(email, 6, t0 + 10);
  assert.equal(refused.allowed, false);
  assert.ok(refused.retry_after >= 1);
  assert.equal(allowHit(email, 6, t0 + 61_000).allowed, true);
});

test("unknown users read as free with empty usage", async () => {
  const row = await getBillingUser("fresh@test.dev");
  assert.equal(row.tier, "free");
  assert.equal(row.tier_expires_at, null);
  assert.deepEqual(await usageForMonth("fresh@test.dev"), { avatars: 0, images: 0, videos: 0, documentaries: 0, audio: 0 });
});

test("audio credits count separately and block at the free cap", async () => {
  const email = "audio-cap@test.dev";
  assert.equal(await quotaOk(email, "audio"), true);
  for (let i = 0; i < 500; i++) await recordUsage(email, "audio");
  assert.equal((await usageForMonth(email)).audio, 500);
  assert.equal(await quotaOk(email, "audio"), false);
  assert.equal(await quotaOk(email, "avatars"), true);
});
