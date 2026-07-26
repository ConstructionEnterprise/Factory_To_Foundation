// Mirrors lib/prisma.ts's/lib/jwt.ts's own conventions: fail loudly and
// immediately if a required env var is missing, rather than letting the
// SDK client construct silently and fail later on the first real call
// with a less obvious error. Loads dotenv itself rather than assuming
// whoever imports this module already has — the exact bug class Phase
// 3b's seed.ts had (a missing dotenv import left env vars undefined
// whenever it ran outside the one invocation path that happened to load
// them first).
import "dotenv/config";
import { GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — see .env.example`);
  return value;
}

export const S3_BUCKET_NAME = requireEnv("S3_BUCKET_NAME");

export const s3Client = new S3Client({
  region: requireEnv("AWS_REGION"),
  credentials: {
    accessKeyId: requireEnv("AWS_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("AWS_SECRET_ACCESS_KEY"),
  },
});

// Long enough for a real upload/download to complete, short enough not to
// linger as a real standing credential once handed to the client.
const PRESIGNED_URL_TTL_SEC = 15 * 60;

/** Real presigned PUT URL — the client uploads bytes directly to S3; this backend never sees or proxies the file's actual bytes. */
export function getPresignedUploadUrl(key: string, contentType: string): Promise<string> {
  const command = new PutObjectCommand({ Bucket: S3_BUCKET_NAME, Key: key, ContentType: contentType });
  return getSignedUrl(s3Client, command, { expiresIn: PRESIGNED_URL_TTL_SEC });
}

/** Real presigned GET URL — the client downloads directly from S3, same never-proxied principle as upload. */
export function getPresignedDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: S3_BUCKET_NAME, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn: PRESIGNED_URL_TTL_SEC });
}

/** Real reachability check — confirms the bucket actually exists and these real credentials can actually reach it, not assumed reachable just because the SDK didn't throw at import time. */
export async function checkBucketReachable(): Promise<void> {
  await s3Client.send(new HeadBucketCommand({ Bucket: S3_BUCKET_NAME }));
}
