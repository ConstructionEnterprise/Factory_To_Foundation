import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate, requirePermission } from "../middleware/auth";
import * as service from "../services/logisticsFlowService";

const createBodySchema = z.object({
  name: z.string().trim().min(1),
  constructionProjectId: z.string().min(1),
});

const listQuerySchema = z.object({
  projectId: z.string().min(1).optional(),
});

/**
 * Real Logistics Flow project-scoping routes (Phase 4.1, 2026-08-17) --
 * `LogisticsFlow` is the real project-scoped instance; `FlowPoint`/
 * `FlowConnection` remain the reusable topology beneath one. Gated on the
 * same `logistics` RBAC module flow-points/flow-connections already use.
 */
export async function logisticsFlowRoutes(app: FastifyInstance) {
  app.get("/logistics-flows", { preHandler: [authenticate, requirePermission("logistics", "read")] }, async (request) => {
    const { projectId } = listQuerySchema.parse(request.query);
    return service.listFlows(projectId);
  });

  app.get("/logistics-flows/:id", { preHandler: [authenticate, requirePermission("logistics", "read")] }, async (request) => {
    const { id } = request.params as { id: string };
    return service.getFlow(id);
  });

  /**
   * Real live-monitor payload (Phase 5, 2026-08-17) -- the map viewport's
   * Run/Refresh polls this. Read-gated only: it can write a derived-status
   * sync event as a side effect (see getFlowGraph()'s own doc comment),
   * but that's a real, honest consequence of *reading* current linked-
   * asset state, not a distinct write action a caller must separately be
   * authorized for.
   */
  app.get(
    "/logistics-flows/:id/graph",
    { preHandler: [authenticate, requirePermission("logistics", "read")] },
    async (request) => {
      const { id } = request.params as { id: string };
      return service.getFlowGraph(id, request.user!.id);
    }
  );

  app.post(
    "/logistics-flows",
    { preHandler: [authenticate, requirePermission("logistics", "create")] },
    async (request, reply) => {
      const body = createBodySchema.parse(request.body);
      const flow = await service.createFlow({ ...body, createdById: request.user!.id });
      reply.code(201).send(flow);
    }
  );
}
