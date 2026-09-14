# Modal — LTX-2.5 video only

Full lock: [docs/MODAL.md](../../docs/MODAL.md). Starter: [docs/sources/MODAL_GUIDE.md](../../docs/sources/MODAL_GUIDE.md).

**Do not** put Krea/Qwen here.

Our app: **`marketing-studio-ltx`**. Volume: **`marketing-studio-ltx-models`** (empty on the new account until the first HF pull).

Weights: **not** R2 `comfy-models/ltx-2.5/` (Comfy **distilled**, slideshow). Not the old volume `avatar-ltx-models`.

Fast path: **H200** (B200 fallback), `.to("cuda")` no offload, 20 steps, `@modal.enter()`, 10 min `scaledown_window`, `local_files_only` against the volume. H100 offload is too slow (~20 min). App is **deployed**. Workspace budget **$25**.

```bash
source ../../.venv/bin/activate
modal profile current    # farhansaleem-342-g
```
