import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, "../../..");

dotenv.config({ path: path.join(REPO_ROOT, ".env"), override: false });

export const PORT = Number(process.env.PORT || 3001);
export const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

export const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY || "";
export const RUNPOD_QWEN_ENDPOINT_ID =
  process.env.RUNPOD_QWEN_ENDPOINT_ID || "ko6zewns6wj3mj";
export const RUNPOD_CPU_ENDPOINT_ID =
  process.env.RUNPOD_CPU_ENDPOINT_ID || "rydclpv4ta6u4p";

export const R2_BUCKET = process.env.R2_BUCKET || "";
export const R2_ENDPOINT = process.env.R2_ENDPOINT || "";
export const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY || "";
export const R2_SECRET_KEY = process.env.R2_SECRET_KEY || "";

export const TEMPLATE_DIR = path.join(REPO_ROOT, "image-template");
export const VIDEO_TEMPLATE_DIR = path.join(REPO_ROOT, "video-template");
export const EFFECT_TEMPLATE_DIR = path.join(REPO_ROOT, "effects-template");

export const AI33_API_KEY = process.env.AI33_API_KEY || "";
export const AI33_BASE_URL = (process.env.AI33_BASE_URL || "https://api.ai33.pro").replace(
  /\/$/,
  "",
);

/** Vendor image model. Owner said “seedance 4.5”; catalog id is Seedream. */
export const AI33_IMAGE_MODEL =
  process.env.AI33_IMAGE_MODEL || "bytedance-seedream-4.5";

export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
export const OPENROUTER_BASE_URL = (
  process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1"
).replace(/\/$/, "");
export const OPENROUTER_IMAGE_MODEL =
  process.env.OPENROUTER_IMAGE_MODEL || "meta/muse-image";
export const OPENROUTER_FLUX_MODEL =
  process.env.OPENROUTER_FLUX_MODEL || "black-forest-labs/flux.2-klein-4b";

export const DATA_DIR = process.env.NODE_ENV === "test" && process.env.STUDIO_TEST_DATA_DIR
  ? path.resolve(process.env.STUDIO_TEST_DATA_DIR) : path.resolve(process.env.DATA_DIR || path.join(here, "..", "data"));

export const PEXELS_API_KEY = process.env.PEXELS_API_KEY || "";
export const OPENROUTER_TEXT_MODEL = process.env.OPENROUTER_TEXT_MODEL || "openai/gpt-4o-mini";
export const MCP_TOKEN = process.env.MCP_TOKEN || "";
