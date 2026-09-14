import { assertProductionReady } from "./production.js";
import { initArtifactDirs, serveArtifact, restoreArtifact } from "./artifacts.js";
import "express-async-errors";
import path from "node:path";
import { installSpa, privateApi, serializeUserWrites, sameOriginWrites, errorHandler } from "./http.js";
import { resumeProjectOperations } from "./project-workflow.js";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import cors from "cors";
import express from "express";
import multer from "multer";
import { FRONTEND_URL, PORT, REPO_ROOT } from "./env.js";
import { AVATAR_PROMPT } from "./prompt.js";
import { getJob, inputPath, listJobs, outputPath, saveJob } from "./store.js";
import {
  getIdentity,
  identityForJob,
  identityPath,
  listIdentities,
  renameIdentity,
  saveIdentityFromJob,
} from "./identity-store.js";
import type { AvatarJob, AvatarProvider, SwapJob } from "./types.js";
import { cancelAvatarJob, resumeInFlightJobs, runAvatarJob } from "./runner.js";
import { qwenBlockedReason, qwenHealth } from "./providers/qwen.js";
import { ai33Credits, ai33Quote } from "./providers/ai33pro.js";
import { OPENROUTER_IMAGE_SPECS, openrouterKeyOk } from "./providers/openrouter.js";
import { cpuBlockedReason, cpuHealthCached } from "./providers/cpu.js";
import {
  ensureTemplatesOnR2,
  catalogR2Key,
  effectFromFilename,
  getEffectTemplate,
  getImageTemplate,
  getMediaTemplate,
  getVideoTemplate,
  labelFromImageFilename,
  labelFromVideoFilename,
  listEffectTemplates,
  listImageTemplates,
  listVideoTemplates,
  type VideoTemplate,
} from "./templates.js";
import { deleteSwapJob, getSwapJob, listSwapJobs, saveSwapJob } from "./swap-store.js";
import { cancelSwapJob, resumeInFlightSwapJobs, runSwapJob } from "./swap-runner.js";
import { extFromMime } from "./media.js";
import { r2Del, r2SignedUrl } from "./r2.js";
import { audioRouter } from "./audio-routes.js";
import { listAudioJobs } from "./audio-store.js";
import { resumeInFlightAudioJobs } from "./audio-runner.js";
import { studioRouter } from "./studio-routes.js";
import { mcpRouter } from "./mcp-rpc.js";
import { listRenders } from "./studio-store.js";
import { resumeInFlightStudioRenders } from "./studio-render.js";
import { attachUser, authRouter, currentUser, requireAuth } from "./google-auth.js";
import { billingRouter, swichWebhook } from "./billing-routes.js";
import { faceswapQuotaKind, postQuota, quotaGuard, rateLimitPost } from "./billing-guard.js";
import { recordUsage } from "./billing-store.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

initArtifactDirs();
export const app = express();
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: "12mb" }));
app.use(sameOriginWrites);
app.use(attachUser);
app.use(serializeUserWrites);

app.use("/api/auth", authRouter);

app.get("/api/webhooks/swich", swichWebhook);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "marketing-studio-backend", revision: process.env.DEPLOY_REVISION || null });
});

app.use("/api", privateApi);
app.use("/mcp", (req, res, next) => {
  if (req.method === "GET" && req.path === "/") return next();
  return requireAuth(req, res, next);
});

app.use("/api/billing", billingRouter);
app.use("/api/audio", rateLimitPost, audioRouter);
app.use(
  "/api/studio",
  rateLimitPost,
  postQuota((req) => {
    const body = req.body ?? {};
    if (typeof body.topic === "string") return "documentaries";
    if (body.from?.type === "library") return "videos";
    return null;
  }),
  studioRouter,
);
app.use("/mcp", (req, res, next) => req.method === "GET" ? next() : mcpRouter(req, res, next));
app.use("/api/mcp", mcpRouter);

