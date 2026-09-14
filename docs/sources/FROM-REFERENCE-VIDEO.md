# Extracted from the Higgsfield-clone walkthrough

Source: [`pixovid-walkthrough.md`](pixovid-walkthrough.md)  
Video: [I Recreated Higgsfield From Scratch in 2 Hours](https://www.youtube.com/watch?v=LuCXiNxZ1Dw)  
Who: the person who shipped **Pixovid** (`pixovid.com`), the reference repo next to this one.

This is a **product + process** goldmine. It is **not** our stack. Reuse the UX, the spec workflow, and the pitfalls. Do not copy OpenRouter-as-default, MinIO, Razorpay, DigitalOcean K8s, or blocking HTTP generation.

---

## What they actually cloned

Opening joke is HeyGen. The product is **Higgsfield** (he says Hicksfield / Hixfeld / XField). Variation on top:

1. **Simple wrapper** — prompt in, video/image out. People pay for convenience instead of going to Gemini.
2. **Long-form templates** — 30s–10min “movies” / song videos. Models only do 5–10s, so an admin stitches clips on a Premiere-like timeline. User uploads an avatar and becomes the lead.

That second part is their “one step further.” **Marketing Studio already includes it** as core Pixovid surface (specs 04–07, 14). Do not invent a different extra feature from this video.

---

## Screens they walked (Stitch target)

| Screen | Behavior |
| --- | --- |
| Landing | Higgsfield wall of videos. **Remix** = open that clip, tweak prompt/avatars, generate a close cousin. |
| Video | Model picker, prompt, duration, aspect, **start frame + end frame**, optional refs. History of past videos. |
| Image | Same wrapper, later tab. |
| Face swap | Base image + face image. Also: cinematic still → swap → use as **first frame of a video**. |
| Avatars | User uploads a face. Templates bind **avatar 1 / avatar 2**, never a fresh upload per block (otherwise the template is not generic). |
| Admin `/admin/template/create` | Premiere timeline. **One audio track.** Blocks = time range + prompt + optional start/end stills + optional face-swap on start and/or end. Play/preview. Snap to markers. **Bake / rebake** per block. |
| User templates | Gallery. Pick template + own avatar → generate. Users never see the admin editor. |
| Credits / pay | Last. Three packs. Debit on image, video, template. Template costs more than video; image cheapest. |

Landing wall: they **did not regenerate** Higgsfield’s catalog. They copied prompts/model/videos so they would not burn credits. We already locked that as `landing_videos.json` → R2 (spec 17). Do not hotlink `cdn.higgsfield.ai`.

---

## How they built (process we already follow)

- Empty bun Turborepo first. Specs in `spec/` before code. Agent is Devin; human is orchestrator.
- V1 = video only, **everything free**. Then image + face-swap. Then templates. Then UI haul + credits + landing. Deploy last.
- Dummy video server (same clip every time) so local work does not spend GPU money.
- Hard features (FaceFusion, OpenRouter keys, DB) stay **local**. Cloud agents could not reach those.
- UI + payments were parallel cloud jobs. Timeline was the longest conversation; UI/credits were “one-shots.”
- **Building the actual Durandal template took ~24 hours.** Coding the editor was easier than making one good template. Budget time for that, or ship with 0–1 templates.

---

## Pitfalls they paid for (do not re-learn)

1. **Sync generate** — they knew webhooks/async were needed (30s–2min) and deferred it. Pixovid 504s. **We start async.**
2. **Object-store URLs** — backend talks to MinIO as `minio:9000`; browser must see `localhost:9000`. Split internal vs public endpoint. Our analogue is R2 public / signed URLs, not MinIO.
3. **Bake reuse** — export must skip already-baked `videoKey`s. Otherwise every export re-spends generation.
4. **Face-swap both frames** — if start *and* end swap, two different people both become the user. Per-frame checkbox. Do not swap extras.
5. **Local FaceFusion keeps structure** (beard, skull). Identity change needed **Flux 2** on OpenRouter. We do **not** default Flux; FaceFusion laptop is the swap. Paid identity swap is optional later, not the $1.50 default.
6. **Thumbnails** — not an FFmpeg screenshot. AI thumbnail from timeline prompts.
7. **FFmpeg on the API process** — they wanted to split it out. Template stitch should be a worker, not the HTTP box.
8. **Prompt length** — OpenRouter rejected a remixed Higgsfield prompt. Validate length on our backend even if LTX is the default.
9. **Content filtered** — bake can 200-fail with “filtered”; confirm we were not charged. Surface that error in the job row.
10. **OAuth on rename** — new domain needs new Google redirect URIs. Same when we go to `marketingstudioie.site`.
11. **Sandbox payments** — dummy Razorpay let anyone mint credits. SwichNow sandbox will do the same. Production keys last.
12. **FaceFusion off the main cluster** — they put it on a separate $96 droplet so K8s would not melt. We use laptop Docker; do not park a GPU pod.
13. **Credits should be model-based.** They shipped flat costs and said that was wrong. When we do billing: debit by provider + duration, not one number per “video.”

---

## Numbers from the video (their spend, not ours)

| Thing | What they said |
| --- | --- |
| Calendar | ~3 days ideation → live. Video is ~2 hours. First Devin V1 ~25 min. Image+swap iteration ~25 min. |
| OpenRouter while filming | ~$30 on the key; prod later ~$50. |
| Testing they expected | $50–$200 just to try models. |
| One template export (Durandal-class) | ~**$6** cost, charge ~**$10**. Full render “less than 6 hours.” |
| Kling / Veo smoke | Kling “expensive.” Veo 3 Pro ~**$1 for ~2s**; UI showed 60 credits. |
| INR packs | ₹1000 / ₹3000 / ₹8000. **We are PKR / SwichNow. Ignore these prices.** |
| FaceFusion prod | Separate heavy machine, ~$96. **We do not copy this.** |
| Object store | MinIO local, DigitalOcean Spaces prod. **We use R2.** |
| Domain | pixovid.com. App was first named Video Arena. |

---

## What Marketing Studio copies vs rejects

**Copy**

- Higgsfield-like screens: landing remix, video with start/end frames, image, face-swap, avatars, admin timeline, user “generate with my avatar.”
- Spec-driven slices. Dummy provider for $0 local.
- Bake-per-block + FFmpeg stitch of baked clips.
- Catalog videos on the landing, not generated on our credits.
- Face-swap as a still pipeline that can feed I2V.

**Reject (already locked in CONTEXT.md)**

- OpenRouter as the default generator (ours: Modal LTX + RunPod Qwen/Krea; OpenRouter is option + fallback).
- Blocking the HTTP request until the model returns.
- MinIO / DO Spaces / K8s / Razorpay / INR.
- $96 FaceFusion droplet.
- Scraping Higgsfield at runtime.
- Shipping login + pay before the product works.

---

## Build order they used (matches our priority)

1. Video generate (free, no credits UI).
2. Image + face-swap.
3. Templates (admin bake, user generate-with-avatar).
4. Landing wall (copied catalog).
5. UI polish.
6. Credits + payments.
7. Domain / OAuth / deploy.

Login last, payment last — already owner lock. Dummy generate server belongs in slice 1 so we can click the UI without burning Modal.
