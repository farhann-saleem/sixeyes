# Database Connection Pooling Guide

Date: 2026-09-18  
Database: Supabase Postgres  
Pooler: Supavisor / PgBouncer

---

## 1. Overview

Marketing Studio uses a dual-mode database access strategy:
- **Application Runtime (Express Backend)**: Connects via PostgREST HTTP service role client (`apps/backend/src/db.ts`). HTTP requests are stateless, multiplexed over keep-alive HTTPS connections, and require zero persistent connection slots in Postgres.
- **Direct Database Operations / CLI / Migrations**: Connects via Postgres connection strings specified in `.env`.

---

## 2. Port 6543 (Transaction Pooler) vs Port 5432 (Session Direct)

Supabase provides two distinct ports for Postgres access:

| Configuration | Port | Mode | When to Use |
| --- | --- | --- | --- |
| `DATABASE_URL` | `6543` | Transaction Pooling | High-concurrency serverless apps, background job workers, multiple backend instances. Releases connection to pool immediately after transaction finishes. |
| `DIRECT_URL` | `5432` | Session Direct | Running migrations (`supabase db push`, manual SQL DDL), schema alterations, prepared statements requiring session state. |

---

## 3. Recommended Production Environment Variables

In `.env`:
```bash
# Transaction Pooler (Port 6543 with pgbouncer=true query param)
DATABASE_URL="postgres://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct Session Connection (Port 5432 for migrations only)
DIRECT_URL="postgres://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

# PostgREST Service Key API (stateless connectionless pooling)
SUPABASE_URL="https://[PROJECT_REF].supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJ..."
```

---

## 4. Guardrails

1. Never run DDL migrations through transaction pooler port 6543 (PgBouncer in transaction mode does not support advisory locks or certain DDL locks; use direct port 5432 or the Supabase SQL Editor).
2. The stateless PostgREST client in `apps/backend/src/db.ts` eliminates the risk of connection starvation on node restarts.