app.get("/api/models/avatar", async (_req, res) => {
  let qwenHealthBody = null;
  let qwenBlock = null;
  try {
    qwenHealthBody = await qwenHealth();
    qwenBlock = qwenBlockedReason(qwenHealthBody);
  } catch (err) {
    qwenBlock = err instanceof Error ? err.message : String(err);
  }

  let quoted_credits: number | null = null;
  let credits_remaining: number | null = null;
  try {
    quoted_credits = await ai33Quote({ aspect_ratio: "16:9", resolution: "2K", assets: 1 });
    credits_remaining = await ai33Credits();
  } catch (err) {
    quoted_credits = null;
    credits_remaining = null;
    void err;
  }

  let orKey = { ok: false, error: "not checked" as string | null };
  try {
    orKey = await openrouterKeyOk();
  } catch (err) {
    orKey = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  const flux = OPENROUTER_IMAGE_SPECS["openrouter-flux"];
  const museSpec = OPENROUTER_IMAGE_SPECS.openrouter;

  res.json({
    prompt: AVATAR_PROMPT,
    models: [
      {
        id: "openrouter-flux",
        name: "FLUX.2 Klein 4B (OpenRouter)",
        kind: "i2i",
        default: true,
        notes: "Cheapest usable I2I after Muse. $0.014 / first megapixel at 1K. Photo as input_references.",
        blocked: orKey.ok ? null : orKey.error,
        catalog: { model: flux.vendor, listed_usd: flux.listed_usd, cap_usd: 1.5 },
      },
      {
        id: "openrouter",
        name: "Muse (OpenRouter meta/muse-image)",
        kind: "i2i",
        default: false,
        notes: "Cheapest on paper. Key can be valid while Meta still geo-blocks Muse.",
        blocked: orKey.ok
          ? "Muse: This model is not available in your region (OpenRouter forwarded Meta, job c960197e, 2026-09-13)."
          : orKey.error,
        catalog: { model: museSpec.vendor, listed_usd: museSpec.listed_usd, cap_usd: 1.5 },
      },
      {
        id: "qwen",
        name: "Qwen Image Edit 2511 (RunPod)",
        kind: "i2i",
        default: false,
        notes: "Self-host. 1024×1024, 20 steps, cfg 4.0. /run + poll.",
        blocked: qwenBlock,
        health: qwenHealthBody,
        catalog: {
          cold_s: 150,
          warm_s: "10-30",
          estimated_usd_warm: 0.03,
          usd_per_hour_assumed: 0.69,
        },
      },
      {
        id: "ai33pro",
        name: "ai33pro Seedream 4.5 (bytedance-seedream-4.5)",
        kind: "i2i",
        notes: "Owner said seedance 4.5. Vendor image id is Seedream 4.5. 16:9 2K + @img1.",
        quoted_credits,
        credits_remaining,
        catalog: {
          owner_estimate_credits: 800,
          live_quote_credits_2k: quoted_credits,
        },
      },
    ],
  });
});

app.get("/api/costs", async (_req, res) => {
  let quoted_credits: number | null = null;
  let credits_remaining: number | null = null;
  let quote_error: string | null = null;
  try {
    quoted_credits = await ai33Quote({ aspect_ratio: "16:9", resolution: "2K", assets: 1 });
    credits_remaining = await ai33Credits();
  } catch (err) {
    quote_error = err instanceof Error ? err.message : String(err);
  }

  let qwenHealthBody = null;
  let qwenBlock = null;
  try {
    qwenHealthBody = await qwenHealth();
    qwenBlock = qwenBlockedReason(qwenHealthBody);
  } catch (err) {
    qwenBlock = err instanceof Error ? err.message : String(err);
  }

  const email = currentUser(_req)?.email;
  const [avatars, swaps, audios, renders] = await Promise.all([
    listJobs(email),
    listSwapJobs(email),
    listAudioJobs(email),
    listRenders(undefined, email),
  ]);

  res.json({
    measured_on: "each job stores duration_ms + estimated_usd + credit_cost in data/cost-ledger.jsonl",
    qwen: {
      endpoint: "ko6zewns6wj3mj",
      usd_per_hour_assumed: 0.69,
      catalog_warm_usd: 0.03,
      catalog_cold_s: 150,
      health: qwenHealthBody,
      blocked: qwenBlock,
    },
    ai33pro: {
      model_id: "bytedance-seedream-4.5",
      owner_said: "seedance 4.5 ~800 credits",
      vendor_name: "Seedream 4.5",
      live_quote_credits_3x4_2k: quoted_credits,
      credits_remaining,
      quote_error,
      usd: "unknown — vendor bills credits. Do not invent a USD/credit rate.",
    },
    cpu: {
      endpoint: "rydclpv4ta6u4p",
      usd_per_hour_assumed: "worker RUNPOD_CPU_USD_PER_HR — often 0 if unset. Do not invent a rate.",
      catalog_still_s: 8,
      catalog_video_720p_30s: 456,
    },
    jobs: [
      ...avatars.map((j) => ({
        id: j.id,
        kind: "avatar",
        provider: j.provider,
        status: j.status,
        duration_ms: j.duration_ms,
        estimated_usd: j.estimated_usd,
        quoted_credits: j.quoted_credits,
        credit_cost: j.credit_cost,
        created_at: j.created_at,
      })),
      ...swaps.map((j) => ({
        id: j.id,
        kind: j.kind === "video" ? "faceswap-video" : "faceswap",
        provider: "cpu",
        status: j.status,
        duration_ms: j.duration_ms,
        estimated_usd: j.estimated_usd,
        quoted_credits: null,
        credit_cost: null,
        created_at: j.created_at,
      })),
      ...audios.map((j) => ({
        id: j.id,
        kind: `audio-${j.kind}`,
        provider: "ai33pro",
        status: j.status,
        duration_ms: j.duration_ms,
        estimated_usd: j.estimated_usd,
        quoted_credits: j.quoted_credits,
        credit_cost: j.credit_cost,
        created_at: j.created_at,
      })),
      ...renders.map((j) => ({
        id: j.id,
        kind: "studio-render",
        provider: "cpu",
        status: j.status,
        duration_ms: j.duration_ms,
        estimated_usd: j.estimated_usd,
        quoted_credits: null,
        credit_cost: null,
        created_at: j.created_at,
      })),
    ],
  });
});

app.get("/api/image-templates", async (_req, res) => {
  let health = null;
  let blocked = null;
  let r2 = { uploaded: [] as string[], skipped: [] as string[], error: null as string | null };
  try {
    r2 = { ...(await ensureTemplatesOnR2()), error: null };
  } catch (err) {
    r2.error = err instanceof Error ? err.message : String(err);
  }
  try {
    health = await cpuHealthCached();
    blocked = cpuBlockedReason(health);
  } catch (err) {
    blocked = err instanceof Error ? err.message : String(err);
  }
  res.json({
    templates: listImageTemplates().map((t) => ({
      id: t.id,
      kind: "image" as const,
      label: labelFromImageFilename(t.filename),
      filename: t.filename,
      bytes: t.bytes,
      mime: t.mime,
      r2_key: t.r2_key,
      image_url: t.image_url,
    })),
    r2,
    cpu: { blocked, health },
  });
});

app.get("/api/image-templates/:id/image", async (req, res) => {
  const t = getImageTemplate(req.params.id);
  if (!t) { res.status(404).json({ error: "template not found" }); return; }
  const key = await catalogR2Key(t, false);
  if (key) { res.status(302).setHeader("Location", await r2SignedUrl(key)); res.setHeader("Cache-Control", "no-store"); res.end(); return; }
  const file = t.abs_path;
  if (!file || !existsSync(file)) { res.status(404).json({ error: "file missing" }); return; }
  res.type(t.mime).sendFile(path.resolve(file));
});

function publicVideoTemplate(t: VideoTemplate) {
  return {
    id: t.id,
    kind: "video" as const,
    catalog: t.catalog,
    effect: effectFromFilename(t.filename),
    label: labelFromVideoFilename(t.filename),
    filename: t.filename,
    bytes: t.bytes,
    mime: t.mime,
    r2_key: t.r2_key,
    video_url: t.video_url,
    poster_url: t.poster_url,
    image_url: t.poster_url,
    duration_s: t.duration_s,
  };
}

async function cpuCatalogPayload(list: VideoTemplate[]) {
  let health = null;
  let blocked = null;
  let r2 = { uploaded: [] as string[], skipped: [] as string[], error: null as string | null };
  try {
    r2 = { ...(await ensureTemplatesOnR2()), error: null };
  } catch (err) {
    r2.error = err instanceof Error ? err.message : String(err);
  }
  try {
    health = await cpuHealthCached();
    blocked = cpuBlockedReason(health);
  } catch (err) {
    blocked = err instanceof Error ? err.message : String(err);
  }
  return { templates: list.map(publicVideoTemplate), r2, cpu: { blocked, health } };
}

app.get("/api/video-templates", async (_req, res) => {
  res.json(await cpuCatalogPayload(listVideoTemplates()));
});

app.get("/api/video-templates/:id/video", async (req, res) => {
  const t = getVideoTemplate(req.params.id);
  if (!t) { res.status(404).json({ error: "template not found" }); return; }
  const key = await catalogR2Key(t, false);
  if (key) { res.status(302).setHeader("Location", await r2SignedUrl(key)); res.setHeader("Cache-Control", "no-store"); res.end(); return; }
  const file = t.abs_path;
  if (!file || !existsSync(file)) { res.status(404).json({ error: "file missing" }); return; }
  res.type(t.mime).sendFile(path.resolve(file));
});

app.get("/api/video-templates/:id/poster", async (req, res) => {
  const t = getVideoTemplate(req.params.id);
  if (!t) { res.status(404).json({ error: "template not found" }); return; }
  const key = await catalogR2Key(t, true);
  if (key) { res.status(302).setHeader("Location", await r2SignedUrl(key)); res.setHeader("Cache-Control", "no-store"); res.end(); return; }
  const file = t.poster_path;
  if (!file || !existsSync(file)) { res.status(404).json({ error: "file missing" }); return; }
  res.type("image/jpeg").sendFile(path.resolve(file));
});

app.get("/api/effects", async (_req, res) => {
  res.json(await cpuCatalogPayload(listEffectTemplates()));
});

app.get("/api/effects/:id/video", async (req, res) => {
  const t = getEffectTemplate(req.params.id);
  if (!t) { res.status(404).json({ error: "template not found" }); return; }
  const key = await catalogR2Key(t, false);
  if (key) { res.status(302).setHeader("Location", await r2SignedUrl(key)); res.setHeader("Cache-Control", "no-store"); res.end(); return; }
  const file = t.abs_path;
  if (!file || !existsSync(file)) { res.status(404).json({ error: "file missing" }); return; }
  res.type(t.mime).sendFile(path.resolve(file));
});

app.get("/api/effects/:id/poster", async (req, res) => {
  const t = getEffectTemplate(req.params.id);
  if (!t) { res.status(404).json({ error: "template not found" }); return; }
  const key = await catalogR2Key(t, true);
  if (key) { res.status(302).setHeader("Location", await r2SignedUrl(key)); res.setHeader("Cache-Control", "no-store"); res.end(); return; }
  const file = t.poster_path;
  if (!file || !existsSync(file)) { res.status(404).json({ error: "file missing" }); return; }
  res.type("image/jpeg").sendFile(path.resolve(file));
});

app.get("/api/faceswaps", async (req, res) => {
  res.json({ jobs: await listSwapJobs(currentUser(req)?.email) });
});

app.get("/api/faceswaps/:id", async (req, res) => {
  const job = await getSwapJob(req.params.id, currentUser(req)?.email);
  if (!job) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json(job);
});

app.delete("/api/faceswaps/:id", async (req, res) => {
  const email = currentUser(req)?.email;
  const job = await getSwapJob(req.params.id, email);
  if (!job) {
    res.status(404).json({ error: "not found" });
    return;
  }
  if (job.status === "PENDING" || job.status === "IN_PROGRESS") {
    res.status(409).json({ error: "stop the swap before deleting it" });
    return;
  }
  for (const key of [job.face_r2_key, job.output_r2_key, ...Object.values(job.artifacts || {})]) {
    if (!key) continue;
    try {
      await r2Del(key);
    } catch (err) {
      res.status(503).json({ error: "Could not delete remote media; retry deletion" }); return;
    }
  }
  await deleteSwapJob(job.id, email);
  removeSwapFiles(job);
  res.json({ ok: true, id: job.id });
});

app.post("/api/faceswaps/:id/cancel", async (req, res) => {
  try {
    const owned = await getSwapJob(req.params.id, currentUser(req)?.email);
    if (!owned) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const job = await cancelSwapJob(req.params.id);
    res.json(job);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = message === "not found" ? 404 : message === "already completed" ? 409 : 400;
    res.status(code).json({ error: message });
  }
});

app.get("/api/faceswaps/:id/face", async (req, res) => {
  const job = await getSwapJob(req.params.id, currentUser(req)?.email);
  if (!job) {
    res.status(404).json({ error: "not found" });
    return;
  }
  await serveArtifact(res, job, inputPath(job.id, extFromMime(job.face_mime)), job.face_mime, undefined, req.query.download ? `marketing-studio-${job.id}${extFromMime(job.face_mime)}` : undefined);
});

app.get("/api/faceswaps/:id/output", async (req, res) => {
  const job = await getSwapJob(req.params.id, currentUser(req)?.email);
  if (!job || job.status !== "COMPLETED") {
    res.status(404).json({ error: "output not ready" });
    return;
  }
  await serveArtifact(res, job, outputPath(job.id, extFromMime(job.output_mime || "image/png")), job.output_mime || "image/png", job.output_r2_key, req.query.download ? `marketing-studio-${job.id}${extFromMime(job.output_mime || "image/png")}` : undefined);
});

app.get("/api/identities", async (req, res) => {
  res.json({ identities: await listIdentities(currentUser(req)?.email) });
});

app.post("/api/identities", async (req, res) => {
  const email = currentUser(req)?.email || "anonymous";
  const jobId = String(req.body.job_id || "").trim();
  const name = String(req.body.name || "").trim();
  if (!jobId) {
    res.status(400).json({ error: "job_id required" });
    return;
  }
  if (!name) {
    res.status(400).json({ error: "name required" });
    return;
  }
  const job = await getJob(jobId, email);
  if (!job || job.status !== "COMPLETED" || !job.output_mime) {
    res.status(400).json({ error: "completed avatar job required" });
    return;
  }
  const source = outputPath(job.id, extFromMime(job.output_mime));
  await restoreArtifact(job, source);
  if (!existsSync(source)) {
    res.status(404).json({ error: "output missing" });
    return;
  }
  const existing = await identityForJob(job.id, email);
  const row = await saveIdentityFromJob({
    id: existing?.id || job.id,
    name,
    job_id: job.id,
    mime: job.output_mime,
    source_file: source,
    owner_email: email,
  });
  res.status(existing ? 200 : 201).json(row);
});

app.patch("/api/identities/:id", async (req, res) => {
  try {
    res.json(await renameIdentity(req.params.id, String(req.body.name || ""), currentUser(req)?.email));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(message === "not found" ? 404 : 400).json({ error: message });
  }
});

app.get("/api/identities/:id/image", async (req, res) => {
  const row = await getIdentity(req.params.id, currentUser(req)?.email);
  if (!row) {
    res.status(404).json({ error: "not found" });
    return;
  }
  await serveArtifact(res, row, identityPath(row.id, row.mime), row.mime, undefined, req.query.download ? `marketing-studio-${row.id}${extFromMime(row.mime)}` : undefined);
});

app.post("/api/faceswaps", rateLimitPost, upload.single("image"), postQuota(faceswapQuotaKind), async (req, res) => {
  const email = currentUser(req)?.email || "anonymous";
  const templateId = String(req.body.template_id || "");
  const avatarId = String(req.body.avatar_id || "");
  const template = getMediaTemplate(templateId);
  if (!template) {
    res.status(400).json({ error: "unknown template_id" });
    return;
  }

  let faceBuf: Buffer;
  let faceMime: string;
  let faceName: string;
  if (avatarId) {
    const identity = await getIdentity(avatarId, email);
    if (!identity) {
      res.status(400).json({ error: "unknown avatar_id" });
      return;
    }
    const file = identityPath(identity.id, identity.mime);
    await restoreArtifact(identity, file);
    if (!existsSync(file)) {
      res.status(400).json({ error: "saved avatar file missing" });
      return;
    }
    faceBuf = readFileSync(file);
    faceMime = identity.mime;
    faceName = `${identity.name}${extFromMime(identity.mime)}`;
  } else {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "image file or avatar_id required" });
      return;
    }
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      res.status(400).json({ error: "use jpeg, png, or webp" });
      return;
    }
    if (file.size < 1024) {
      res.status(400).json({
        error: "That file is too small to be a face photo. Upload a real photo.",
      });
      return;
    }
    faceBuf = file.buffer;
    faceMime = file.mimetype;
    faceName = file.originalname || `face${extFromMime(file.mimetype)}`;
  }

  const id = randomUUID();
  const ext = extFromMime(faceMime);
  const filename = faceName.endsWith(ext) ? faceName : `${faceName}${ext}`;
  writeFileSync(inputPath(id, ext), faceBuf);

  const job: SwapJob = {
    id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: "PENDING",
    phase: "queued",
    phase_label: "Queued…",
    kind: template.kind,
    template_id: template.id,
    template_r2_key: template.r2_key,
    face_r2_key: `avatars/faceswap/${id}${ext}`,
    output_r2_key: null,
    face_mime: faceMime,
    face_filename: filename,
    output_mime: null,
    provider_job_id: null,
    error: null,
    duration_ms: null,
    estimated_usd: null,
    usd_per_hour_assumed: null,
    provider_meta: {},
    owner_email: email,
  };
  await saveSwapJob(job);
  await recordUsage(email, job.kind === "video" ? "videos" : "images");
  void runSwapJob(id);
  res.status(202).json(job);
});

