# 13 — Timeline editor fixes (crop, context menu, snap, drag)

**When:** with the admin timeline. Bugs to prevent (the reference hit all four):

1. Cropping: cursor changes but drag does not shorten the clip in the UI.
2. Right-click on the timeline is hijacked: Copy, Paste, Delete (not the browser menu).
3. Create a new block from the **current playhead** exactly. No coarse 0.5s-only grid. If the pointer is close to the playhead, snap to it.
4. Drag must work horizontally and vertically (between tracks).

## Inherited root cause (read 18)

Window `pointermove` / `pointerup` handlers that close over non-memoized parent callbacks get **detached on the first re-render** (select-on-pointer-down). Handlers must be stable and read refs. Ignore `e.button !== 0` so right-click does not start a drag.

Precision: raw px→seconds + snap to playhead (~8px), else a fine 0.1s grid. Snap crop edges in **timeline space**, then derive crop.

No backend/schema change for this spec.
