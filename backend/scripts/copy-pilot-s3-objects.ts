/**
 * Copies exactly the 196 explicitly-identified pilot S3 objects from the
 * sandbox bucket to the production bucket, same keys, server-side
 * CopyObject (no re-upload of bytes through this process). No bucket-wide
 * sync -- only the keys listed in promoted-s3-keys.json. Idempotent: safe
 * to re-run, skips keys that already exist in the destination with the
 * right size.
 */
import "dotenv/config";
import { CopyObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { readFileSync } from "node:fs";

const SOURCE_BUCKET = "ce-forge-sandbox-project-files-027958788731-us-east-2";
const DEST_BUCKET = "construction-enterprise-project-files-027958788731-us-east-2-an";

const client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID!, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY! },
});

async function alreadyCopied(key: string): Promise<boolean> {
  try {
    await client.send(new HeadObjectCommand({ Bucket: DEST_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const keys: string[] = JSON.parse(readFileSync("./promoted-s3-keys.json", "utf-8"));
  console.log(`${keys.length} keys to copy: ${SOURCE_BUCKET} -> ${DEST_BUCKET}`);

  let copied = 0;
  let skipped = 0;
  let failed = 0;

  for (const key of keys) {
    if (await alreadyCopied(key)) {
      skipped++;
      continue;
    }
    try {
      await client.send(
        new CopyObjectCommand({
          Bucket: DEST_BUCKET,
          Key: key,
          CopySource: `${SOURCE_BUCKET}/${encodeURIComponent(key)}`,
        })
      );
      copied++;
    } catch (err) {
      failed++;
      console.error(`FAILED: ${key} -- ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\nDONE. copied: ${copied}, already-present (skipped): ${skipped}, failed: ${failed} (of ${keys.length})`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exitCode = 1;
});
