# 14 — Export must not re-generate already-baked clips

**When:** with templates. Export reuses bake; user “generate with my avatar” must **not** (spec 15).

Export is wasteful if it re-runs Modal/RunPod for blocks that already have a baked `videoKey`.

**Rule:** export (admin) uses baked clips from DB/R2. Only unbaked blocks get a generation job.

User “generate with my avatar” is the opposite case — see 15 (must re-generate with the new face). Do not “optimize” that path by reusing the admin’s baked video.
