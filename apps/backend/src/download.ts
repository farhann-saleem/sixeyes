import { createWriteStream } from "node:fs";
import { rename, rm } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Readable, Transform } from "node:stream";
import { randomUUID } from "node:crypto";
/** Bounded streaming download. Failed or interrupted transfers never become visible artifacts. */
export async function downloadToFile(url: string, file: string, signal = AbortSignal.timeout(180_000), maxBytes = 200 * 1024 * 1024) {
  const res = await fetch(url, { signal });
  if (!res.ok || !res.body) throw new Error(`download HTTP ${res.status}`);
  if (Number(res.headers.get("content-length")) > maxBytes) { await res.body.cancel(); throw new Error("Media download exceeds size limit"); }
  const temporary = `${file}.${randomUUID()}.tmp`;
  let size = 0;
  const limit = new Transform({ transform(chunk, _encoding, callback) { size += chunk.length; callback(size > maxBytes ? new Error("Media download exceeds size limit") : null, chunk); } });
  try {
    await pipeline(Readable.fromWeb(res.body as any), limit, createWriteStream(temporary), { signal });
    await rename(temporary, file); return size;
  } finally { await rm(temporary, { force: true }); }
}
