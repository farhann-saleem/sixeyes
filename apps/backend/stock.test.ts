import assert from "node:assert/strict";
import { test } from "node:test";
import { PEXELS_PHOTO_SEARCH, PEXELS_VIDEO_SEARCH, stockUrlAllowed } from "./src/project-stock.js";

test("Pexels videos are not under /v1 (photos are)", () => {
  assert.equal(PEXELS_VIDEO_SEARCH, "https://api.pexels.com/videos/search");
  assert.equal(PEXELS_PHOTO_SEARCH, "https://api.pexels.com/v1/search");
  assert.equal(PEXELS_VIDEO_SEARCH.includes("/v1/"), false);
});

test("stock downloads allow Pexels and the Vimeo CDN Pexels uses", () => {
  assert.equal(stockUrlAllowed("https://videos.pexels.com/video-files/1/1.mp4"), true);
  assert.equal(stockUrlAllowed("https://images.pexels.com/photos/1/a.jpeg"), true);
  assert.equal(stockUrlAllowed("https://player.vimeo.com/external/1.hd.mp4?s=x"), true);
  assert.equal(stockUrlAllowed("http://videos.pexels.com/video-files/1/1.mp4"), false);
  assert.equal(stockUrlAllowed("https://cdn.higgsfield.ai/clip.mp4"), false);
});
