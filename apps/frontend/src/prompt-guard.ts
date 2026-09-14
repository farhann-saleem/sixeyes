export type PromptKind = "topic" | "title" | "heading" | "stock" | "speech" | "scriptVo" | "sceneVo" | "sfx" | "music" | "lyrics" | "tags" | "overlay" | "name";

export type PromptLimit = { min: number; max: number; label: string };

export const PROMPT_LIMITS: Record<PromptKind, PromptLimit> = {
  topic: { min: 1, max: 2000, label: "Topic" },
  title: { min: 1, max: 160, label: "Title" },
  heading: { min: 1, max: 160, label: "Scene heading" },
  stock: { min: 1, max: 120, label: "Stock query" },
  speech: { min: 1, max: 1_000_000, label: "Script" },
  scriptVo: { min: 1, max: 1800, label: "Narration" },
  sceneVo: { min: 1, max: 500, label: "Scene narration" },
  sfx: { min: 3, max: 450, label: "Sound description" },
  music: { min: 1, max: 500, label: "Music description" },
  lyrics: { min: 0, max: 5000, label: "Lyrics" },
  tags: { min: 0, max: 1000, label: "Style tags" },
  overlay: { min: 0, max: 2000, label: "Text" },
  name: { min: 0, max: 80, label: "Name" },
};

const INJECTION = [
  /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules|system)/i,
  /disregard\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules)/i,
  /(?:^|[\n\r])\s*(system|assistant|developer)\s*:\s/i,
  /<\|(?:im_start|im_end|endoftext|system)\|>/i,
  /\[\/?INST\]/i,
  /<<\s*SYS\s*>>/i,
  /<\/?(?:system|assistant)(?:\s|>)/i,
  /you\s+are\s+(now\s+)?(?:DAN|jailbroken|unrestricted|an?\s+unfiltered)/i,
  /reveal\s+(your\s+)?(system|hidden|developer)\s+prompt/i,
  /new\s+(system\s+)?instructions\s*:/i,
  /(?:^|[\n\r])\s*#\s*(system|instructions)\b/i,
];

export function stripPromptNoise(raw: string): string {
  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "")
    .replace(/\r\n/g, "\n");
}

export function promptIssue(raw: string, kind: PromptKind): string | null {
  const limit = PROMPT_LIMITS[kind];
  const text = stripPromptNoise(raw);
  if (text.length > limit.max) return `${limit.label} is too long (max ${limit.max} characters)`;
  if (text.trim().length < limit.min) return `${limit.label} required`;
  if (INJECTION.some((re) => re.test(text))) {
    return `${limit.label} looks like an instruction override. Write the subject only — not system or model commands.`;
  }
  return null;
}

export function assertSafePrompt(raw: string, kind: PromptKind): string {
  const text = stripPromptNoise(raw);
  const issue = promptIssue(text, kind);
  if (issue) throw new Error(issue);
  return kind === "overlay" || kind === "lyrics" || kind === "tags" || kind === "name" ? text : text.trim();
}
