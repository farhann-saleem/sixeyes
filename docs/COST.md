# Job costs (metered)

Do **not** invent pack prices. Every generate writes `duration_ms`, `estimated_usd` (when the vendor gives USD), and `credit_cost` (ai33pro) to `apps/backend/data/cost-ledger.jsonl` (gitignored). This file is the **catalog**. Measured rows stay on disk until we derive PKR later (spec 19).

Checked live **2026-09-13**. No keys in this file.

## Avatar (MVP)

User uploads one face photo. Locked prompt in `apps/backend/src/prompt.ts`. Output = identity-reference portrait.

| Provider | What we call | Vendor id | How billed | Catalog / live quote |
| --- | --- | --- | --- | --- |
| **openrouter-flux** | FLUX.2 Klein 4B | `black-forest-labs/flux.2-klein-4b` | **~$0.014 / first MP** (OpenRouter `$1.50` cap) | Default Avatar I2I. Photo as `input_references`, 1K 3:4. First product: job `876f7ef5` + `avatar-full.png` **COMPLETED** **11.8s** **$0.016** 768×1024 JPEG. |
| **openrouter-krea** (removed) | Krea 2 Medium Turbo | `krea/krea-2-medium-turbo` | **$0.0175** with 1 ref | Same locked prompt + `avatar-full.png` as Flux. Job `b46a91d6` **COMPLETED** **12.6s** **$0.015** 928×1152 PNG — **wrong person**. Owner removed from picker 2026-09-13. Do not add back. |
| **openrouter** | Muse I2I | `meta/muse-image` | **$0.01 / image** | Job `c0254d47` **FAILED** `API key expired` (1.3s, not billed). New key GET `/key` **200** (limit $2 / remaining $2). Job `c960197e` + `avatar-full.png` **FAILED** `This model is not available in your region` (2.0s, not billed). Do not retry Muse from this IP. |
| **qwen** | Qwen Image Edit 2511 | RunPod `ko6zewns6wj3mj` | GPU-seconds × **$0.69/hr** (worker `USD_PER_HOUR`) | Warm ~10–30s ≈ **$0.03**. Cold ~150s more. Worker returns `estimated_usd`. |
| **ai33pro** | Seedream 4.5 | `bytedance-seedream-4.5` | Vendor **credits** | Owner said ~**800**. Live `POST /v1i/task/price` (3:4, 2K, 1 asset) = **986** credits. Same 986 for 1:1 / 16:9 / 0 assets. |

Owner said “seedance 4.5”. On ai33pro, **Seedance is not in `/v1i/models`**. Image model is **Seedream**. We did not invent a Seedance image id.

ai33pro account `GET /v1/credits` today: **500000**. No published USD-per-credit in `docs/apis/ai33pro.md`. Do not invent one. Store credits only.

### Qwen health at lock time

`GET /v2/ko6zewns6wj3mj/health` earlier: `throttled: 2`. Later the same day: `throttled: 0`, `ready: 2`. Lock: **do not generate while throttled > 0**.

### First measured Qwen job (2026-09-13)

Not a real face — 8×8 smoke PNG. **Do not treat as product quality.**

| Field | Value |
| --- | --- |
| status | FAILED |
| error | `TimeoutError: Comfy timed out after 300s` (worker queue timeout) |
| duration_ms | 327561 (~5.5 min) |
| estimated_usd | ~$0.063 at $0.69/hr |
| cause | We skipped **ping**. Health does not start a GPU. Min workers 0 → dashboard empty. Cold generate did Comfy init + 20 steps inside the handler’s 300s queue. |

Fix (2026-09-13): health (stop if `throttled > 0`) → **ping `/run`** (wake, `volume_mounted` / `comfy_up` / `free_gb`) → generate immediately (idle can be 5s).

### What we record per job

- `duration_ms`
- `estimated_usd` + `usd_per_hour_assumed` (Qwen)
- `quoted_credits` (price endpoint before generate)
- `credit_cost` (task `credit_cost` after done)
- `credits_remaining` (before and after when possible)
- `status` / `error`

API: `GET /api/costs`.

## Audio (ai33pro / OpenSpeaker)

