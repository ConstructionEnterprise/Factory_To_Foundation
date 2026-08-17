import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate, requirePermission } from "../middleware/auth";
import * as service from "../services/productivityRecordService";

const createBodySchema = z.object({
  task: z.string().trim().min(1),
  value: z.number().positive(),
  unit: z.string().trim().min(1),
  crewSize: z.number().int().positive().optional(),
  applicabilityNotes: z.string().optional(),
  region: z.string().optional(),
  sourceName: z.string().trim().min(1),
  sourceUrl: z.string().optional(),
  observedAt: z.string(),
  notes: z.string().optional(),
});

/**
 * Real labor/crew productivity reference data routes (2026-08-17, cost-data
 * acquisition iteration 3). Deliberately separate from
 * /market-cost-records -- a productivity rate and a price are different
 * kinds of real-world fact (see ProductivityRecord's schema doc comment).
 * Gated on the same `construction` RBAC module as the rest of this
 * reference-data surface.
 */
export async function productivityRecordRoutes(app: FastifyInstance) {
  app.get(
    "/productivity-records",
    { preHandler: [authenticate, requirePermission("construction", "read")] },
    async () => service.listRecords()
  );

  app.post(
    "/productivity-records",
    { preHandler: [authenticate, requirePermission("construction", "create")] },
    async (request, reply) => {
      const body = createBodySchema.parse(request.body);
      const record = await service.createRecord({ ...body, createdById: request.user!.id });
      reply.code(201).send(record);
    }
  );
}
