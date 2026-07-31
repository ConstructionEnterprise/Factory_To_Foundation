import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate, requirePermission } from "../middleware/auth";
import * as service from "../services/complianceDocumentService";

const categorySchema = z.enum(service.COMPLIANCE_DOCUMENT_CATEGORIES);

const listQuerySchema = z.object({
  category: z.string().optional(),
});

const uploadBodySchema = z.object({
  category: categorySchema,
  subject: z.string().optional(),
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
  subject: z.string().nullable().optional(),
  subcategory: z.string().nullable().optional(),
});

const downloadQuerySchema = z.object({
  version: z.coerce.number().int().positive().optional(),
});

/**
 * Compliance & Records (A4) — same 7-route shape as projectFiles.ts/
 * logisticsDocuments.ts, scoped to `administration` permissions since this
 * is company-wide, not per-project/per-dispatch data.
 */
export async function complianceDocumentRoutes(app: FastifyInstance) {
  const readPreHandler = [authenticate, requirePermission("administration", "read")];
  const createPreHandler = [authenticate, requirePermission("administration", "create")];
  const updatePreHandler = [authenticate, requirePermission("administration", "update")];
  const deletePreHandler = [authenticate, requirePermission("administration", "delete")];

  app.get("/compliance-documents", { preHandler: readPreHandler }, async (request) => {
    const query = listQuerySchema.parse(request.query);
    return service.listDocuments(query);
  });

  app.get("/compliance-documents/:fileId/download", { preHandler: readPreHandler }, async (request) => {
    const { fileId } = request.params as { fileId: string };
    const { version } = downloadQuerySchema.parse(request.query);
    return service.getDownloadUrl(fileId, version);
  });

  app.get("/compliance-documents/:fileId/versions", { preHandler: readPreHandler }, async (request) => {
    const { fileId } = request.params as { fileId: string };
    return service.listVersionHistory(fileId);
  });

  app.post("/compliance-documents", { preHandler: createPreHandler }, async (request) => {
    const body = uploadBodySchema.parse(request.body);
    return service.initiateUpload({
      ...body,
      subject: body.subject ?? null,
      subcategory: body.subcategory ?? null,
      uploadedById: request.user!.id,
    });
  });

  app.post("/compliance-documents/:fileId/versions", { preHandler: updatePreHandler }, async (request) => {
    const { fileId } = request.params as { fileId: string };
    const body = versionBodySchema.parse(request.body);
    return service.initiateVersionUpload(fileId, { ...body, uploadedById: request.user!.id });
  });

  app.patch("/compliance-documents/:fileId", { preHandler: updatePreHandler }, async (request) => {
    const { fileId } = request.params as { fileId: string };
    const patch = metadataPatchSchema.parse(request.body);
    return service.updateMetadata(fileId, patch);
  });

  app.delete("/compliance-documents/:fileId", { preHandler: deletePreHandler }, async (request, reply) => {
    const { fileId } = request.params as { fileId: string };
    await service.deleteDocument(fileId, request.user!.id);
    reply.code(204).send();
  });
}
