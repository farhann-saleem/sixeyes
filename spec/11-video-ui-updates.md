# 11 — Copy/paste linked clips + Premiere crop

**When:** with the admin timeline.

1. **Copy/paste video segments.** Copies stay **linked**: if one is updated or re-baked, the others show the same generated content. Position and crop stay per instance.
2. **Crop** like Premiere. Original generated `duration` is kept. Timeline and final render show only `[cropStart, cropEnd)`. The admin can expand the crop again later.

## Backend

- `cropStart`, `cropEnd`, `linkGroupId` on `TemplateBlock`.
- `POST …/blocks/:id/copy` clones content server-side (do not round-trip object keys through multipart create).
- Patch or bake of any member propagates shared content to the group; duration change re-clamps each member’s crop.
- Invariant, enforced server-side:  
  `endSec = startSec + ((cropEnd ?? duration) - cropStart)`  
  Never trust client `endSec`.

## Frontend

- ⌘/Ctrl+C / V and Copy/Paste buttons. Linked clips show a link affordance.
- Left/right trim handles. Inspector: “Using X of Ys (cropped)” + Reset crop.
- Crop/move drops respect spec 10 (same-track collision snap-back).
