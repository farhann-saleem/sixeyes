# 17 — Landing page: Higgsfield catalog videos

**When:** phase D (copy mp4s to R2). Does **not** need LTX. Do not spend the $30 filling the wall.

Higgsfield’s landing works because it is a wall of generated video. Ours must look the same (`marketingstudioie.site`, spec 16).

## Owner lock (2026-09-12)

We **cannot** generate that many clips on our budget. Landing **uses the existing Higgsfield landing videos** (prompts, model labels, mp4s). Modal $30 is for product/demo later (LTX ~$3/hr), **not** for filling the landing wall.

Do not run Pixovid’s `generate-showcase.ts` (OpenRouter, paid). Do not scrape Higgsfield again if we can reuse Pixovid’s catalog.

## Source we already have

Pixovid already scraped this into [`landing_videos.json`](../landing_videos.json): names, prompts, model ids, categories, and `previewVideo` URLs on `cdn.higgsfield.ai`.

**When we implement:** copy that JSON into Marketing Studio. **Download the mp4s once onto Cloudflare R2** (owner lock). Do not hotlink `cdn.higgsfield.ai` in production. Do not ship them only as frontend `/public` files if R2 is the store.

Landing UI (Stitch): featured carousel + dense autoplay masonry, same categories (Viral / Sport / Game) as the catalog. Composition and copy: [16](./16-frontend-overhaul.md) § Landing. The wall is the page; do not add SaaS sections around it.

## Later (not landing)

Rent LTX on Modal (~$3/hr) to make **our** demo videos when we have GPU time. Those can replace or sit beside the catalog later. They do not block the landing.
