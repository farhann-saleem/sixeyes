# Backend

TypeScript + Express. Async job rows and polling; production uses Supabase metadata and private R2 media. Express serves the built frontend on the same origin.

```bash
npm ci
npm run typecheck
npm test
npm run dev
```

For production, build `apps/frontend`, set the documented environment, apply both Supabase migrations, then run `npm start` as one process. Production startup validates prerequisites. `.env` stays at the repo root and never belongs in git; process environment takes precedence. `DATA_DIR` defaults to `apps/backend/data` and remains a rollback cache until legacy migration is verified.

Private reads and writes require Google login and owner-scoped records. Public catalogs remain browseable. Private media redirects to expiring R2 URLs; legacy files stream with Range support.

See [deployment](../../docs/DEPLOY.md), [multi-user hardening and tests](../../docs/SECURITY-HARDENING.md), [environment names](../../docs/ENV.md), and [artifact migration](../../spec/24-r2-artifacts.md). CPU timeline-v1 export deployment is a separate gate.
