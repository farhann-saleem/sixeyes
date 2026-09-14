# 07 — Template follow-ups (avatar slots + timeline preview)

**When:** with spec 04. No spec 08; bake-per-block lives here + spec 14.

Changes on top of 04:

1. When creating the template, the admin selects **one or two of their avatars** as the avatars used during template generation.
2. When creating a video block, the admin picks **Avatar 1** or **Avatar 2** as the reference image. Face-swap start/end still only picks which avatar slot — **no per-block face upload** (that would make the template non-generic). Admin still uploads the block’s base start/end frames.
3. The admin can **play the timeline and preview**, like Premiere (program monitor + play/pause/stop + scrub).

## Also in this slice (from Pixovid 07/08, 08 file missing)

- **Bake a single block** to a preview clip (`videoKey` on the block). Export must reuse baked clips (spec 14).
- Large audio uploads (hundreds of MB) must return a clean 400, not crash.

## Split

- Stitch/frontend: setup form (name, 1–2 admin avatars, audio), timeline playhead/monitor, block inspector with avatar slot + face-swap toggles, bake + export buttons that poll job status.
- Backend: `Template.avatarIds` / `avatarSlots`; blocks reference `avatarSlot` only; bake job; export job; 200 MB audio limit.
