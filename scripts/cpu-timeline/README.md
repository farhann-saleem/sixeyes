# CPU timeline-v1 deployment artifact

The application uses `op=stitch` with an additive `timeline` field. All media processing runs inside the CPU worker. `timeline_stitch.py` preserves exact in-points, still durations, black gaps, text overlays, delayed/trimmed/mixed audio and canvas scaling. Legacy `clip_keys` stitch and swap remain unchanged.

Prepare against the current sibling worker **in a separate build context**, preserving concurrent edits:

```sh
mkdir -p /tmp/ms-cpu-timeline-build
cp ../ms-runpod-cpu/handler.py ../ms-runpod-cpu/facefusion_cpu.py ../ms-runpod-cpu/Dockerfile ../ms-runpod-cpu/requirements.txt /tmp/ms-cpu-timeline-build/
python3 scripts/cpu-timeline/install.py /tmp/ms-cpu-timeline-build
python3 -m unittest discover -s scripts/cpu-timeline -p 'test_*.py' -v
```

The tests inspect ffmpeg command construction and reject malformed payloads **without compiling a film on the laptop**. A real cloud smoke is required after deployment.

Current deployment discovered read-only 2026-09-13:

- Endpoint `rydclpv4ta6u4p`, template `is4vvli7a7`.
- GitHub build source `farhann-saleem/Faceswap-and-FF`.
- Image `registry.runpod.net/farhann-saleem-faceswap-and-ff-main-dockerfile:60f660e70`.
- Min workers 0, max 3 as found; no endpoint settings changed. Repo lock recommends max 1; do not silently change owner configuration as part of this patch.

Deploy the additive handler hook, new module and Docker COPY through that repository's existing build pipeline, with a new immutable image/build id. The installer fails if the expected source hook differs. Review the generated diff before applying to the worker repository. Preserve its FaceFusion startup, R2 configuration, network volume/DC, gate and secrets. Ping must report `timeline_version:1`, `ffmpeg:true`, `allow_generate:true` before the app submits timeline jobs. No models are invoked by ping or stitch; existing worker initialization is retained.

Sources: [RunPod template management](https://docs.runpod.io/sdks/graphql/manage-pod-templates), [existing owner CPU contract](../../docs/apis/runpod-cpu.md).