Same `AI33_API_KEY` as Seedream. Vendor bills **credits** (`credit_cost` on the task). No USD/credit rate in owner notes — do not invent one. SFX: omit duration = **200** credits; specified duration = **50 credits/sec** (min 50). Dubbing replacement voice = **+25%** rounded up. Suno returns up to two clips; wait for `status=done` (ignore `stream_url` as final).

Jobs: `apps/backend/data/audio-jobs.json` (gitignored). Ledger rows use `provider: ai33pro` and `kind: audio-*` on `GET /api/costs`.

## Face swap (Images + Video Templates + Effects)

User face + a still from `image-template/` **or** a clip from `video-template/` **or** an Incline clip from `effects-template/`. Click the look, then add the face or a saved avatar; the original stays and the swap appears beside it. RunPod CPU `rydclpv4ta6u4p`, `op=swap`. Catalog still **~8s** when warm. Catalog video **720p/30s ~456s**. Incline clips are **~7s h264 720**. Worker `estimated_usd` is **0** unless `RUNPOD_CPU_USD_PER_HR` is set — do not invent a rate. Inputs/outputs are R2 keys on bucket `comfy`. Test face this slice: `avatar.jpeg`.

First product still (2026-09-13): job `eb39b6c5` onto `13-22-29`. Worker `ek31s3i4ilca5y`. `duration_ms` **6315**. `estimated_usd` **0** (rate unset).

Module smoke (2026-09-13, warm worker `ek31s3i4ilca5y`): stills land **6.2–8.1s** `duration_ms` across 7 jobs. End-to-end wall time is ~10–20s because the wake/ping and R2 round trips sit outside `duration_ms`. All **$0** metered — the rate is still unset, so do not read these as free.

First product video (2026-09-13): job `1fab1e69` onto the 15s handheld iPhone clip (`1789107624825-…`). Face `avatar.jpeg`. Worker `o80qcwgdte97ic`. `duration_ms` **133701** (~134s). `estimated_usd` **0** (rate unset). Output `video/mp4` ~17MB. A first R2 download hung on the live Node process; restart + 120s GetObject abort finished the same RunPod id — do not resubmit.

## Not this slice

Krea, LTX generate, ffmpeg stitch, OpenRouter, SwichNow packs. Still meter those when they ship.


## Seedream delay investigation — 2026-09-13

Existing avatar job `cb2e3e7d-4ee6-49cc-9ef1-09eaaf7d4231` submitted `10:02:57Z`; vendor task `8235f308-2678-4bb7-8a63-2e726c65adf9`. Vendor stayed `doing`, `progress: null`, `credit_cost: 986`, no output URL, `updated_at` still `10:02:59Z`. Same task — no second generate.

Fix (same day): resume **polls the saved task id only**. Each poll writes `vendor_status` / `vendor_progress` / `vendor_polled_at` / `vendor_updated_at` / poll count. UI labels our clock vs vendor last-said. Poll window for Seedream is **30 min** while the vendor is still `doing`. A local timeout does not prove refund; inspect the original task before retrying.

That Seedream job’s upload is the **8×8 / 71-byte smoke PNG**, not `62cabeaa` (1878×881 JPEG). Done images are `metadata.result_images[].imageUrl` (owner docs 2026-09-13). Qwen `throttled` is now **3** — do not generate on Qwen.

Stop (2026-09-13): `POST /api/avatars/:id/cancel` marks `CANCELLED`, calls ai33pro `POST /v1/task/delete`. Do not promise a credit refund.

Seedream still `doing` with `progress: null` and frozen `updated_at` on the phone JPEG (task `447731c4-…`, short `@img1` prompt, 16:9 2K). Wrapper submit + poll are fine. Vendor has not written `result_images`. Balance **499014** (one 986 hit). Keep polling; do not submit another until this one leaves `doing`.

## Projects documentary

Pexels stock: $0 API content (quota applies). OpenRouter text: small text-completion cost, typically cents; actual returned `usage.cost` stored as `script_cost_usd`, no image generation. ai33pro narration uses existing TTS credits and Audio job accounting. Export charges RunPod CPU stitch plus storage/transfer; worker returns `duration_ms` and estimated cost (zero if hourly rate unset, not proof of free compute). No GPU B-roll or automatic FaceFusion.
