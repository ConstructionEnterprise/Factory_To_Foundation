import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate } from "../middleware/auth";
import { prisma } from "../lib/prisma";

/**
 * Universal CE Forge (or any future synthetic-data source) provenance tag.
 * No requirePermission beyond authenticate() — this isn't scoped to any one
 * FF module (it can tag a record in any domain), and the sensitive part
 * (creating/mutating the real business record) is already gated on that
 * record's own route; tagging something you already had permission to
 * create doesn't need a second, narrower check.
 *
 * Deliberately NOT atomic with the record's own creation -- this is a
 * separate HTTP call from a separate client (ff-client), after the real
 * record already exists via its own route/transaction. If this call fails,
 * the real FF record still exists, untagged; the caller (ff-client) surfaces
 * that failure explicitly rather than silently losing the association.
 */
const createSchema = z.object({
  source: z.literal("CE_FORGE"),
  datasetId: z.string().min(1),
  runId: z.string().min(1),
  domain: z.string().min(1),
  recordType: z.string().min(1),
  recordId: z.string().min(1),
  generatedAt: z.string(),
});

export async function syntheticDataProvenanceRoutes(app: FastifyInstance) {
  const preHandler = [authenticate];

  app.post("/synthetic-data-provenance", { preHandler }, async (request, reply) => {
    const body = createSchema.parse(request.body);
    const row = await prisma.syntheticDataProvenance.create({
      data: { ...body, generatedAt: new Date(body.generatedAt) },
    });
    reply.code(201);
    return row;
  });

  app.get("/synthetic-data-provenance", { preHandler }, async (request) => {
    const { runId, datasetId, domain, recordType } = request.query as Record<string, string | undefined>;
    return prisma.syntheticDataProvenance.findMany({
      where: {
        ...(runId ? { runId } : {}),
        ...(datasetId ? { datasetId } : {}),
        ...(domain ? { domain } : {}),
        ...(recordType ? { recordType } : {}),
      },
      orderBy: { createdAt: "asc" },
    });
  });
}
