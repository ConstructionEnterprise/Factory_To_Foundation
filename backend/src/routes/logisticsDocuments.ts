import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate, requirePermission } from "../middleware/auth";
import * as service from "../services/logisticsDocumentService";

const categorySchema = z.enum(service.LOGISTICS_DOCUMENT_CATEGORIES);

const listQuerySchema = z.object({
  dispatchId: z.string(),
  category: z.string().optional(),
});

const uploadBodySchema = z.object({
  dispatchId: z.string(),
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
 * Same 6 real routes (list/download/versions/upload/version-upload/patch/
 * delete) as projectFileRoutes.ts, scoped to `logistics` permissions
 * instead of `construction` — Phase 1 already confirmed the Dispatcher
 * role has full real create/read/update/delete/execute on `logistics`, so
 * zero seed changes were needed to wire this. `:fileId` is the stable
 * logical-document id (LogisticsDocument.fileId), not any individual
 * version row's own `id` — same convention as Construction's files.
 */
export async function logisticsDocumentRoutes(app: FastifyInstance) {
  const readPreHandler = [authenticate, requirePermission("logistics", "read")];
  const createPreHandler = [authenticate, requirePermission("logistics", "create")];
  const updatePreHandler = [authenticate, requirePermission("logistics", "update")];
  const deletePreHandler = [authenticate, requirePermission("logistics", "delete")];

  app.get("/logistics-files", { preHandler: readPreHandler }, async (request) => {
    const query = listQuerySchema.parse(request.query);
    return service.listDocuments(query);
  });

  app.get("/logistics-files/:fileId/download", { preHandler: readPreHandler }, async (request) => {
    const { fileId } = request.params as { fileId: string };
    const { version } = downloadQuerySchema.parse(request.query);
    return service.getDownloadUrl(fileId, version);
  });

  app.get("/logistics-files/:fileId/versions", { preHandler: readPreHandler }, async (request) => {
    const { fileId } = request.params as { fileId: string };
    return service.listVersionHistory(fileId);
  });

  app.post("/logistics-files", { preHandler: createPreHandler }, async (request) => {
    const body = uploadBodySchema.parse(request.body);
    return service.initiateUpload({
      ...body,
      subcategory: body.subcategory ?? null,
      uploadedById: request.user!.id,
    });
  });

  app.post("/logistics-files/:fileId/versions", { preHandler: updatePreHandler }, async (request) => {
    const { fileId } = request.params as { fileId: string };
    const body = versionBodySchema.parse(request.body);
    return service.initiateVersionUpload(fileId, { ...body, uploadedById: request.user!.id });
  });

  // Same disclosed limitation as /construction-files' PATCH route: only
  // updates the DB row's display metadata, never re-keys the S3 object.
  app.patch("/logistics-files/:fileId", { preHandler: updatePreHandler }, async (request) => {
    const { fileId } = request.params as { fileId: string };
    const patch = metadataPatchSchema.parse(request.body);
    return service.updateMetadata(fileId, patch);
  });

  app.delete("/logistics-files/:fileId", { preHandler: deletePreHandler }, async (request, reply) => {
    const { fileId } = request.params as { fileId: string };
    await service.deleteDocument(fileId, request.user!.id);
    reply.code(204).send();
  });
}
