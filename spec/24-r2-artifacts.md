# 24 — Artifacts on R2, served by presigned URL

**Kind:** decisions + requirements. **Phase:** D/E infra. **Owner GO:** 2026-09-14.

Move every generated artifact off the backend's local disk onto R2, and serve it with a short-lived
presigned URL instead of streaming bytes through Node.

Read first: [docs/DEPLOY.md](../docs/DEPLOY.md) (why hosting forces this), [docs/ENV.md](../docs/ENV.md).
Related: [22-video-studio.md](./22-video-studio.md), [02](./02-implement-image-and-faceswap.md).

---

## Implementation update — 2026-09-14

Stages 0–3 are wired. See [SECURITY-HARDENING.md](../docs/SECURITY-HARDENING.md) for implementation and verification. CPU swap/render outputs and Studio uploads redirect using existing keys; avatars, identities and all audio artifacts persist a payload `artifacts` manifest mapping local-relative filenames to R2 keys. Catalog/poster keys are verified before redirect. Every private read authorises first. Legacy media streams with Range support.

The manifest layout uses `artifacts/{existing-directory}/{id}.{suffix}` instead of the proposed per-kind nested layout below; existing worker/catalog keys remain unchanged. The migration script is `scripts/migrate-artifacts-to-r2.ts` (dry-run default, `--apply` to persist). Local cache stays during the rollout per the migration contract; Stage 4 purge is deliberately pending a full verified cycle. Do not remove local artifacts before migration.

The “current state” tables below describe the pre-change baseline and motivate the implementation.


## Why

Three separate problems, one fix.

1. **Memory.** Nine of the thirteen media handlers do `readFileSync(file)` then `res.send(...)`, which
   buffers the entire file per request. A swapped 720p clip measured **~17 MB**
   ([COST.md](../docs/COST.md)); a handful of concurrent downloads will OOM a 1 GB box. Only four sites
   stream via `sendFile`.
2. **Egress.** Every free or cheap host meters bandwidth — GCP's free VM allows **1 GB/month**, AWS 100 GB.
   **R2 egress is $0.** Serving media from R2 moves the entire media bill to a bucket we already pay for
   and makes host choice irrelevant.
3. **Statelessness.** Rows now live in Supabase, but files do not. Rebuild the box and the Library shows
   rows pointing at missing media. Fixing this is what makes the backend disposable.

## Non-goals

- Not a CDN or public bucket. Presigned URLs only — artifacts stay private and access stays authorised.
- Not moving the ffmpeg **scratch** directory. `ffprobe`/mp3-extract/mux need real local paths; keep a
  temp dir, just stop treating it as storage.
- Not changing the job model, quotas, metering or any vendor call.
- Not touching `scripts/cpu-timeline/` or CPU worker timeline v1. Separate track.

---

## Current state

### Local directories (all under `DATA_DIR` = `apps/backend/data`)

| Dir | Declared | Path helper |
| --- | --- | --- |
| `uploads/` | `store.ts:10` | `inputPath(id, ext)` `store.ts:137` |
| `outputs/` | `store.ts:11` | `outputPath(id, ext=".png")` `store.ts:141` |
| `identities/` | `identity-store.ts:9` | `identityPath(id, mime)` `identity-store.ts:35` |
| `studio-uploads/` | `studio-store.ts:13` | `studioUploadPath(id, ext)` `studio-store.ts:267` |
| `studio-renders/` | `studio-store.ts:14` | `studioRenderPath(id, ext=".mp4")` `studio-store.ts:272` |
| `studio-work/` | `studio-store.ts:15` | — (scratch, **keep local**) |
| `audio-uploads/` | `audio-store.ts:8` | `audioInputPath(id, ext)` `audio-store.ts:92` |
| `audio-outputs/` | `audio-store.ts:9` | `audioOutputPath(id, suffix=".mp3")` `audio-store.ts:96` |
| `video-posters/` | `templates.ts:9` | `ensurePoster()` `templates.ts:224` |

