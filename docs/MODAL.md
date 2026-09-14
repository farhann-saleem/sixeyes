# Modal LTX lock (Marketing Studio)

Read [sources/MODAL_GUIDE.md](sources/MODAL_GUIDE.md) first (your starter). Failures we already paid: [sources/FROM-AUTOMATION.md](sources/FROM-AUTOMATION.md). Goldmine working **code**: `avatar-docs/modal/ltx_video.py`. Port it. Do not assume that old workspace still exists.

Our app name: **`marketing-studio-ltx`**.

## Account (2026-09-13): start fresh

Workspace **`farhansaleem-342-g`**. CLI profile of the same name is **active**. `.env` `MODAL_TOKEN_*` synced from `~/.modal.toml`. Old profile `chaudaryfarhann` is still on disk but unused.

Old volume **`avatar-ltx-models` is not on this account.** Do not look for it.

App **`marketing-studio-ltx` is deployed.** Volume cache **is on disk**. Secrets `huggingface` + `r2-credentials` exist. First HF pull already done (~11.5 min). `local_files_only=True` when that cache is present.

Never paste `token_id` / `token_secret` into chat or markdown.

## Do we use R2 `comfy-models/ltx-2.5/`?

**No.** It is on R2 (~70 GB) but it is the **Comfy distilled** pack:

- `diffusion_models/ltx-2.5-22b-distilled-transformer-bf16.safetensors` (42 GB)
- Gemma text encoder + video/audio VAEs

That is a ComfyUI graph. Distilled sigma / cfg 1.0 **freezes motion** (slideshow). Product video is Diffusers `LTX2ImageToVideoPipeline` from **`Lightricks/LTX-2.5-Diffusers`**.

## After first time: make clips fast

Guide §7.1 + goldmine contract:

1. `@app.cls` + `@modal.enter()` — load pipeline **once**.
2. `scaledown_window=10 * 60` — stay warm ~10 min between jobs (idle = $0 after that).
3. `HF_HUB_CACHE=/models` on **`marketing-studio-ltx-models`**. `from_pretrained(..., local_files_only=True)` once the cache exists so a cold start **reads disk**, not Hugging Face.
4. **GPU: H200 (fallback B200), `.to("cuda")`, no offload.** H100 80GB OOMs (~76.7 GiB). Sequential offload was **1233s** for 5s. H200 20-step smoke: **72s** (~2.8s/step). Do **not** call `enable_vae_slicing()`.
5. Never return mp4 bytes over Modal RPC. Write volume / R2, return a **key**.
6. After image/code change: `modal app stop marketing-studio-ltx --yes` then redeploy (warm boxes keep old code).
7. `scaledown_window`, not `container_idle_timeout`. `CloudBucketMount`, never `mount-s3`.
8. Do **not** walk `Path(__file__).parents[2]` at import — Modal mounts the file at `/root/ltx_video.py`. Load `.env` only when `modal.is_local()`.

Measured 2026-09-13:

| Path | GPU | Steps | Generate |
| --- | --- | --- | --- |
| Sequential offload | H100 80GB | 30 | **1233s** (~40s/step) |
| Full `.to("cuda")` | **H200** 141GB | **20** | **72s** (~2.8s/step) |

Lock the H200 / 20-step / no-offload path. App default: `gpu=["H200", "B200"]`.

Workspace metered **2026-09-13: $3.22** (credits covered; billed $0). Almost all of it was H100: 21 min offload clip **$1.46**, first HF pull + OOM **~$0.80**, crash-loops **~$0.60**. Successful H200 72s clip **~$0.25**.

## Before any GPU run

Workspace budget **$25** (owner 2026-09-13; was $30). https://modal.com/settings/usage

## Paid failures this account (do not repeat)

- Wikimedia seed URL → HTTP 403. Use a local JPEG.
- Import-time `parents[2] / ".env"` → crash-loop. GPU billed while looping.
- `.to("cuda")` on H100 80GB → OOM after the 72 GB pull. Cache stayed on the volume.
- 30s YouMind brief + studio portrait (2026-09-13): LTX ran 5s. **Did not** become a travel vlog. Start frame won; extra hands on 16:9 letterbox. `modal volume get` can DNS-fail (`clobber.modal-storage.com`); copy volume → R2.
