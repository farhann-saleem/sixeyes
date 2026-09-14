export function extFromMime(mime: string) {
  if (mime.includes("jpeg") || mime.includes("jpg")) return ".jpg";
  if (mime.includes("webp")) return ".webp";
  if (mime === "audio/mp4") return ".m4a";
  if (mime.includes("mp4")) return ".mp4";
  if (mime.includes("webm")) return ".webm";
  if (mime.includes("quicktime") || mime.includes("mov")) return ".mov";
  if (mime.includes("matroska") || mime.includes("mkv")) return ".mkv";
  if (mime.includes("mpeg") || mime === "audio/mp3" || mime === "audio/mpeg") return ".mp3";
  if (mime.includes("mp4a") || mime.includes("m4a") || mime === "audio/x-m4a") return ".m4a";
  if (mime.includes("wav")) return ".wav";
  if (mime.includes("ogg") || mime.includes("opus")) return ".ogg";
  if (mime.includes("flac")) return ".flac";
  if (mime.includes("aac")) return ".aac";
  if (mime.includes("json")) return ".json";
  return ".png";
}

export function mimeFromKey(key: string) {
  const lower = key.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".mkv")) return "video/x-matroska";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".flac")) return "audio/flac";
  if (lower.endsWith(".aac")) return "audio/aac";
  if (lower.endsWith(".srt")) return "application/x-subrip";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

export function isVideoMime(mime: string | null | undefined) {
  return Boolean(mime?.startsWith("video/"));
}
