import type { FastifyInstance } from "fastify";

import { authenticate, requirePermission } from "../middleware/auth";
import * as service from "../services/constructionRelationshipsService";

/**
 * Real Construction Data Map read route (Phase 1.1, 2026-08-16 rollout).
 * Gated on the same `construction` RBAC module every other Construction
 * route already uses.
 */
export async function constructionRelationshipsRoutes(app: FastifyInstance) {
  app.get(
    "/construction-projects/:id/relationships",
    { preHandler: [authenticate, requirePermission("construction", "read")] },
    async (request) => {
      const { id } = request.params as { id: string };
      return service.getProjectRelationships(id);
    }
  );
}