app.get("/api/avatars", async (req, res) => {
  res.json({ jobs: await listJobs(currentUser(req)?.email) });
});

app.get("/api/avatars/:id", async (req, res) => {
  const job = await getJob(req.params.id, currentUser(req)?.email);
  if (!job) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json(job);
});

app.post("/api/avatars/:id/cancel", async (req, res) => {
  try {
    const owned = await getJob(req.params.id, currentUser(req)?.email);
    if (!owned) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const job = await cancelAvatarJob(req.params.id);
    res.json(job);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = message === "not found" ? 404 : message === "already completed" ? 409 : 400;
    res.status(code).json({ error: message });
  }
});

app.get("/api/avatars/:id/input", async (req, res) => {
  const job = await getJob(req.params.id, currentUser(req)?.email);
  if (!job) {
    res.status(404).json({ error: "not found" });
    return;
  }
  await serveArtifact(res, job, inputPath(job.id, extFromMime(job.input_mime)), job.input_mime, undefined, req.query.download ? `marketing-studio-${job.id}${extFromMime(job.input_mime)}` : undefined);
});

app.get("/api/avatars/:id/output", async (req, res) => {
  const job = await getJob(req.params.id, currentUser(req)?.email);
  if (!job || job.status !== "COMPLETED") {
    res.status(404).json({ error: "output not ready" });
    return;
  }
  await serveArtifact(res, job, outputPath(job.id, extFromMime(job.output_mime || "image/png")), job.output_mime || "image/png", undefined, req.query.download ? `marketing-studio-${job.id}${extFromMime(job.output_mime || "image/png")}` : undefined);
});

