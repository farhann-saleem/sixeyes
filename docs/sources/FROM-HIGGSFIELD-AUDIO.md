# Higgsfield Audio vs ai33pro (OpenSpeaker)

Researched 2026-09-13. UX source only — do **not** copy Higgsfield assets or hosted stack. Voice default is still **ai33pro**. Owner go: Audio studio shipped as [spec/21-audio-studio.md](../../spec/21-audio-studio.md).

Live Higgsfield studio: [higgsfield.ai/audio](https://higgsfield.ai/audio). Help: [lipsync / voiceover](https://higgsfield.ai/creator-hub/help-center/ai-models/how-do-i-use-lipsync-voiceover-and-aspect-ratios). Blog: [higgsfield-audio](https://higgsfield.ai/blog/higgsfield-audio), [ai-voice-tools](https://higgsfield.ai/blog/higgsfield-audio-ai-voice-tools).

ai33.pro **is** OpenSpeaker. Same `xi-api-key`, same 11 tools, API also documented at `https://api.openspeaker.ai`. Owner notes: [docs/apis/ai33pro.md](../apis/ai33pro.md). Public catalog: [openspeaker.ai/llms.txt](https://openspeaker.ai/llms.txt).

No generate calls were made. Read-only: Higgsfield UI, OpenSpeaker website + catalog, `GET /v1/health-check`, `GET /v1/credits`, `GET /v3/voices`.

---

## Higgsfield Audio (what the product actually is)

One Audio tab, three modes. Cloning is not a fourth tab — it is a voice source used by Voiceover / Voice Change.

| Mode (live UI) | Input | Output claim |
| --- | --- | --- |
| **Text to Speech** | Script (type `@` to attach). Optional upload: up to 3 voices/audios or an image. Model picker. Optional “voice details” prompt. Batch 1–4. | Speech from text. Preset or cloned voice. |
| **Voice Change** | Required: pick a preset/uploaded voice + **upload a video**. | Swap the speaker, keep delivery. |
| **Translate** | Required: **upload a video** + target language. | Dub + **lip-sync** the picture into that language. |

Live Translate language list (18): English, Chinese, French, Hindi, Italian, Japanese, Korean, Portuguese, Russian, Turkish, Spanish, German, Arabic, Polish, Indonesian, Filipino, Swedish, Finnish. Help center says 18; marketing pages still say “74+” — treat **18** as the studio list.

Clone (from the older how-to + help): record or upload MP3/WAV, speak clearly up to **2 minutes**, consent required. Help still says custom voices live under Add Voice.

Models shown in the Audio nav (live 2026-09-13):

| Model | Higgsfield pitch |
| --- | --- |
| Seed Audio 1.0 | Multi-speaker scenes + ambience (default in TTS) |
| Eleven v3 | Emotion / delivery via inline tags |
| Qwen Audio 3.0 | Natural speech; voice + style + emotion |
| MiniMax Speech 2.8 HD | High-fidelity single-voice narration |
| Seed Speech | Multilingual, 30+ languages |

Blog also mentions **VibeVoice** (long-form). It was **not** in the live Audio dropdown.

**Not in the Audio tab:** making a mouth move. That is **Lipsync Studio** under Video (Veo / Kling / Wan / Higgsfield Speak / Infinite Talk / Sync, etc.). Native audio co-generation is a **video model** pass (Seedance, Kling 3, Cinema Studio, …), not Audio. Higgsfield’s own FAQ: Audio = voice track; Video = talking face.

Honest Higgsfield limit from their later guide: no standalone music / SFX generator in Audio; ambience is bundled into Seed Audio multi-speaker.

---

## OpenSpeaker website = the same API key

Guest app [ai33.pro/app](https://ai33.pro/app) sidebar (2026-09-13):

**Voice tools:** Text to Speech, Text to Dialogue, Pronunciation Dictionary, Clone Voices, Auto Dubbing, Voice Changer, Voice Isolate.

**Also:** Speech to Text, Music 2, Sound Effect, Imagen 2, Pricing, Shared account, Affiliate, API Document.

TTS UI (guest): High quality vs low cost, ElevenLabs / MiniMax / Fish / Vbee, speed, pronunciation dictionary, AI expression tags (speed / pause / SFX / experimental), export transcript, SRT paste, one task at a time on free.

That website catalog is **exactly** the endpoints already in `docs/apis/ai33pro.md`. If we wrap those endpoints, we get the OpenSpeaker product, not a hidden extra API.

---

## Live key (read-only)

`GET /v1/health-check` **200**. Backends reported: `edge`, `suno`, `gemini`, `minimax`, `elevenlabs`.

`GET /v1/credits` **200**, **500000** (same as [COST.md](../COST.md)).

`GET /v3/voices` totals this session:

| `provider` | Voices |
| --- | --- |
| `edge` | 318 |
| `elevenlabs` | 17406 |
| `minimax` | 481 |
| `vbee` | 469 |
| `kokoro` | 54 |
| `fishaudio` | 50 |
| `clone` | **0** (none created on this account) |

Public OpenSpeaker catalog (2026-07-13) lists Kokoro as **not** an active website tool. The v3 voices endpoint still returns Kokoro ids. Prefer Edge / ElevenLabs / MiniMax / Vbee / Fish / clone for product. Dubbing replacement-voice path already excludes Kokoro in owner notes.

OpenSpeaker disclosure: High-quality TTS **labels** (ElevenLabs, MiniMax, …) are voice/reference sources. Synthesis may go through their bridge, not the named vendor’s own API. Dubbing / voice-changer / isolate / STT / SFX **are** named as ElevenLabs workflows.

---

## Can we match Higgsfield’s four jobs?

**Yes for the audio jobs. No for video lip-sync Translate.** Same `AI33_API_KEY`. Async create + poll, like Seedream.

| Higgsfield job | ai33pro endpoint | Fit |
| --- | --- | --- |
| Text to Speech | `POST /v3/text-to-speech` + `GET /v3/voices` | **Yes.** Script → mp3. Speed 0.5–1.5. Optional transcript + pronunciation dictionary. 1,000,000 chars / SRT up to 5h. Models are **not** Seed Audio / Qwen Audio / VibeVoice / Seed Speech. |
| Voice cloning | `POST /v3/text-to-speech/voice-clone` then `clone_<id>` | **Yes.** Sample **3–30s**, max **10MB**. Higgsfield how-to allows up to 2 min — shorter sample here. Consent still required. |
| Voice Change | `POST /v1/task/voice-changer` | **Audio yes, video no.** Input MP3/M4A/WAV, up to 5h / 200MB. Keeps performance, new voice. Higgsfield uploads a **video**. We would ffmpeg-extract → changer → mux back on the **CPU** worker. Picture does not change. |
| Translate | `POST /v1/task/dubbing` | **Audio yes, lip-sync no.** MP3/M4A only (OpenSpeaker: do not call this video dubbing). Auto source lang, ~30 targets, 1–9 speakers, audio + SRT. Optional replacement `voice_id` (+25% credits). Higgsfield Translate re-syncs **lips on the video**. That is Lipsync Studio / a talking-head video model — **not this key, not LTX I2V**. |

Multi-speaker TTS (Higgsfield Seed Audio “scene + ambience”) ≈ OpenSpeaker **Text to Dialogue** (`POST /v3/text-to-speech/dialogue`, speakers `A>`/`B>`…), not Seed Audio 1.0. No bundled room tone.

---

## OpenSpeaker extras Higgsfield Audio does not sell as that tab

Already on the website + API. Shipping them as product surfaces would be an **extra feature** unless the owner picks them.

| Tool | Endpoint | Notes |
| --- | --- | --- |
| Text to Dialogue | `/v3/text-to-speech/dialogue` | 2–26 speakers |
| Pronunciation Dictionary | `/v3/dictionaries` | Brand names |
| Voice Isolate | `/v1/task/voice-isolate` | Strip noise |
| Speech to Text | `/v1/task/speech-to-text` | SRT / JSON |
| Sound Effect | `/v1/task/sound-effect` | ElevenLabs T2S v2. **No** GET preview catalog. |
| Suno Music 2 | `/v1s/task/music-generation` | Two clips / run. **No** GET preview catalog. |
| Imagen 2 | `/v1i/task/generate-image` | Already used for Seedream avatars |

Higgsfield Audio explicitly does **not** have standalone music/SFX. We *could* add them from this key; that is more than Higgsfield’s Audio tab, not less.

---

## What Higgsfield has that this key cannot do

- Lip-sync / talking-head video (Lipsync Studio, Speak, Infinite Talk, Kling lipsync, …).
- Native audio **inside** a video generate (Seedance / Kling 3 / Cinema Studio).
- Generate audio first, then drive Seedance/Kling/Cinema motion from that clip.
- Higgsfield’s Seed Audio / Qwen Audio / VibeVoice / Seed Speech models.
- Video-in / video-out Voice Change or Translate in one vendor call.

Our LTX lock is still **I2V 5s from a still**. It does not consume a voice track as a lip-sync driver. Do not promise Higgsfield Translate on LTX.

---

## Assignment recommendation (not a build go)

Already locked: Voice = ai33pro `VoiceProvider`. Template stitch = ffmpeg on CPU. CONTEXT already says “ffmpeg stitch + ai33pro bed later.”

**Same as Higgsfield Audio, with this key, without a new vendor:**

1. **TTS Voiceover** — script + voice library (start with Edge for cheap / MiniMax or ElevenLabs-labeled for quality). This is the the reference product bed.
2. **Clone** — one consented sample → reusable `clone_` id for that identity.
3. **Voice Change / Translate as audio** — extract soundtrack, call changer or dubbing, mux. Output is the same picture, new voice / language. Captions from dubbing `srt_url`.

**Do not claim** in the assignment: “upload a talking video and it lip-syncs in Japanese.” That needs a lipsync video model we did not lock.

**Do not invent** a full OpenSpeaker clone (Suno, isolate, SFX, dialogue studio) as the extra feature unless the owner chooses it.

Wire like Seedream: job row, `POST` create, poll `GET /v1/task/:id`, meter `credit_cost`, Stop → `POST /v1/task/delete`. Do not block HTTP on the model. Do not spend the Modal $25 on TTS.

---

## Possible website surfaces (owner menu, 2026-09-13)

Not a lock. Extra feature still unchosen. the reference MVP (image, video, swap, avatars, templates, landing, credits) is already the assignment — this list is **what else this key + ffmpeg can add**.

**Higgsfield-like Audio tab (same key):** TTS, clone, voice change (audio or video-mux), translate/dub (audio + SRT, no lip-sync), multi-speaker dialogue, pronunciation dictionary.

**OpenSpeaker extras (same key, not Higgsfield Audio):** voice isolate, speech-to-text, sound effects, Suno music.

**Combos with our stack:** TTS bed on template stitch; clone tied to an identity; extract→dub/change→mux on a clip; burn-in captions from SRT; isolate then clone.

**Already on the site / lock (not new):** Krea T2I, Qwen I2I, FaceFusion still/video swap, LTX I2V, Seedream avatars, OpenRouter FLUX/Krea, ffmpeg stitch, credits, later login/pay.

**Cannot add with this key / this video lock:** lip-sync talking video, native audio inside LTX, Higgsfield Seed Audio / Qwen Audio / VibeVoice / Seed Speech.

---

## Pages visited

- https://higgsfield.ai/audio
- https://higgsfield.ai/text-to-speech
- https://higgsfield.ai/voice-cloning
- https://higgsfield.ai/ai-video-translator
- https://higgsfield.ai/blog/higgsfield-audio
- https://higgsfield.ai/blog/higgsfield-audio-ai-voice-tools
- https://higgsfield.ai/creator-hub/help-center/ai-models/how-do-i-use-lipsync-voiceover-and-aspect-ratios
- https://ai33.pro/app
- https://openspeaker.ai/ + `/llms.txt` + `/api/catalog.json` + `/api-guide.txt` + service pages for TTS / clone / dubbing / voice-changer
