# 09 — Duration per model, multi-track, overlaps

**When:** with video UI + templates. Durations come from **LTX / the video provider**, not a guessed list. Pixovid’s 4/5/6/8/10 is a starting set **until** Modal says otherwise.

Some models only support certain durations (e.g. a model that only does 8s).

- Only show models that support the **selected duration**.
- Only allow a fixed duration set (Pixovid used 4, 5, 6, 8, 10 — keep that until Modal’s catalog says otherwise). Read `supported_durations` from the **video provider**, do not hardcode per model name.

## Timeline: overlaps

On the timeline, multiple **video tracks**. Example: generate 8s, only want the first 4s visually — put another block on a higher track overlapping that span.

**Rules (locked from Pixovid, they are the product)**

- Allowed durations: 4, 5, 6, 8, 10 unless the provider forces a smaller set.
- **Cross-track overlap allowed. Higher track wins** (fully replaces lower during the overlap).
- A block’s generated `duration` is what the model produces. Footprint on the timeline starts as that duration (spec 11 then adds crop, which changes footprint to cropped length).
- Dynamically add tracks.
- Same-track overlap is **rejected** (spec 10).

## Split

- Frontend: duration ↔ model filter on text-to-video **and** block inspector; multi-lane timeline; drag across time and tracks.
- Backend: persist `track` + `duration`; enforce `endSec` derived from duration (until crop); compositing must slice the timeline at block edges and pick the topmost clip per slice; gaps = black. Keep overlap resolution in a **pure function** (Pixovid `buildTimelineSegments`) so it can be unit-tested without GPUs.
