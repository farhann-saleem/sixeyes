# 21 — Audio studio (ai33pro / OpenSpeaker)

Owner go 2026-09-13: ship the Higgsfield-like Audio tab **and** the extra OpenSpeaker tools on the same `AI33_API_KEY`. UX: function first, existing dark studio CSS. No login. No lip-sync claim. Endpoints only from [docs/apis/ai33pro.md](../docs/apis/ai33pro.md). Mapping: [docs/sources/FROM-HIGGSFIELD-AUDIO.md](../docs/sources/FROM-HIGGSFIELD-AUDIO.md).

## Product

One **Audio** nav tab. Modes:

| Mode | Vendor | Notes |
| --- | --- | --- |
| Text to Speech | `POST /v3/text-to-speech` | Script or SRT in `text`. Prefixed `voice_id`. Speed 0.5–1.5. Optional transcript + dictionary. |
| Voice Change | `POST /v1/task/voice-changer` | Audio in. Video: local ffmpeg extract → change → mux. Same picture. |
| Translate / dub | `POST /v1/task/dubbing` | MP3/M4A (extract from video if needed). `source_lang` default `auto`. `target_lang` required. `receive_url` required by vendor — send the documented example URL; **we poll**. Audio + SRT. Optional replacement `voice_id` (not Kokoro). No lip-sync. |
| Clone | `POST /v3/text-to-speech/voice-clone` | Sync. 3–30s, 10MB, consent required. Use as `clone_<id>`. |
| Dialogue | `POST /v3/text-to-speech/dialogue` | Min 2 speakers. `A>` / `B>` labels. |
| Dictionary | `/v3/dictionaries` CRUD + preview | Sync. Attach id on TTS/dialogue. |
| Isolate | `POST /v1/task/voice-isolate` | Audio in. |
| Speech to text | `POST /v1/task/speech-to-text` | Audio in. Persist vendor metadata + SRT if `srt_url`. |
| Sound effect | `POST /v1/task/sound-effect` | JSON. Model `eleven_text_to_sound_v2`. Omit duration = auto (200 credits). Else 50 credits/sec. |
| Suno music | `POST /v1s/task/music-generation` | `simple` or `custom`. Two clips possible. Wait for `status=done`; ignore stream URLs as final. |

UX: CapCut-style audio bin (cover preview, duration, **+** to use). Voices play catalog `preview_url` (**0 credits**). SFX/Suno have **no** vendor preview catalog — **+** copies a starter into Generate; Play only after a clip exists.

## How we run jobs

Same as Seedream: local job row, 202, poll `GET /v1/task/:id`, download `metadata.audio_url` (and documented extras), meter `credit_cost`. Stop → `POST /v1/task/delete`. Resume in-flight polls. Never resubmit a task that already has `provider_job_id`.

ffmpeg is **local** (`/usr/bin/ffmpeg` on this machine) for extract/mux only. Not the RunPod CPU stitch op. Laptop is fine for this audio mux because files are already in the API process.

## Limits

Clone 10MB. Other media 200MB (vendor cap). Text TTS max 1_000_000 chars.

## Honest copy in the UI

Translate / Voice Change on video: soundtrack only. Mouth will not match a new language.

## Shipped (2026-09-13)

Nav **Audio** → `/audio`. Backend `apps/backend/src/audio-*.ts` + `providers/ai33-audio.ts`. Local ffmpeg extract/mux. Job store `apps/backend/data/audio-jobs.json`.

| Method | Path |
| --- | --- |
| GET | `/api/audio/health` `/voices` `/voice-library` `/asset-library` `/jobs` `/jobs/:id` `/jobs/:id/output` `/alt` `/srt` `/transcript` `/cover` `/input` |
| POST | `/api/audio/tts` `/dialogue` `/clone` `/voice-change` `/dub` `/isolate` `/stt` `/sfx` `/music` `/jobs/:id/cancel` |
| CRUD | `/api/audio/dictionaries` + `/preview` |

Clone is **sync** (no poll). Everything else is 202 + poll. Stop → `POST /v1/task/delete`. Never resubmit a task that already has `provider_job_id`.
