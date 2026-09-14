# RunPod failures we already paid for

**Do not delete or thin this file.** Copy it onto every new endpoint (Qwen, CPU FaceFusion, ffmpeg, anything later). Sibling dumps (may contain secrets — do not copy keys): `../ms-runpod-krea/RUNPOD_LESSONS.md`, `../ms-runpod-qwen/RUNPOD_LESSONS.md`.

Live ids/DC: [STATUS.md](STATUS.md). Gates also in [CONTEXT.md](../CONTEXT.md). Env values stay in `.env`.

---

## Issue 1: Volume datacenter mismatch

**Symptom:** Workers stuck **Initializing**, no runtime logs, silent crash.

**Cause:** Volume was in `EUR-IS-3`, GPUs spawned elsewhere. RunPod cannot mount cross-DC. Fails silently.

**Fix:** Volume DC = endpoint Data Centers = **that DC only**. Live lock: **EU-RO-1**. Never “all datacenters” with a network volume. Attaching storage does **not** remount a running/paused worker.

**Verify:** ping → `volume_mounted: true`.

---

## Issue 2: PyTorch + ComfyUI type hints

**Symptom:** `ValueError: infer_schema(func): Parameter kernel_size has unsupported type list[int]`

**Cause:** ComfyUI v0.35.x `comfy_kitchen` uses `list[int]`. PyTorch 2.6 `torch.library.infer_schema` only accepts `typing.List[int]`.

**Fix:** Base image `pytorch/pytorch:2.7.0-cuda12.8-cudnn9-devel` (**not** 2.6). Check Comfy release notes before pinning.

---

## Issue 3: Missing gcc for Triton JIT

**Symptom:** `RuntimeError: Failed to find C compiler. Please specify via CC environment variable.`

**Cause:** Triton compiles CUDA kernels at runtime. `-runtime` and `-devel` images do not guarantee `gcc` on PATH.

**Fix:** `gcc g++ build-essential` + `ENV CC=gcc CXX=g++`. Any Triton image (Comfy, diffusers, vLLM) needs this.

---

## Issue 4: ComfyUI repo URL + unpinned HEAD

**Symptom:** `git clone` stale or 301.

**Cause:** `comfyanonymous/ComfyUI` redirects to `Comfy-Org/ComfyUI`. HEAD breaks weekly.

**Fix:** `git clone --branch v0.35.1 --depth 1 https://github.com/Comfy-Org/ComfyUI.git` — **always pin a tag**.

---

## Issue 5: Throttle after crashes

**Symptom:** `throttled=1` or `2` on health. No workers. Jobs queued forever.

**Cause:** Account-level exponential backoff. **Survives deleting the endpoint.**

**Fix:** Fix the crash first. New endpoint. `POST /v2/{id}/purge-queue`. Wait 10–15 min. **Never spam retries** on a broken handler.

---

## Issue 6: Cold start = Comfy on every request

**Symptom:** First request ~100s even with cached weights (`download_ms: 39`, `execution_ms: 98000`).

**Cause:** Comfy starts inside the handler. VRAM load + Triton ≈ 90s every cold job.

**Fix:** `ensure_weights()` + `ensure_comfy()` **before** `runpod.serverless.start()`. Worker stays Initializing longer; warm jobs ~5–10s.

---

## Issue 7: CLIPLoader type enum (Qwen)

**Symptom:** `Comfy queue 400: value_not_in_list — type: 'qwen2_5vl'`

**Cause:** CLIP `type` is a strict enum. Qwen is **`qwen_image`**, not `qwen2_5vl`. v0.35.x also includes `krea2`.

**Fix:** Never guess. `/object_info` or a known workflow JSON.

---

## Issue 8: Node input names ≠ UI labels

**Symptom:** `required_input_missing` for `prompt` / `strength` / `resolution_steps` after you passed `text` or omitted fields.

**Cause:** API names differ from widgets. Qwen examples: `TextEncodeQwenImageEditPlus` wants `prompt` not `text`; `CFGNorm` wants `strength`; `ImageScaleToTotalPixels` wants `resolution_steps`.

**Fix:** `/object_info/{node_type}` or official workflow. Do not hand-write graphs from memory.

---

## Issue 9: Qwen Edit needs specialized nodes

**Symptom:** Standard `CLIPTextEncode` → garbage edits.

**Cause:** Edit 2511 needs `TextEncodeQwenImageEditPlus` (CLIP + VAE + source image + prompt). Then `UNETLoader` → `ModelSamplingAuraFlow(shift=8.0)` → `CFGNorm(strength=1.0)` → KSampler.

**Fix:** Official workflow only. Do not swap in generic SD nodes.

---

## Issue 10: Old workers serve stale code

**Symptom:** New GitHub build, same error. Same worker id.

**Cause:** Running/paused workers keep the old image. FlashBoot pause does not pick up a new image or a newly attached volume.

**Fix:** Idle 5s, purge queue, stop old workers, confirm **new worker id** before trusting the fix.

---

## Issue 11: Disk full without a real volume

**Symptom:** `Errno 28` / `free_gb: 4.98`. ~5 GB rootfs.

**Cause:** Empty `/runpod-volume` directory is not a mount. `os.path.ismount` must be true. Huge container disk is wiped on scale-to-zero.

