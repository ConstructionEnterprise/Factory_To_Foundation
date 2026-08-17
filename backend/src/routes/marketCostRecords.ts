import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate, requirePermission } from "../middleware/auth";
import * as service from "../services/marketCostRecordService";

const createBodySchema = z.object({
  category: z.enum(["material", "labor", "equipment"]),
  itemName: z.string().trim().min(1),
  sku: z.string().optional(),
  unit: z.string().trim().min(1),
  unitCostCents: z.number().int().positive(),
  region: z.string().optional(),
  sourceName: z.string().trim().min(1),
  sourceUrl: z.string().optional(),
  observedAt: z.string(),
  notes: z.string().optional(),
});

/**
 * Real market cost reference data routes (2026-08-17, cost-data
 * acquisition iteration 1). Gated on the same `construction` RBAC module
 * every other Construction route uses -- this is reference data feeding
 * Cost Estimating, not a new domain of its own.
 */
export async function marketCostRecordRoutes(app: FastifyInstance) {
  app.get(
    "/market-cost-records",
    { preHandler: [authenticate, requirePermission("construction", "read")] },
    async () => service.listRecords()
  );

  app.post(
    "/market-cost-records",
    { preHandler: [authenticate, requirePermission("construction", "create")] },
    async (request, reply) => {
      const body = createBodySchema.parse(request.body);
      const record = await service.createRecord({ ...body, createdById: request.user!.id });
      reply.code(201).send(record);
    }
  );
}
