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
  if (!R2_ENDPOINT || !R2_ACCESS_KEY || !R2_SECRET_KEY) {
    throw new Error("R2_ENDPOINT / R2_ACCESS_KEY / R2_SECRET_KEY missing");
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