app.post("/api/avatars", rateLimitPost, quotaGuard("avatars"), upload.single("image"), async (req, res) => {
  const email = currentUser(req)?.email || "anonymous";
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "image file required (field name: image)" });
    return;
  }
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.mimetype)) {
    res.status(400).json({ error: "use jpeg, png, or webp" });
    return;
  }
  if (file.size < 1024) {
    res.status(400).json({
      error: "That file is too small to be a face photo (the 8×8 test square is 71 bytes). Upload a real photo.",
    });
    return;
  }
  const provider = String(req.body.provider || "openrouter-flux") as AvatarProvider;
  const allowedProviders: AvatarProvider[] = [
    "openrouter-flux",
    "openrouter",
    "qwen",
    "ai33pro",
  ];
  if (!allowedProviders.includes(provider)) {
    res.status(400).json({
      error: "provider must be openrouter-flux, openrouter, qwen, or ai33pro",
    });
    return;
  }
  const name = String(req.body.name || "").trim() || "Untitled avatar";

  const id = randomUUID();
  const ext = extFromMime(file.mimetype);
  const filename = file.originalname || `upload${ext}`;
  writeFileSync(inputPath(id, ext), file.buffer);

  const job: AvatarJob = {
    id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: "PENDING",
    phase: "queued",
    phase_label: "Queued…",
    suggest_provider: null,
    provider,
    name,
    prompt: AVATAR_PROMPT,
    input_mime: file.mimetype,
    input_filename: filename.endsWith(ext) ? filename : `${filename}${ext}`,
    output_mime: null,
    provider_job_id: null,
    error: null,
    duration_ms: null,
    estimated_usd: null,
    usd_per_hour_assumed: null,
    quoted_credits: null,
    credit_cost: null,
    credits_remaining: null,
    provider_meta: {},
    owner_email: email,
  };
  await saveJob(job);
  await recordUsage(email, "avatars");
  void runAvatarJob(id, inputPath(id, ext));
  res.status(202).json(job);
});

