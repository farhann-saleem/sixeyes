  CPU Worker API — Endpoint rydclpv4ta6u4p

  Ping

  curl -s https://api.runpod.ai/v2/rydclpv4ta6u4p/runsync \
    -H "Authorization: $RUNPOD_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"input":{"op":"ping"}}'

  Face Swap (async)

  curl -s https://api.runpod.ai/v2/rydclpv4ta6u4p/run \
    -H "Authorization: $RUNPOD_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"input":{
      "op": "swap",
      "source_key": "inputs/scene.mp4",
      "target_face_key": "avatars/person.png"
    }}'
  # Returns: {"id": "...", "status": "IN_QUEUE"}
  # Poll: GET /v2/rydclpv4ta6u4p/status/{JOB_ID}
  # Result: {"ok": true, "output_key": "outputs/cpu/swap/<uuid>.mp4"}

  Stitch (async)

  curl -s https://api.runpod.ai/v2/rydclpv4ta6u4p/run \
    -H "Authorization: $RUNPOD_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"input":{
      "op": "stitch",
      "clip_keys": ["clips/a.mp4", "clips/b.mp4", "clips/c.mp4"],
      "audio_key": "audio/music.wav",
      "width": 1280,
      "height": 720,
      "fps": 30
    }}'
  # Result: {"ok": true, "output_key": "outputs/cpu/stitch/<uuid>.mp4"}

  Poll job status

  curl -s https://api.runpod.ai/v2/rydclpv4ta6u4p/status/{JOB_ID} \
    -H "Authorization: $RUNPOD_API_KEY"

  Product wire (2026-09-13): Images Templates, Video Templates, **and Effects** → `POST /api/faceswaps`. Backend uploads face + template to R2, then this `/run` payload. `source_key` is a still or an mp4. Library delete is `DELETE /api/faceswaps/:id` (local + R2 face/output; templates stay).

  Verified 2026-09-13 (still swap)

  - Ping: facefusion_ready, allow_generate
  - Still swap ~8s. Video 720p/30s ~456s. Product 15s 720×1280 (`1fab1e69`) 133.7s. Do not send 4K first.
  - Stitch: **wired** from `/studio` Export (first product smoke is that job). Not a separate admin-template smoke.
  - Back/side/looking-down frames barely swap
  - Test face this slice: repo-root `avatar.jpeg`

  Key rules

  - All inputs/outputs are R2 keys (bucket: comfy), never bytes or URLs
  - Use /run (async) not /runsync — CPU jobs take time
  - Swap: source = scene to edit, target_face = identity to paste in
  - Stitch: clips scaled/padded to canvas, concatenated, optional audio overlay
  - Supported: PNG/JPG/WebP images, MP4/MOV/MKV/WebM video
