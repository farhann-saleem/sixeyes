# Vendor API notes (owner-written)

These files are **source**. The owner pasted / wrote them. Read the matching file **before** wiring that vendor. Do not invent endpoints, headers, or prices from memory.

| File | Vendor | When |
| --- | --- | --- |
| [ai33pro.md](ai33pro.md) | ai33pro / OpenSpeaker (`ai33.pro` = `openspeaker.ai`) | Any TTS / clone / dub / changer / `xi-api-key`. Higgsfield Audio mapping: [../sources/FROM-HIGGSFIELD-AUDIO.md](../sources/FROM-HIGGSFIELD-AUDIO.md) |
| [openrouter.md](openrouter.md) | OpenRouter | Fallback image/video (`$1.50` cap). Avatar I2I via `/v1/images` + `input_references`: default **FLUX.2 Klein 4B**. Muse geo-blocked. OpenRouter Krea 2 Medium Turbo **removed** (identity miss, job `b46a91d6`). |
| [runpod-cpu.md](runpod-cpu.md) | RunPod CPU worker | FaceFusion `op=swap`, ffmpeg `op=stitch` |

Values stay in gitignored `.env`. Names: [ENV.md](../ENV.md).
