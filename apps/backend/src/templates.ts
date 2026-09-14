import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { DATA_DIR, EFFECT_TEMPLATE_DIR, TEMPLATE_DIR, VIDEO_TEMPLATE_DIR } from "./env.js";
import { r2Has, r2Put } from "./r2.js";

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const VIDEO_EXT = new Set([".mp4", ".mov", ".mkv", ".webm"]);
const POSTER_DIR = path.join(DATA_DIR, "video-posters");

export type ImageTemplate = {
  kind: "image";
  id: string;
  filename: string;
  abs_path: string;
  mime: string;
  bytes: number;
  r2_key: string;
  image_url: string;
};

export type VideoTemplate = {
  kind: "video";
  id: string;
  filename: string;
  abs_path: string;
  mime: string;
  bytes: number;
  r2_key: string;
  video_url: string;
  poster_url: string;
  poster_path: string | null;
  duration_s: number | null;
  catalog: "video" | "effect";
};

export type MediaTemplate = ImageTemplate | VideoTemplate;

function mimeFromImageExt(ext: string) {
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

function mimeFromVideoExt(ext: string) {
  if (ext === ".webm") return "video/webm";
  if (ext === ".mov") return "video/quicktime";
  if (ext === ".mkv") return "video/x-matroska";
  return "video/mp4";
}

function idFromName(filename: string, used: Set<string>) {
  const timed = filename.match(/\d{4}-\d{2}-\d{2}[ T._-](\d{2}-\d{2}-\d{2})/);
  const base =
    timed?.[1] ??
    filename.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  let id = base;
  let n = 2;
  while (used.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  used.add(id);
  return id;
}

const IMAGE_LABELS: Record<string, string> = {
  "asian.png": "World Cup stands",
  "boss.jpg": "Ivory studio",
  "man.png": "Black suit",
  "Screenshot from 2026-09-13 13-22-58.png": "Lip gloss",
  "Screenshot from 2026-09-13 15-51-19.png": "Wine cellar",
  "Screenshot from 2026-09-13 15-52-23.png": "Frozen lake",
  "Screenshot from 2026-09-13 15-52-50.png": "Garden chair",
  "1765360204383_1ci042_1b3b9a6717aab1c6f9fc0068aac1becadb4d037b522eb47cf359437d908456a6.jpg": "Louvre plaza",
  "1765360294364_xh7py4_1765274895843-7atxql-02176527488562899f4740eadd3360aa6250e68d85f7ec7240623_0.jpeg": "Evening still",
  "1789028870825_i0r9eg_HR0pF_BboAAKdrX.jpg": "Two coffees",
  "1789029563575_edhaa2_HRvLtZnbEAAH4_e.jpg": "Sofa and boots",
  "1789117693663_a35rb3_HR6k_NNa4AAFJas.jpg": "Live comments",
  "1789117696786_o4vst5_HR6fGc4aEAAD-aX.jpg": "Bedroom light",
  "1789117728108_srr0b9_HRz7FIDbIAA9wRl.jpg": "Street night",
  "1789117728128_49l49l_HRz689Eb0AAIMXO.jpg": "City glass",
  "1789117728147_xonznn_HRz69tXaIAAkLGd.jpg": "Neon hallway",
  "1789117728973_8n6r05_HRz7F--bwAEA1jB.jpg": "After hours",
  "1789195064009_q7bsq1_HR8g2TmawAA_ZUD.jpg": "Soft window",
  "1789202265046_sqy2tv_HR8UcJGaQAAA8KH.jpg": "Vogue cover",
  "1789202270433_vsu9nz_HSAD7x4asAA-mjn.jpg": "White shirt",
};

const EFFECT_SCENES: Record<string, string[]> = {
  "act-natural": ["Loading bay", "Red room", "Storefront sit", "Dusk beach"],
  clones: ["Civic corner", "Night track", "Pink fur crossing", "Rooftop dusk"],
  "stop-world": ["Subway car", "Crosswalk", "Mirror sky", "Night field", "Mall lot"],
  vanish: ["Blue mat", "Red coupe", "Under the desk", "Jukebox sofa"],
  "frozen-in-motion": ["Bus plaza", "London split", "Floating bag", "Varsity leap"],
  "floating-fall": ["Black trainer", "Silver toe", "Platform slide", "Green track"],
  "studio-slide": ["Blue infinity", "Gold silhouette", "Jade ring", "Teal suit"],
  pigeons: ["Dolphin polo", "Red shirt ride", "Penguin snow", "Hoodie surf"],
};

function titleCaseWords(raw: string) {
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+\(\d+\)$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((w) => (/^[A-Z0-9]{2,}$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

export function labelFromImageFilename(filename: string) {
  if (IMAGE_LABELS[filename]) return IMAGE_LABELS[filename];
  const stem = filename.replace(/\.[^.]+$/, "");
  const human = titleCaseWords(stem.replace(/^\d+_[a-z0-9]+_/i, ""));
  if (human && !/^[0-9a-f]{16,}$/i.test(human.replace(/\s/g, ""))) return human;
  return "Studio still";
}

export function labelFromVideoFilename(filename: string) {
  const stem = filename.replace(/\.[^.]+$/, "");
  const parts = stem.split("_");
  const pack = parts[0] ?? "";
  const take = Number((parts[1] || "").replace(/\D/g, ""));
  const rest = parts.length >= 3 ? parts.slice(2).join(" ") : stem;
  const lookMatch = rest.match(/^look[- ]?(\d+)$/i);
  if (lookMatch) {
    const named = EFFECT_SCENES[pack]?.[Number(lookMatch[1]) - 1];
    if (named) return named;
    if (take) return `${titleCaseWords(pack)} ${String(take).padStart(2, "0")}`;
  }
  const human = titleCaseWords(parts.length >= 3 ? parts.slice(2).join(" ") : stem);
  return human || "Template clip";
}

/** First filename segment: `incline_01_Office-chair.mp4` → `Incline`. */
export function effectFromFilename(filename: string) {
  const stem = filename.replace(/\.[^.]+$/, "");
  const parts = stem.split("_");
  const slug = parts.length >= 2 ? parts[0] : stem;
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ") || "Other";
}

export function listImageTemplates(): ImageTemplate[] {
  if (!existsSync(TEMPLATE_DIR)) return [];
  const used = new Set<string>();
  return readdirSync(TEMPLATE_DIR)
    .filter((name) => IMAGE_EXT.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b))
    .map((filename) => {
      const abs_path = path.join(TEMPLATE_DIR, filename);
      const ext = path.extname(filename).toLowerCase();
      const id = idFromName(filename, used);
      return {
        kind: "image" as const,
        id,
        filename,
        abs_path,
        mime: mimeFromImageExt(ext),
        bytes: statSync(abs_path).size,
        r2_key: `templates/images/${id}${ext}`,
        image_url: `/api/image-templates/${id}/image`,
      };
    });
}

export function getImageTemplate(id: string): ImageTemplate | undefined {
  return listImageTemplates().find((t) => t.id === id);
}

const videoMeta = new Map<string, { duration_s: number | null; poster_path: string | null }>();

function probeDuration(abs: string): number | null {
  try {
    const r = spawnSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", abs],
      { encoding: "utf8" },
    );
    const n = Number((r.stdout || "").trim());
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function ensurePoster(id: string, abs: string): string | null {
  mkdirSync(POSTER_DIR, { recursive: true });
  const dest = path.join(POSTER_DIR, `${id}.jpg`);
  if (existsSync(dest)) return dest;
  const r = spawnSync(
    "ffmpeg",
    ["-y", "-ss", "0.4", "-i", abs, "-frames:v", "1", "-q:v", "3", dest],
    { stdio: "ignore" },
  );
  if (r.status !== 0 || !existsSync(dest)) return null;
  return dest;
}

function listClipsFromDir(opts: {
  dir: string;
  catalog: "video" | "effect";
  r2Prefix: string;
  urlPrefix: string;
}): VideoTemplate[] {
  if (!existsSync(opts.dir)) return [];
  const used = new Set<string>();
  return readdirSync(opts.dir)
    .filter((name) => VIDEO_EXT.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b))
    .map((filename) => {
      const abs_path = path.join(opts.dir, filename);
      const ext = path.extname(filename).toLowerCase();
      const id = idFromName(filename, used);
      let meta = videoMeta.get(id);
      if (!meta) {
        meta = {
          duration_s: probeDuration(abs_path),
          poster_path: ensurePoster(id, abs_path),
        };
        videoMeta.set(id, meta);
      }
      return {
        kind: "video" as const,
        catalog: opts.catalog,
        id,
        filename,
        abs_path,
        mime: mimeFromVideoExt(ext),
        bytes: statSync(abs_path).size,
        r2_key: `${opts.r2Prefix}/${id}${ext}`,
        video_url: `${opts.urlPrefix}/${id}/video`,
        poster_url: `${opts.urlPrefix}/${id}/poster`,
        poster_path: meta.poster_path,
        duration_s: meta.duration_s,
      };
    });
}

export function listVideoTemplates(): VideoTemplate[] {
  return listClipsFromDir({
    dir: VIDEO_TEMPLATE_DIR,
    catalog: "video",
    r2Prefix: "templates/videos",
    urlPrefix: "/api/video-templates",
  });
}

export function listEffectTemplates(): VideoTemplate[] {
  return listClipsFromDir({
    dir: EFFECT_TEMPLATE_DIR,
    catalog: "effect",
    r2Prefix: "templates/effects",
    urlPrefix: "/api/effects",
  });
}

export function getVideoTemplate(id: string): VideoTemplate | undefined {
  return listVideoTemplates().find((t) => t.id === id) ?? listEffectTemplates().find((t) => t.id === id);
}

export function getEffectTemplate(id: string): VideoTemplate | undefined {
  return listEffectTemplates().find((t) => t.id === id);
}

export function getMediaTemplate(id: string): MediaTemplate | undefined {
  return getImageTemplate(id) ?? getVideoTemplate(id);
}

let uploadGate: Promise<{ uploaded: string[]; skipped: string[] }> | null = null;

export function ensureTemplatesOnR2() {
  if (!uploadGate) {
    uploadGate = uploadAll().catch((err) => {
      uploadGate = null;
      throw err;
    });
  }
  return uploadGate;
}

async function uploadAll() {
  const uploaded: string[] = [];
  const skipped: string[] = [];
  for (const t of [...listImageTemplates(), ...listVideoTemplates(), ...listEffectTemplates()]) {
    if (await r2Has(t.r2_key)) {
      skipped.push(t.id);
      continue;
    }
    await r2Put(t.r2_key, readFileSync(t.abs_path), t.mime);
    uploaded.push(t.id);
    console.log("r2 template", t.id, t.r2_key);
  }
  return { uploaded, skipped };
}

export async function ensureTemplateOnR2(id: string): Promise<MediaTemplate> {
  const t = getMediaTemplate(id);
  if (!t) throw new Error(`unknown template ${id}`);
  if (!(await r2Has(t.r2_key))) {
    await r2Put(t.r2_key, readFileSync(t.abs_path), t.mime);
    console.log("r2 template", t.id, t.r2_key);
  }
  return t;
}
