import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate, requirePermission } from "../middleware/auth";
import * as service from "../services/productionRunService";

const createRunBodySchema = z.object({
  assemblyId: z.string().min(1),
  cellRef: z.string().trim().min(1).optional(),
  plannedQuantity: z.number().int().positive().optional(),
  startedAt: z.string().optional(),
});

/**
 * Real Manufacturing/Production Run routes (Phase 9, 2026-08-17) --
 * Manufacturing's first real write/execute surface (confirmed empty by
 * the Phase 9 audit: `manufacturingModel.ts` only resolves a static
 * blueprint file, no real routes existed). Gated on the existing
 * `manufacturing` RBAC module, already seeded with real per-role grants
 * (Manufacturing Engineer: RCUD) -- no new module needed.
 */
export async function productionRunRoutes(app: FastifyInstance) {
  const readPreHandler = [authenticate, requirePermission("manufacturing", "read")];
  const createPreHandler = [authenticate, requirePermission("manufacturing", "create")];
  const updatePreHandler = [authenticate, requirePermission("manufacturing", "update")];

  app.get("/production-runs", { preHandler: readPreHandler }, async () => service.listRuns());

  app.get("/production-runs/:id", { preHandler: readPreHandler }, async (request) => {
    const { id } = request.params as { id: string };
    return service.getRun(id);
  });

  app.post("/production-runs", { preHandler: createPreHandler }, async (request, reply) => {
    const body = createRunBodySchema.parse(request.body);
    const run = await service.createRun({ ...body, createdById: request.user!.id });
    reply.code(201).send(run);
  });

  /** Real, one-way completion -- the only real status transition a run has. */
  app.patch("/production-runs/:id/complete", { preHandler: updatePreHandler }, async (request) => {
    const { id } = request.params as { id: string };
    return service.completeRun(id);
  });
}
