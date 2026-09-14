import { spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";

function run(bin: string, args: string[]): Promise<{ code: number; stderr: string; stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    let stdout = "";
    child.stdout.on("data", (d) => {
      stdout += String(d);
    });
    child.stderr.on("data", (d) => {
      stderr += String(d);
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, stderr, stdout }));
  });
}

export async function ffmpegAvailable(): Promise<boolean> {
  try {
    const r = await run(FFMPEG, ["-version"]);
    return r.code === 0;
  } catch {
    return false;
  }
}

export async function probeDurationSeconds(file: string): Promise<number | null> {
  if (!existsSync(file)) return null;
  try {
    const r = await run(FFPROBE, [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      file,
    ]);
    if (r.code !== 0) return null;
    const n = Number(r.stdout.trim());
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export async function extractAudioMp3(input: string, output: string): Promise<void> {
  const r = await run(FFMPEG, [
    "-y",
    "-i",
    input,
    "-vn",
    "-acodec",
    "libmp3lame",
    "-q:a",
    "2",
    output,
  ]);
  if (r.code !== 0) throw new Error(`ffmpeg extract failed: ${r.stderr.slice(-800)}`);
}

export async function muxAudioOntoVideo(video: string, audio: string, output: string): Promise<void> {
  const r = await run(FFMPEG, [
    "-y",
    "-i",
    video,
    "-i",
    audio,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-shortest",
    output,
  ]);
  if (r.code !== 0) throw new Error(`ffmpeg mux failed: ${r.stderr.slice(-800)}`);
}

async function ffmpegOrThrow(args: string[], label: string) {
  const r = await run(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", ...args]);
  if (r.code !== 0) throw new Error(`${label} failed: ${r.stderr.slice(-800)}`);
}

function even(n: number) {
  const v = Math.max(2, Math.round(n));
  return v % 2 === 0 ? v : v + 1;
}

function scalePad(width: number, height: number) {
  const w = even(width);
  const h = even(height);
  return `scale=${w}:${h}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1`;
}

export async function makeBlackVideo(
  output: string,
  opts: { width: number; height: number; fps: number; duration: number },
) {
  const w = even(opts.width);
  const h = even(opts.height);
  await ffmpegOrThrow(
    [
      "-f",
      "lavfi",
      "-i",
      `color=c=black:s=${w}x${h}:r=${opts.fps}`,
      "-t",
      String(opts.duration),
      "-pix_fmt",
      "yuv420p",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-an",
      output,
    ],
    "ffmpeg black",
  );
}

export async function makeStillVideo(
  image: string,
  output: string,
  opts: { width: number; height: number; fps: number; duration: number },
) {
  await ffmpegOrThrow(
    [
      "-loop",
      "1",
      "-i",
      image,
      "-t",
      String(opts.duration),
      "-vf",
      `${scalePad(opts.width, opts.height)},fps=${opts.fps}`,
      "-pix_fmt",
      "yuv420p",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-an",
      output,
    ],
    "ffmpeg still",
  );
}

export async function trimVideoSegment(
  input: string,
  output: string,
  opts: { ss: number; duration: number; width: number; height: number; fps: number },
) {
  await ffmpegOrThrow(
    [
      "-ss",
      String(Math.max(0, opts.ss)),
      "-i",
      input,
      "-t",
      String(opts.duration),
      "-vf",
      `${scalePad(opts.width, opts.height)},fps=${opts.fps}`,
      "-an",
      "-pix_fmt",
      "yuv420p",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      output,
    ],
    "ffmpeg trim",
  );
}

const FONT =
  process.env.STUDIO_FONT ||
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";

export async function burnTexts(
  input: string,
  output: string,
  texts: Array<{ text: string; x: number; y: number; font_size: number; color: string }>,
) {
  if (!texts.length) {
    await ffmpegOrThrow(["-i", input, "-c", "copy", output], "ffmpeg copy");
    return;
  }
  const filters: string[] = [];
  const dir = path.dirname(output);
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    const file = path.join(dir, `text-${i}.txt`);
    writeFileSync(file, t.text.replace(/\r/g, ""));
    const x = `w*${Math.min(1, Math.max(0, t.x))}-text_w/2`;
    const y = `h*${Math.min(1, Math.max(0, t.y))}-text_h/2`;
    const font = existsSync(FONT) ? `:fontfile=${FONT}` : "";
    const color = t.color?.startsWith("#") ? `0x${t.color.slice(1)}` : t.color || "white";
    filters.push(
      `drawtext=textfile='${file.replace(/'/g, "\\'")}':reload=0${font}:fontsize=${Math.round(t.font_size)}:fontcolor=${color}:x=${x}:y=${y}:borderw=2:bordercolor=black@0.7`,
    );
  }
  await ffmpegOrThrow(["-i", input, "-vf", filters.join(","), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-an", output], "ffmpeg text");
}

export type MixBed = {
  file: string;
  delay_ms: number;
  trim_start: number;
  duration: number;
  volume: number;
};

export async function mixAudioBeds(output: string, beds: MixBed[], totalDuration: number) {
  if (!beds.length) {
    await ffmpegOrThrow(
      [
        "-f",
        "lavfi",
        "-i",
        "anullsrc=r=48000:cl=stereo",
        "-t",
        String(totalDuration),
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        output,
      ],
      "ffmpeg silence",
    );
    return;
  }
  const args: string[] = [];
  for (const bed of beds) {
    args.push("-i", bed.file);
  }
  const parts: string[] = [];
  for (let i = 0; i < beds.length; i++) {
    const bed = beds[i];
    const delay = Math.max(0, Math.round(bed.delay_ms));
    parts.push(
      `[${i}:a]atrim=start=${Math.max(0, bed.trim_start)}:duration=${bed.duration},asetpts=PTS-STARTPTS,adelay=${delay}|${delay},volume=${bed.volume},aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[a${i}]`,
    );
  }
  const mixInputs = beds.map((_, i) => `[a${i}]`).join("");
  const filter = `${parts.join(";")};${mixInputs}amix=inputs=${beds.length}:duration=longest:normalize=0,apad=whole_dur=${totalDuration},atrim=0:${totalDuration},aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[out]`;
  args.push("-filter_complex", filter, "-map", "[out]", "-t", String(totalDuration), "-c:a", "aac", "-b:a", "192k", output);
  await ffmpegOrThrow(args, "ffmpeg mix");
}
