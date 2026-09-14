# DB package

Prisma schema (contract) + Supabase SQL migration. Production: **Supabase** Postgres.

Shared `GenerationStatus`: `PENDING` | `IN_PROGRESS` | `COMPLETED` | `FAILED` | `CANCELLED`. Do not rename that enum later (spec 01 / 03).

## Layout

| Path | Role |
| --- | --- |
| [prisma/schema.prisma](prisma/schema.prisma) | Prisma model mirror |
| [../../supabase/migrations/20260914120000_multi_user.sql](../../supabase/migrations/20260914120000_multi_user.sql) | Apply this in Supabase **SQL Editor** (or `psql "$DIRECT_URL" -f …`) |
| Backend runtime | PostgREST via `apps/backend/src/db.ts` (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) |

## Apply schema (owner)

1. Open Supabase → **SQL Editor** → New query.
2. Paste the contents of `supabase/migrations/20260914120000_multi_user.sql`.
3. Run. Confirm `profiles` appears under **Table Editor**.

Optional CLI (needs a working `DIRECT_URL` password):

```bash
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20260914120000_multi_user.sql
```

## Tables

`profiles`, `sessions`, `billing_orders`, `avatar_jobs`, `swap_jobs`, `audio_jobs`, `identities`, `studio_projects`, `studio_uploads`, `studio_renders`, `cost_ledger`.

Media binaries stay on disk / R2. RLS not relied on for MVP — service role only.
