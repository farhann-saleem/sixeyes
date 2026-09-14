# 15 — User generate must re-render with the new avatar

**When:** with templates. Needs FaceFusion (phase B) + LTX (phase C) + ffmpeg stitch.

Bug to not ship: “Generate with my avatar” ignores the new avatar and just plays the original template video.

**Required pipeline**

1. Start a **long async job** (not a blocking HTTP request).
2. Re-generate **every video block** for this user (face-swap + video model with their avatar slots).
3. Stitch + mix audio + thumbnail.
4. Do **not** bake the same linked block twice for the same avatar (`linkGroupId` dedup).
5. Parallelise provider jobs where the provider allows (Pixovid used `Promise.all` with a concurrency cap). Keep a cap so we do not stampede Modal.

Uploaded (non-AI) video blocks stay as uploaded media — do not run them through the avatar/face-swap path (Pixovid rule; keep it).
