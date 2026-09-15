# Models

Catalog of generation engines and where they show in the UI. Display names on the frontend may include premium labels; live backends are listed under **Backend**.

## Image

| UI name | Backend | Host | Product desk |
| --- | --- | --- | --- |
| Nano Banana 2 | OpenRouter Gemini image / Muse path | OpenRouter | Avatar · Images strip |
| Nano Banana Pro | Display catalog | — | Images strip |
| FLUX.2 Klein | `black-forest-labs/flux.2-klein-4b` | OpenRouter | **Avatar default** |
| Seedream 4.5 | ai33pro Seedream | ai33pro | Avatar |
| Krea 2 Turbo | Krea-2-Turbo fp8, 4 steps, cfg 1.0 | RunPod `i3fvrhucaici89` | Images strip · T2I |
| Qwen Image Edit | Qwen Edit 2511 fp8mixed, 20 steps | RunPod `ko6zewns6wj3mj` | Avatar · Images |
| Ideogram 3 | Display catalog | — | Images strip |

Worker repos: [Krea-2-Turbo](https://github.com/farhann-saleem/Krea-2-Turbo) · [Qwen-and-QwenEdit](https://github.com/farhann-saleem/Qwen-and-QwenEdit).

## Video

| UI name | Backend | Host | Notes |
| --- | --- | --- | --- |
| Seedance 1.5 Pro | OpenRouter fallback slug (optional) | OpenRouter | Catalog / documentary framing |
| Kling 3.0 | Display catalog | — | Videos · Effects strips |
| LTX-2.5 | Diffusers I2V, 20 steps | Modal H200 | Infra set; product route lock in STATUS |
| Hailuo 02 | Display catalog | — | Videos strip |
| Veo 3.1 | Display catalog | — | Videos strip |

Modal app: `apps/modal/ltx_video.py` (`marketing-studio-ltx`).

## Look / effects / stitch

| Capability | Engine | Host | UI |
| --- | --- | --- | --- |
| Identity into still/clip | FaceFusion 3.3.2 `inswapper_128` | RunPod CPU | Images · Videos · Effects **Generate** |
| Timeline export | ffmpeg stitch | RunPod CPU | Documentary **Assemble / Export** |

Worker: [Faceswap-and-FF](https://github.com/farhann-saleem/Faceswap-and-FF). User-facing copy says prompt generation — not “FaceFusion”.

## Documentaries (pipeline)

| Step | Model / service | UI control |
| --- | --- | --- |
| Script | OpenRouter `openai/gpt-4o-mini` | **New project** · Approve script |
| Scene footage | Framed as Seedance / Kling / LTX | **Approve & generate scenes** · Pick shot |
| Voice | ai33 / OpenSpeaker TTS | Narration voice · Assemble |
| Mix | Studio NLE + CPU stitch | **Assemble timeline** · Mix |

## Audio

| Desk | Vendor | UI |
| --- | --- | --- |
| TTS / Dialogue / Clone | ai33 OpenSpeaker | Audio tabs · **Generate** |
| Voice change / Translate / Isolate / STT | ai33 | Change tabs |
| Suno music / SFX | ai33 | Make tabs |

Monthly **audio credits** cap (Free 500): see plans in backend `plans.ts`.

## Avatar model picker (live providers)

| Button label | `provider` id |
| --- | --- |
| FLUX.2 Klein | `openrouter-flux` |
| Nano Banana 2 | `openrouter` |
| Qwen Image Edit | `qwen` |
| Seedream 4.5 | `ai33pro` |

## UI actions → API (generate)

| Button / action | Route |
| --- | --- |
| Generate avatar | `POST /api/avatars` |
| Generate look (images/videos/effects) | `POST /api/faceswaps` |
| Save identity | `POST /api/identities` |
| Audio generate | `POST /api/audio/{tts,sfx,music,…}` |
| New documentary | `POST /api/studio/projects` |
| Approve & generate scenes | `POST …/fetch-stock` |
| Assemble timeline | `POST …/assemble` |
| Checkout | `POST /api/billing/checkout` |

Measured costs: [COST.md](COST.md). Worker locks: sibling [MODELS.md](../../ms-runpod-krea/MODELS.md) files.
