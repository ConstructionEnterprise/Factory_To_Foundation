import type { FastifyInstance } from "fastify";

import { getPresignedDownloadUrl, objectExists } from "../lib/s3";

// Real fixed key — must stay in sync with blender-bridge/server.mjs's own
// copy of this same literal (separate processes, can't share a constant
// directly). Phase 3 portability rewrite: blender-bridge now uploads the
// converted model to S3 instead of writing straight to the frontend's
// local public/models path, so the frontend needs a real presigned URL to
// read it back — see features/manufacturing/manufacturingModel.ts.
const MANUFACTURING_MODEL_S3_KEY = "manufacturing-models/manufacturing-model.glb";

// No RBAC gate here, deliberately: Manufacturing has no backend-enforced
// permission story at all yet (Phase 3c's own investigation found it has
// zero real write/execute controls beyond the client-side-only blender-
// bridge upload, which itself has no auth of its own either). A presigned
// URL for this one fixed, non-sensitive key is a narrower exposure than
// what already exists unguarded on this same bucket's other keys.
export async function manufacturingModelRoutes(app: FastifyInstance) {
  // Real existence check first — a fresh environment (or one where nobody
  // has ever uploaded a .blend through blender-bridge) genuinely has
  // nothing at this key yet. Honestly returning `url: null` lets the
  // frontend fall back to its committed local default instead of being
  // handed a presigned URL for an object that doesn't exist.
  app.get("/manufacturing-model/download-url", async () => {
    const exists = await objectExists(MANUFACTURING_MODEL_S3_KEY);
    if (!exists) return { url: null };
    const url = await getPresignedDownloadUrl(MANUFACTURING_MODEL_S3_KEY);
    return { url };
  });
}