### Read sites (the egress + memory surface)

| Route | Site | Method |
| --- | --- | --- |
| image-template image | `index.ts:320` | `readFileSync` |
| video-template video | `index.ts:369-370` | `sendFile` |
| video-template poster | `index.ts:379` | `readFileSync` |
| effects video | `index.ts:392-393` | `sendFile` |
| effects poster | `index.ts:402` | `readFileSync` |
| faceswap face | `index.ts:470` | `readFileSync` |
| faceswap output | `index.ts:491` | `readFileSync` |
| identity image | `index.ts:552` | `readFileSync` |
| avatar input | `index.ts:679` | `readFileSync` |
| avatar output | `index.ts:694` | `readFileSync` |
| studio media | `studio-routes.ts:239-240` | `sendFile` |
| studio render | `studio-routes.ts:507-508` | `sendFile` |
| audio output | `audio-routes.ts:242` | `readFileSync` |

`audio-routes.ts:306` returns `job.transcript` as text — not media, leave it.

### Write sites

`swap-runner.ts:185`, `audio-runner.ts:314/320/325/330/349`, `project-workflow.ts:119`,
`project-stock.ts:145`, `templates.ts:193-197`, `identity-store.ts`, and multer's `upload.single("image")`
handlers in `index.ts`.

### What already exists

- `r2.ts` exports `r2Has`, `r2Put(key, body, contentType)`, `r2Get(key)`, `r2Del(key)`. **No presigning.**
- `templates.ts:295,306` already `r2Put`s catalog assets and rows already carry an `r2_key` field.
- **`swap-runner.ts:182-185` already has the R2 key.** The CPU worker returns `output_key`, we store it as
  `job.output_r2_key` — and then `r2Get` it and `writeFileSync` a local copy anyway.

---

## Target

```
produce artifact ──► r2Put(key) ──► store key on the row (Supabase)
                                          │
GET /api/…/output ──► authorise ──► presign(key, 5 min) ──► 302 redirect
                                          │
                                   browser fetches R2 directly   (egress: $0, Node: ~0 bytes)
```

### Key layout

```
artifacts/avatars/{jobId}/input.{ext}
artifacts/avatars/{jobId}/output.{ext}
artifacts/identities/{identityId}.{ext}
artifacts/faceswaps/{jobId}/face.{ext}          # outputs already exist at the worker's outputs/cpu/... key
artifacts/audio/{jobId}/output.mp3 | .alt.mp3 | .srt | .cover.jpg | .muxed.mp4
artifacts/studio/{projectId}/uploads/{id}.{ext}
artifacts/studio/{projectId}/renders/{id}.mp4
templates/{images|videos|effects}/{id}.{ext}     # catalog, already partly wired
templates/posters/{id}.jpg
```

Use the existing media bucket (`R2_BUCKET`), not the models bucket (`comfy`/`R2_MODELS_BUCKET`).

### Contract

- Row stores a **key**, never a URL. Presign at request time so nothing durable leaks a signed URL.
- Existing routes keep their paths and **302** to the presigned URL. No frontend change:
  `<img src="/api/avatars/x/output">` follows the redirect natively.
- Expiry **300s**. Long enough for a video to start, short enough to be useless if copied.
- Authorisation happens **before** presigning — the current `currentUser(req)?.email` ownership check is
  unchanged. A redirect must never be issued for a row the caller does not own.
- `r2Del` on delete. `DELETE /api/faceswaps/:id` already removes local files; it must remove the object.

---

## Work, in dependency order

### Stage 0 — presign helper

Add `@aws-sdk/s3-request-presigner` (matching the installed `@aws-sdk/client-s3` ^3.893.0). In `r2.ts`:

```ts
export async function r2SignedUrl(key: string, expiresIn = 300): Promise<string>
```

