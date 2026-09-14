import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { R2_ACCESS_KEY, R2_BUCKET, R2_ENDPOINT, R2_SECRET_KEY } from "./env.js";

let client: S3Client | null = null;

function r2(): S3Client {
  if (!R2_BUCKET || !R2_ENDPOINT || !R2_ACCESS_KEY || !R2_SECRET_KEY) {
    throw new Error("R2_BUCKET / R2_ENDPOINT / R2_ACCESS_KEY / R2_SECRET_KEY missing");
  }
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY,
        secretAccessKey: R2_SECRET_KEY,
      },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return client;
}

function statusOf(err: unknown): number | undefined {
  if (err && typeof err === "object" && "$metadata" in err) {
    const meta = (err as { $metadata?: { httpStatusCode?: number } }).$metadata;
    return meta?.httpStatusCode;
  }
  return undefined;
}

export async function r2Has(key: string): Promise<boolean> {
  try {
    await r2().send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return true;
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "NotFound" || name === "NoSuchKey" || statusOf(err) === 404) {
      return false;
    }
    throw err;
  }
}

export async function r2Put(key: string, body: Buffer, contentType: string) {
  await r2().send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function r2Get(key: string): Promise<Buffer> {
  const res = await r2().send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }), {
    abortSignal: AbortSignal.timeout(120_000),
  });
  if (!res.Body) throw new Error(`R2 object empty: ${key}`);
  return Buffer.from(await res.Body.transformToByteArray());
}

export async function r2Del(key: string) {
  await r2().send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
}

export async function r2SignedUrl(key: string, expiresIn = 300, filename?: string): Promise<string> {
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  return getSignedUrl(r2(), new GetObjectCommand({
    Bucket: R2_BUCKET, Key: key,
    ResponseContentDisposition: filename ? `attachment; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}"` : undefined,
  }), { expiresIn });
}

export async function r2PutFile(key: string, file: string, contentType: string) {
  const { createReadStream, statSync } = await import("node:fs");
  await r2().send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: createReadStream(file), ContentLength: statSync(file).size, ContentType: contentType }));
}
export async function r2ToFile(key: string, file: string) {
  const { createWriteStream } = await import("node:fs");
  const { mkdir, rename, rm } = await import("node:fs/promises");
  const { dirname } = await import("node:path");
  const { randomUUID } = await import("node:crypto");
  const { pipeline } = await import("node:stream/promises");
  const response = await r2().send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  if (!response.Body) throw new Error("R2 object empty");
  await mkdir(dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    await pipeline(response.Body as import("node:stream").Readable, createWriteStream(temp));
    await rename(temp, file);
  } finally { await rm(temp, { force: true }); }
}
