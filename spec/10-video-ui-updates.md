# 10 — Drag clips; reject same-track overlap

**When:** with the admin timeline (after 04/09). Stitch/frontend.

The admin can drag a video segment left/right and move it up/down between tracks.

If the drop would overlap another clip **on the same track**, reject it (snap back, show a red state while dragging). Touching edges is OK.

Cross-track overlaps stay allowed (spec 09, higher track wins).

This is primarily frontend. Backend should still **enforce** same-track no-overlap on create/patch so the inspector cannot sneak an overlap the renderer then “fixes” with tie-breaks (the reference left that as a follow-up; we should not).