function unlinkQuiet(file: string) {
  try {
    if (existsSync(file)) unlinkSync(file);
  } catch {
    /* leftover files are not a failed delete */
  }
}

function removeSwapFiles(job: SwapJob) {
  unlinkQuiet(inputPath(job.id, extFromMime(job.face_mime)));
  if (job.output_mime) unlinkQuiet(outputPath(job.id, extFromMime(job.output_mime)));
  for (const ext of [".jpg", ".jpeg", ".png", ".webp", ".mp4", ".webm", ".mov"]) {
    unlinkQuiet(inputPath(job.id, ext));
    unlinkQuiet(outputPath(job.id, ext));
  }
}

installSpa(app, path.join(REPO_ROOT, "apps/frontend/dist"));
app.use(errorHandler);

await assertProductionReady();
if (process.env.NODE_ENV !== "test") app.listen(PORT, () => {
  console.log(`backend http://localhost:${PORT}`);
  void resumeInFlightJobs();
  void resumeInFlightSwapJobs();
  void resumeInFlightAudioJobs();
  void resumeInFlightStudioRenders();
  void resumeProjectOperations();
  void ensureTemplatesOnR2()
    .then((r) => console.log("r2 templates", r))
    .catch((err) => console.log("r2 templates failed", err instanceof Error ? err.message : err));
});