**Fix:** Network volume, same DC. Ping `free_gb` >> weights (Krea ≳ 22 GB, Qwen ≳ 35 GB).

---

## Dockerfile (battle-tested)

```dockerfile
FROM pytorch/pytorch:2.7.0-cuda12.8-cudnn9-devel

ENV PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    CC=gcc \
    CXX=g++ \
    COMFY_DIR=/workspace/ComfyUI

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git curl libgl1 libglib2.0-0 libx11-6 libegl1 libgles2 \
        gcc g++ build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --branch v0.35.1 --depth 1 https://github.com/Comfy-Org/ComfyUI.git ${COMFY_DIR} \
    && grep -vE '^(torch|torchvision|torchaudio)([=<>]|$)' ${COMFY_DIR}/requirements.txt > /tmp/comfy-req.txt \
    && pip install --no-cache-dir -r /tmp/comfy-req.txt \
    && pip install --no-cache-dir 'runpod>=1.10.1,<2' boto3 requests

WORKDIR /workspace
COPY handler.py /handler.py

CMD ["python", "-u", "/handler.py"]
```

`1.7.11–1.10.0` corrupts job tracking on network-volume endpoints — stay on `>=1.10.1`.

---

## Handler patterns

```python
print(">>> handler.py starting", flush=True)
# try/except every import; sys.exit(1) if runpod fails
ensure_weights()
ensure_comfy()
runpod.serverless.start({"handler": handler})
```

Ping still exists (`volume_mounted`, `free_gb`, `weight_root`). Cold ping pays GPU for init. `GET /health` does not start a GPU.

Generate via **`/run` + poll `/status/{id}`**, not `/runsync`. Execution timeout **600s** on first pull.

---

## Endpoint checklist

- [ ] Network volume in **EU-RO-1**
- [ ] Endpoint Data Centers = **EU-RO-1 only**
- [ ] GPU 24GB (Qwen may use 32GB Pro)
- [ ] Min 0, max 1
- [ ] Idle 5s (save money) or 60s+ (iterating)
- [ ] FlashBoot on — still recycle after rebuild/volume/DC change
- [ ] Execution timeout 600s (GPU) / ≥ 10 min (CPU swap/stitch)
- [ ] R2 env on the endpoint only: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_BUCKET`

---

## Debug (no secrets)

```bash
# Health — does not start a GPU
curl -s https://api.runpod.ai/v2/$ENDPOINT_ID/health \
  -H "Authorization: Bearer $RUNPOD_API_KEY"

# Ping
curl -s https://api.runpod.ai/v2/$ENDPOINT_ID/runsync \
  -H "Authorization: Bearer $RUNPOD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input":{"op":"ping"}}'

# Purge
curl -s -X POST https://api.runpod.ai/v2/$ENDPOINT_ID/purge-queue \
  -H "Authorization: Bearer $RUNPOD_API_KEY"

# Generate async — then GET /status/{JOB_ID}
curl -s https://api.runpod.ai/v2/$ENDPOINT_ID/run \
  -H "Authorization: Bearer $RUNPOD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input":{"op":"generate","prompt":"...","steps":4}}'
```

I2I image payloads: Python `image_b64`, not curl.

---

## What is live (ids only)

| Worker | Endpoint | DC | R2 prefix |
| --- | --- | --- | --- |
| Krea T2I | `i3fvrhucaici89` | EU-RO-1 | `comfy-models/krea2-turbo/` (~18 GB) |
| Qwen Edit | `ko6zewns6wj3mj` | EU-RO-1 | `comfy-models/qwen-image-edit-2511/` (~30 GB) |
| CPU FaceFusion + ffmpeg | `rydclpv4ta6u4p` | (check DC) | Still + video swap verified 2026-09-13. Models on worker volume (not assumed in `comfy` prefix). Stitch not smoked. |

Retired: `r59jmvkgw3a5m3`.

**Krea graph:** UNET fp8 + CLIP `krea2` + VAE + EmptySD3LatentImage + KSampler 4 steps, cfg 1.0, euler/simple. Warm ~10s, ~$0.002. Cold ~90s (Triton).

**Qwen graph:** CLIP `qwen_image` + `TextEncodeQwenImageEditPlus` + AuraFlow shift 8 + CFGNorm 1.0. 20 steps, cfg 4.0, 1024². Cold ~150s / ~$0.03. Warm ~$0.01 est.

**CPU (phase B):** same DC/volume/throttle/stale-worker rules. `op=swap` / `op=stitch`.

**CPU smoke (2026-09-13):** ping `facefusion_ready` + `allow_generate`. Still ~8s. Video was **4K 30s** locally; we sent **720p** (raw 4K frame reserve is huge). 720p/30s swap **~456s**, audio kept. Product 15s 720×1280 + `avatar.jpeg` (`1fab1e69`) **133.7s**. Looking-down / profile / **back-of-head** frames barely change — FaceFusion needs a front-ish face. `estimated_usd` was **0** (worker `RUNPOD_CPU_USD_PER_HR` unset). Health showed **3 idle** workers; lock is max 1. If RunPod is `COMPLETED` with `output_key` and our row is still `IN_PROGRESS`, the R2 download hung — restart the backend and **resume the same id**. Do not `/run` again.
