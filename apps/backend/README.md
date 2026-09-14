# Backend

TypeScript + Express. Jobs are **async** (row `IN_PROGRESS` → poll). Never block HTTP on a model.

```bash
cd apps/backend && npm install && npm run dev
```

Listens on `http://localhost:3001`. Loads repo-root `.env`. Local jobs in `data/` (gitignored).

**Now:** avatar MVP — `POST /api/avatars`, `GET /api/avatars/:id`, `GET /api/costs`. Specs [02](../../spec/02-implement-image-and-faceswap.md), [20](../../spec/20-generation-providers.md). Costs: [docs/COST.md](../../docs/COST.md).
