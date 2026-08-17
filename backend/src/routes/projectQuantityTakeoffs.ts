import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate, requirePermission } from "../middleware/auth";
import * as service from "../services/projectQuantityTakeoffService";

const createBodySchema = z.object({
  buildingTreeNodeId: z.string().optional(),
  assemblyId: z.string().min(1),
  costEstimateScenarioId: z.string().optional(),
  quantity: z.number().positive(),
  unit: z.string().trim().min(1),
  methodology: z.string().trim().min(1),
  sourceNotes: z.string().optional(),
});

/**
 * Real project quantity takeoff routes (2026-08-17, cost-data acquisition
 * iteration 4). Gated on the same `construction` RBAC module as the rest
 * of this reference-data surface.
 */
export async function projectQuantityTakeoffRoutes(app: FastifyInstance) {
  app.get(
    "/construction-projects/:id/quantity-takeoffs",
    { preHandler: [authenticate, requirePermission("construction", "read")] },
    async (request) => {
      const { id } = request.params as { id: string };
      return service.listTakeoffsForProject(id);
    }
  );

  app.post(
    "/construction-projects/:id/quantity-takeoffs",
    { preHandler: [authenticate, requirePermission("construction", "create")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = createBodySchema.parse(request.body);
      const takeoff = await service.createTakeoff({ ...body, constructionProjectId: id, enteredById: request.user!.id });
      reply.code(201).send(takeoff);
    }
  );
}