Built on the existing `r2()` client and `GetObjectCommand`. No new credentials — reuses `R2_*`.

### Stage 1 — faceswap outputs (do this first)

Highest value, least work: the key is **already on the row**.

- `swap-runner.ts:183-185` — delete the `r2Get` + `writeFileSync`. Keep `job.output_r2_key`.
- `index.ts:491` — presign `output_r2_key` and redirect.
- Removes a full download and a disk write per swap, and a 17 MB buffer per view.

### Stage 2 — catalog + posters

`r2_key` and the `r2Put` calls already exist at `templates.ts:295,306`.

- Upload posters alongside the catalog assets; store a `poster_r2_key`.
- Switch `index.ts:320, 369-370, 379, 392-393, 402` to presign + redirect, falling back to the local
  `abs_path` when a key is absent so a fresh checkout still works before the first upload.

### Stage 3 — avatars, identities, audio, studio

For each write site: `r2Put` the artifact, persist the key on the row, stop writing under `DATA_DIR`
(except scratch). For each read site: presign + redirect. Sites are listed in the two tables above.

`audio-runner.ts` writes five artifact kinds (`.mp3`, `.alt.mp3`, `.srt`, `.cover.jpg`, muxed `.mp4`) —
all five need keys. The mux at `:349` still needs local input files; write them to scratch, upload the
result, delete the scratch.

### Stage 4 — cut the read path over

- `DATA_DIR` keeps only `studio-work/` (ffmpeg scratch) and the Supabase-fallback JSON used by tests.
- Delete the now-unused dir constants and path helpers.
- Scratch gets cleaned on job completion **and** failure — mirror the `try/finally` the CPU worker uses.

---

## Migration

Existing rows have files on disk and no keys.

1. A one-shot script (`scripts/migrate-artifacts-to-r2.ts`) walks each store, and for any row with a local
   file and no key: `r2Put`, set the key, verify with `r2Has`, then leave the local file in place.
2. Read handlers prefer the key and **fall back to the local path** when it is null. Both paths work
   during migration; nothing 404s mid-rollout.
3. Delete local artifacts only after the fallback has been unused for a full cycle.

The script must be idempotent and safe to re-run — verify with `r2Has` before uploading.

---

## Env

No new names. Uses the existing `R2_ACCOUNT_ID`, `R2_ENDPOINT`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`,
`R2_BUCKET`. Optional `R2_SIGNED_URL_TTL` (default `300`) if a value other than 5 minutes is wanted —
add it to [ENV.md](../docs/ENV.md) only if actually introduced.

---

## Tests

Extend the existing backend suite; keep the file-JSON fallback working so tests need no R2.

| Test | Asserts |
| --- | --- |
| presign shape | `r2SignedUrl` returns an `https` URL carrying `X-Amz-Expires`, and does **not** contain the secret |
| ownership before redirect | a row owned by another email gets **404**, never a 302 |
| redirect not proxy | media routes answer **302** with a `Location`, and send **zero** body bytes |
| fallback | a row with a null key still serves from the local path |
| delete removes object | `DELETE /api/faceswaps/:id` calls `r2Del` and the object is gone |
| migration idempotent | running the script twice uploads once and changes no key |
| scratch cleaned | audio mux and studio prep leave no files behind on success or failure |

---

## Done when

- No media route reads a file into a Buffer to send it. `readFileSync`-then-`send` is gone from all nine
  sites.
- Rebuilding the host from a clean checkout loses **no** user artifact.
- `DATA_DIR` holds only ffmpeg scratch and test fallback JSON.
- Backend egress for a full documentary session is JSON-only, measured in kilobytes.

## Do not

- Make the bucket public, or store a presigned URL in a row or in Supabase.
- Presign before the ownership check.
- Put artifacts in the `comfy` models bucket.
- Move the ffmpeg scratch directory to R2 — `ffprobe` and the mux need real local paths.
- Break the local fallback before migration has run everywhere.
