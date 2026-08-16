import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate, requirePermission } from "../middleware/auth";
import * as service from "../services/costEstimateService";

const createBodySchema = z.object({
  name: z.string().trim().min(1),
  squareFootage: z.number().positive(),
  ratePerSquareFootCents: z.number().int().positive(),
  overheadPercent: z.number().optional(),
  markupPercent: z.number().optional(),
  notes: z.string().optional(),
});

const updateBodySchema = z.object({
  name: z.string().trim().min(1).optional(),
  squareFootage: z.number().positive().optional(),
  ratePerSquareFootCents: z.number().int().positive().optional(),
  overheadPercent: z.number().nullable().optional(),
  markupPercent: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

/**
 * Real Cost Estimating routes (Phase 1.2, 2026-08-16 rollout). Gated on
 * the same `construction` RBAC module every other Construction route
 * already uses -- read/create/update/delete actions match
 * constructionSites.ts's own precedent exactly.
 */
export async function costEstimateRoutes(app: FastifyInstance) {
  app.get(
    "/construction-projects/:id/cost-estimates",
    { preHandler: [authenticate, requirePermission("construction", "read")] },
    async (request) => {
      const { id } = request.params as { id: string };
      return service.listScenarios(id);
    }
  );

  app.post(
    "/construction-projects/:id/cost-estimates",
    { preHandler: [authenticate, requirePermission("construction", "create")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = createBodySchema.parse(request.body);
      const scenario = await service.createScenario({ ...body, projectId: id, createdById: request.user!.id });
      reply.code(201).send(scenario);
    }
  );

  app.patch(
    "/cost-estimates/:id",
    { preHandler: [authenticate, requirePermission("construction", "update")] },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = updateBodySchema.parse(request.body);
      return service.updateScenario(id, body);
    }
  );

  app.delete(
    "/cost-estimates/:id",
    { preHandler: [authenticate, requirePermission("construction", "delete")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await service.deleteScenario(id);
      reply.code(204).send();
    }
  );
}
