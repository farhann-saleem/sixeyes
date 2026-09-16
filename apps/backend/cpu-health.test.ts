import assert from "node:assert/strict";
import { test } from "node:test";
import { cpuBlockedReason } from "./src/providers/cpu.js";

test("mixed RunPod capacity does not block usable CPU workers", () => {
  for (const workers of [
    { idle: 4, ready: 4, throttled: 5, running: 0 },
    { idle: 6, ready: 6, throttled: 3, running: 0 },
    { ready: 1, throttled: 5 },
    { idle: 1, throttled: 5 },
  ]) {
    assert.equal(cpuBlockedReason({ workers }), null);
  }
});

test("throttling without available CPU workers retains the safety gate", () => {
  for (const workers of [
    { ready: 0, idle: 0, throttled: 3 },
    { throttled: 3 },
    { running: 1, initializing: 1, throttled: 3 },
  ]) {
    assert.match(cpuBlockedReason({ workers }) ?? "", /temporarily unavailable/);
  }
});

test("scale-to-zero CPU endpoints can still cold start without throttling", () => {
  assert.equal(cpuBlockedReason({ workers: { ready: 0, idle: 0, throttled: 0 } }), null);
  assert.equal(cpuBlockedReason({}), null);
});
