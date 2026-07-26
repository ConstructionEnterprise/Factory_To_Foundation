import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate, requirePermission } from "../middleware/auth";
import * as service from "../services/projectFileService";

const categorySchema = z.enum(service.PROJECT_FILE_CATEGORIES);

const listQuerySchema = z.object({
  projectId: z.string(),
  treeNodeId: z.string().optional(),
  category: z.string().optional(),
});

const uploadBodySchema = z.object({
  projectId: z.string(),
  treeNodeId: z.string(),
  category: categorySchema,
  subcategory: z.string().optional(),
  originalFilename: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

const versionBodySchema = z.object({
  originalFilename: z.string().min(1).optional(),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

const metadataPatchSchema = z.object({
  originalFilename: z.string().min(1).optional(),
  category: categorySchema.optional(),
  subcategory: z.string().nullable().optional(),
});

const downloadQuerySchema = z.object({
  version: z.coerce.number().int().positive().optional(),
});

/**
 * Six real routes (the brief listed 7 words — list/metadata/download/
 * upload/rename/replace-version/delete — but said "six": read `list` as
 * already including full real metadata per row, so there's no separate
 * single-file GET). Every route requires `authenticate` first;
 * `requirePermission` uses `construction:read` for the two GETs (matching
 * the existing /construction-sites convention) and
 * `construction:create`/`update`/`delete` for the rest, exactly as
 * decided. `:fileId` is the stable logical-file id (ProjectFile.fileId),
 * not any individual version row's own `id` — a user renames/deletes/
 * downloads "the file", not a specific historical version.
 */
export async function projectFileRoutes(app: FastifyInstance) {
  const readPreHandler = [authenticate, requirePermission("construction", "read")];
  const createPreHandler = [authenticate, requirePermission("construction", "create")];
  const updatePreHandler = [authenticate, requirePermission("construction", "update")];
  const deletePreHandler = [authenticate, requirePermission("construction", "delete")];

  app.get("/construction-files", { preHandler: readPreHandler }, async (request) => {
    const query = listQuerySchema.parse(request.query);
    return service.listFiles(query);
  });

  app.get("/construction-files/:fileId/download", { preHandler: readPreHandler }, async (request) => {
    const { fileId } = request.params as { fileId: string };
    const { version } = downloadQuerySchema.parse(request.query);
    return service.getDownloadUrl(fileId, version);
  });

  // Added during Phase 4 (not one of the original 6 routes) — a real,
  // necessary gap: there was no way to enumerate a file's real versions
  // for a "version history" UI. Same GET-lists/POST-creates pairing as
  // the routes above, just scoped one level deeper (all versions, not
  // just the latest).
  app.get("/construction-files/:fileId/versions", { preHandler: readPreHandler }, async (request) => {
    const { fileId } = request.params as { fileId: string };
    return service.listVersionHistory(fileId);
  });

  app.post("/construction-files", { preHandler: createPreHandler }, async (request) => {
    const body = uploadBodySchema.parse(request.body);
    return service.initiateUpload({
      ...body,
      subcategory: body.subcategory ?? null,
      uploadedById: request.user!.id,
    });
  });

  app.post("/construction-files/:fileId/versions", { preHandler: updatePreHandler }, async (request) => {
    const { fileId } = request.params as { fileId: string };
    const body = versionBodySchema.parse(request.body);
    return service.initiateVersionUpload(fileId, { ...body, uploadedById: request.user!.id });
  });

  // Known, disclosed limitation (confirmed live during Phase 3 verification,
  // kept as-is per explicit instruction — not fixed this phase): this only
  // updates the DB row's display metadata. It never re-keys the S3 object,
  // so a renamed file's `s3Key` (which has the upload-time filename baked
  // in per the storage layout convention) can genuinely diverge from the
  // current `originalFilename` shown here. Real fix would be an S3
  // CopyObject to a new key + delete of the old one — see
  // services/projectFileService.ts's updateMetadata() for the full
  // reasoning on why that wasn't built.
  app.patch("/construction-files/:fileId", { preHandler: updatePreHandler }, async (request) => {
    const { fileId } = request.params as { fileId: string };
    const patch = metadataPatchSchema.parse(request.body);
    return service.updateMetadata(fileId, patch);
  });

  app.delete("/construction-files/:fileId", { preHandler: deletePreHandler }, async (request, reply) => {
    const { fileId } = request.params as { fileId: string };
    await service.deleteFile(fileId, request.user!.id);
    reply.code(204).send();
  });
}
