# Multi-user and deployment hardening — 2026-09-14

Owner requested deployment fixes, R2 media delivery, code inspection, and private data for each user.
This supersedes older “all GETs are public”, “MCP open”, “SPA serving not implemented”, and “R2 spec not implemented” handoffs.

## Shipped in code

- One Express origin serves the built SPA last. Deep links and `/callback` work; unknown API, `/mcp/…`, health and asset paths cannot return the SPA. `/mcp` is the setup page; `/api/mcp` is the JSON-RPC endpoint (legacy POST `/mcp` retained). Standalone clients still need a user session; the shared token alone never grants a user's identity.
- Private API GET **and HEAD**, mutations, lists, costs, media, and MCP calls require a Google session. Public catalog reads remain available. Private responses are `private, no-store` and vary by cookie. Owner filters remain on individual records; a foreign record returns 404.
- Studio validates library, audio and upload ownership on create-from, add, PATCH and export. Project-specific uploads/narration cannot be reused in another project.
- Audio cover and transcript handlers now check ownership before touching files. Shared vendor SFX/music history is no longer returned to users. Clone listings/use/deletion and dictionary listing/use/CRUD are scoped to the user. Legacy resources without an owner are not automatically assigned to anyone.
- Google state is bound to the initiating browser using an HttpOnly cookie; Google email must be verified. HTTPS sessions use Secure cookies. Malformed cookie escapes are ignored. Cross-origin writes are rejected. The frontend navigates through the callback so errors and the requested return path are preserved.
- Async Express 4 rejections reach a JSON error handler. Supabase calls time out and large store scans paginate. Production fails startup without Supabase, R2, Google config, HTTPS origin, the frontend build, or the hardening migration.
- `DATA_DIR` is honored. Process environment takes precedence over `.env`. The media bucket must be configured explicitly; there is no fallback to the model bucket.
- User mutations serialize within the **single Node process** to prevent concurrent quota-check/job-create and edit races. Faceswap quotas run **after multipart parsing**. MCP generation enforces rate/quota checks and records usage. SQL atomically increments usage and grants payment + marks an order paid in one transaction, preventing lost increments and partially granted payments.
- Jobs interrupted without a durable provider task ID become actionable failures instead of hanging or being automatically resubmitted. Known provider IDs resume polling. Restart while a vendor accepts a job but before its ID is saved remains an inherently ambiguous window; check the vendor queue before retrying.

## R2 and memory

CPU swap/render outputs retain the worker's key and are never downloaded merely for browser delivery. Studio uploads use their existing keys. Avatar inputs/outputs, saved identities and all audio artifacts use an `artifacts` key manifest **inside the existing row payload** (no artifact table required). Uploads are verified before a manifest is saved. Keys are durable; signed URLs are generated only after an ownership check, expire after 300 seconds, and return a bodyless 302. Download filenames are signed too.

Legacy files stream with range support. No media route uses `readFileSync` + `send`. Catalog files/posters are verified/uploaded on R2 before redirecting; unavailable catalog R2 objects fall back to the checkout. Studio/audio large HTTP uploads spool to scratch instead of memoryStorage. Audio provider submissions use file-backed blobs; audio result downloads stream through a 200 MB bound and atomically rename only complete files. Failed downloads remove temporary files. Export source uploads stream to R2.

Local artifacts are currently a **retained rollback/cache**, not yet purged. Missing avatar/identity/audio inputs can be restored from manifests; Studio exports use R2 keys directly. Audio input paths are rebased on restart for a new host. Follow spec 24's migration window before deleting local cache. Keep backups of legacy files until migration and a complete smoke cycle pass. This is not a claim that DATA_DIR is already scratch-only or that a 1 GB host has passed a load test.

## Database migration

`supabase/migrations/20260914160000_tenant_hardening.sql` enables RLS and revokes anon/authenticated table access. It creates owned dictionary metadata and backend-only atomic billing RPCs. Our Google sessions are **not** Supabase Auth JWTs, so browser RLS owner policies are not appropriate; the browser calls Express, and only Express uses the service role.

Owner ran the migration in SQL Editor during this task. Verified live: all 12 tables return service-role 200 and anonymous 401 on zero-row requests; `record_usage` exists and rejects an invalid kind before any write. No user rows were printed. Direct `psql` authentication failed with the configured password; the REST service-role path works.

Repeat the read-only permission check:

```bash
node apps/backend/scripts/verify-tenant-hardening.mjs
```

With a corrected direct DB password, the migration helper applies the SQL in a single transaction:

```bash
node apps/backend/scripts/apply-tenant-hardening.mjs
```

## Existing artifact migration

From the repository root:

```bash
node --import ./apps/backend/node_modules/tsx/dist/loader.mjs scripts/migrate-artifacts-to-r2.ts
node --import ./apps/backend/node_modules/tsx/dist/loader.mjs scripts/migrate-artifacts-to-r2.ts --apply
```

Live inventory on 2026-09-14 found zero rows in each configured Supabase artifact store; no existing Supabase artifacts needed migration.

Default is a count-only dry run. Apply is idempotent, skips active jobs, verifies uploads, updates row payloads, and leaves local files in place. Run on the server that holds the legacy media. It uses the configured store: it does not import abandoned local JSON into Supabase or guess ownership for pre-login jobs. Rows/files that exist only in an old local store require an explicit owner mapping before import.

## Verification and remaining operational checks

- 33 backend tests passed, including two-user HTTP isolation, GET/HEAD protection, cross-project references, signed redirects, local range responses, OAuth state, SPA exclusions, async failure handling, and fake-S3 migration/restore idempotence.
- Backend TypeScript and frontend build checked. Compatible dependency updates fixed the two `qs` parser advisories; npm audit then reported zero vulnerabilities. No paid generation, CPU worker deployment, live billing transaction, or server deployment was performed.
- Before reviewer traffic: build/deploy this code on the single origin, test real Google sign-in with two browsers/accounts, verify media seeking/downloads, and restart during a known-ID job. CPU timeline-v1 remains a separate worker deployment gate for documentary export.
- Single-process mutation serialization is intentional for the locked host. Do not start multiple PM2/cluster replicas without distributed quota reservations and project concurrency control.
