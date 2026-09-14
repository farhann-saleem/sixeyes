import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createTopicProject } from "./project-workflow.js";
import { getProject, listProjects } from "./studio-store.js";
import { getIdentity, identityPath, listIdentities } from "./identity-store.js";
import { getSwapJob, listSwapJobs, saveSwapJob } from "./swap-store.js";
import { inputPath } from "./store.js";
import { extFromMime } from "./media.js";
import { runSwapJob } from "./swap-runner.js";
import { cpuBlockedReason, cpuHealthCached } from "./providers/cpu.js";
import {
  effectFromFilename,
  getMediaTemplate,
  labelFromImageFilename,
  labelFromVideoFilename,
  listEffectTemplates,
  listImageTemplates,
  listVideoTemplates,
} from "./templates.js";
import type { SwapJob } from "./types.js";

export type McpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export const MCP_TOOLS: McpTool[] = [
  {
    name: "list_templates",
    description: "List Marketing Studio image, video, or effect looks. Use the returned id with generate_look.",
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["image", "video", "effect"], description: "Catalog to list. Default image." },
      },
    },
  },
  {
    name: "list_identities",
    description: "Saved avatars. Pass avatar_id to generate_look instead of uploading a face.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_library",
    description: "Completed stills and clips already in the library.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_films",
    description: "Documentary projects. Films with in_library also appear on /library.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "create_documentary",
    description:
      "Start a documentary: topic → script (async). Stock is Pexels after the script is approved in the app. No GPU B-roll.",
    inputSchema: {
      type: "object",
      required: ["topic"],
      properties: {
        topic: { type: "string", description: "What the film is about. Max 2000 characters. Subject only — not model instructions." },
        name: { type: "string", description: "Optional project name." },
        duration_sec: { type: "number", description: "Film length: 30, 45, 60 (default), or 90." },
        in_library: { type: "boolean", description: "Also list the film in Library. Default true." },
      },
    },
  },
  {
    name: "get_film",
    description: "One documentary project: phase, status, topic, scene count.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: { id: { type: "string" } },
    },
  },
  {
    name: "generate_look",
    description:
      "Generate a still or clip from a catalog look plus a saved identity. Async. Poll get_generation. FaceFusion is internal.",
    inputSchema: {
      type: "object",
      required: ["template_id", "avatar_id"],
      properties: {
        template_id: { type: "string" },
        avatar_id: { type: "string" },
      },
    },
  },
  {
    name: "get_generation",
    description: "Poll a generate_look job.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: { id: { type: "string" } },
    },
  },
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

async function enqueueLook(templateId: string, avatarId: string): Promise<SwapJob> {
  const blocked = cpuBlockedReason(await cpuHealthCached());
  if (blocked) throw new Error(blocked);
  const template = getMediaTemplate(templateId);
  if (!template) throw new Error("unknown template_id");
  const identity = getIdentity(avatarId);
  if (!identity) throw new Error("unknown avatar_id");
  const file = identityPath(identity.id, identity.mime);
  if (!existsSync(file)) throw new Error("saved avatar file missing");
  const id = randomUUID();
  const ext = extFromMime(identity.mime);
  writeFileSync(inputPath(id, ext), readFileSync(file));
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
    face_mime: identity.mime,
    face_filename: `${identity.name}${ext}`,
    output_mime: null,
    provider_job_id: null,
    error: null,
    duration_ms: null,
    estimated_usd: null,
    usd_per_hour_assumed: null,
    provider_meta: {},
  };
  saveSwapJob(job);
  void runSwapJob(id);
  return job;
}

export async function callMcpTool(name: string, rawArgs: unknown): Promise<unknown> {
  const args = asRecord(rawArgs);
  if (name === "list_templates") {
    const kind = str(args.kind) || "image";
    if (kind === "video") {
      return listVideoTemplates().map((t) => ({ id: t.id, label: labelFromVideoFilename(t.filename), kind: t.kind }));
    }
    if (kind === "effect") {
      return listEffectTemplates().map((t) => ({
        id: t.id,
        label: labelFromVideoFilename(t.filename),
        kind: t.kind,
        effect: effectFromFilename(t.filename),
      }));
    }
    return listImageTemplates().map((t) => ({ id: t.id, label: labelFromImageFilename(t.filename), kind: t.kind }));
  }
  if (name === "list_identities") {
    return listIdentities().map((a) => ({ id: a.id, name: a.name }));
  }
  if (name === "list_library") {
    return listSwapJobs()
      .filter((j) => j.status === "COMPLETED")
      .map((j) => ({
        id: j.id,
        template_id: j.template_id,
        kind: j.kind,
        status: j.status,
        output_url: `/api/faceswaps/${j.id}/output`,
      }));
  }
  if (name === "list_films") {
    return listProjects().map((p) => ({
      id: p.id,
      name: p.name,
      topic: p.topic,
      phase: p.phase,
      status: p.status,
      in_library: Boolean(p.in_library),
    }));
  }
  if (name === "create_documentary") {
    const topic = str(args.topic);
    const name = str(args.name) || undefined;
    const inLibrary = args.in_library === undefined ? true : Boolean(args.in_library);
    const p = createTopicProject(topic, name, inLibrary, undefined, args.duration_sec);
    return { id: p.id, name: p.name, phase: p.phase, status: p.status, in_library: p.in_library, target_duration_sec: p.target_duration_sec ?? 60 };
  }
  if (name === "get_film") {
    const p = getProject(str(args.id));
    if (!p) throw new Error("Project not found");
    return {
      id: p.id,
      name: p.name,
      topic: p.topic,
      phase: p.phase,
      status: p.status,
      error: p.error,
      scenes: p.script?.scenes.length ?? 0,
      target_duration_sec: p.target_duration_sec ?? 60,
      in_library: Boolean(p.in_library),
    };
  }
  if (name === "generate_look") {
    return enqueueLook(str(args.template_id), str(args.avatar_id));
  }
  if (name === "get_generation") {
    const job = getSwapJob(str(args.id));
    if (!job) throw new Error("Generation not found");
    return {
      id: job.id,
      status: job.status,
      phase: job.phase,
      phase_label: job.phase_label,
      kind: job.kind,
      error: job.error,
      output_url: job.status === "COMPLETED" ? `/api/faceswaps/${job.id}/output` : null,
    };
  }
  throw new Error(`Unknown tool: ${name}`);
}
