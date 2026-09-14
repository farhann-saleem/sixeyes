# 16 — Frontend: Higgsfield-level dark UI (Stitch)

**When:** **Stitch at the end** (owner 2026-09-13). Does not block MVP Express. Destination look is Higgsfield; MVP source is `docs/sources/`.

The product must not look like a default shadcn demo. Finesse the UI so it is close to **Higgsfield**: **dark mode everywhere**.

This spec is **owned by the owner via Stitch**. Cursor does not restyle pages unless asked.

Scope: landing, auth, video/image/face-swap/library, avatars, templates, admin timeline, billing when it exists.

Do not copy Higgsfield assets **except** the owner-locked Effects catalog (Incline examples in `effects-template/`, 2026-09-13) and the landing wall in spec 17. Match the **feel** (dark, dense, cinematic media).

## Landing (copy + composition lock — 2026-09-13)

**Visual override (2026-09-14, owner):** live `/` is the Stitch Higgsfield clone in `stitch_higgsfield_ai_landing_clone/` (Kinetic Console + cream/midnight polarity). CTA **Start Creating** → `/projects`. Spec 17 R2 wall is not this slice.

The page is a **cinema lobby**. The wall is the product. Copy is tiny. Do not design a 8-section SaaS homepage. Live Higgsfield has become a promo dump (MCP, GPT-6, signup discount) — we clone the **Pixovid-era** Higgsfield: wall + remix + one button. Spec 17 fills the wall.

**Brand on the page**

| Slot | Copy |
| --- | --- |
| Logo | Marketing Studio |
| Eyebrow (small, over the wall) | Marketing Studio |
| Headline | **Imagine it. Then be in it.** |
| Tagline (under headline, smaller) | Your Imagination Engine |
| Primary CTA | **Start creating** → `/studio` |
| On a clip | **Remix** (opens that prompt in generate — Pixovid remix, not a new feature) |

Do not use “intelligence engine.” Locked tagline is **Imagination**.

**What stays (in this order)**

1. **Chrome.** Logo left. One button right: Start creating. Optional text links only: Video · Image · Audio. No Sign in. No Pricing. No Enterprise.
2. **Hero on the wall, not above it.** Overlay sits on muted autoplay clips. No separate white/dark band of marketing copy first.
3. **The wall (80% of the page).** Featured carousel + dense masonry. Category chips from the catalog: Viral / Sport / Game. Click a clip = Remix. Spec 17: catalog mp4s on R2, do not hotlink Higgsfield.
4. **One thin strip after the wall — only if you need scroll.** Four doors, one line each, then stop:
   - **Video** — still to motion
   - **Image** — generate or swap the face
   - **Avatar** — save a face, become the lead
   - **Audio** — voice and score
5. **Footer.** Domain + year. Nothing else.

**What does not stay**

How it works. Feature grids. Testimonials. Pricing. Login/signup as the hero. FAQ. Blog. Trusted-by. Model laundry list (Krea / LTX / Qwen / Seedream). Comparison vs Higgsfield. Lip-sync. Community / MCP / GPT / 3D-game promo. Anything we have not shipped.

**Alts if the headline feels long**

Keep the same page. Swap only the H1:

- **Your Imagination Engine** — sub: See a clip. Remix it. Put yourself in it.
- **See it. Remix it. You are in it.**
