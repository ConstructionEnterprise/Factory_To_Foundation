import type { FastifyInstance } from "fastify";

import { authenticate, requirePermission } from "../middleware/auth";
import * as service from "../services/vehicleService";

/**
 * Real Fleet read routes (Phase 3.4, 2026-08-15 rollout). Fleet is a
 * sibling capability of Logistics Flow inside the Logistics domain (see
 * the plan doc's §0.1 locked decision), so it's gated on the same real
 * `logistics` RBAC module every other Logistics route already uses --
 * never a new, separate permission a role would need granting for.
 */
export async function vehicleRoutes(app: FastifyInstance) {
  app.get("/vehicles", { preHandler: [authenticate, requirePermission("logistics", "read")] }, async () =>
    service.listVehicles()
  );

  app.get("/vehicles/:id", { preHandler: [authenticate, requirePermission("logistics", "read")] }, async (request) => {
    const { id } = request.params as { id: string };
    return service.getVehicle(id);
  });
}
