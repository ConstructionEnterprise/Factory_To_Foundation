import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate, requirePermission } from "../middleware/auth";
import * as service from "../services/vehicleService";

const createBodySchema = z.object({
  identifier: z.string().trim().min(1),
  vehicleClass: z.enum(["autonomous_dolly", "trailer", "forklift"]),
  status: z.enum(["active", "maintenance", "retired"]).optional(),
  location: z.string().trim().min(1).optional(),
});

/**
 * Real Fleet routes (Phase 3.4, 2026-08-15 rollout; create added
 * 2026-08-17). Fleet is a sibling capability of Logistics Flow inside the
 * Logistics domain (see the plan doc's §0.1 locked decision), so it's
 * gated on the same real `logistics` RBAC module every other Logistics
 * route already uses -- never a new, separate permission a role would
 * need granting for. `vehicleClass: "truck"` is deliberately rejected by
 * the service -- see vehicleService.createVehicle's doc comment.
 */
export async function vehicleRoutes(app: FastifyInstance) {
  app.get("/vehicles", { preHandler: [authenticate, requirePermission("logistics", "read")] }, async () =>
    service.listVehicles()
  );

  app.get("/vehicles/:id", { preHandler: [authenticate, requirePermission("logistics", "read")] }, async (request) => {
    const { id } = request.params as { id: string };
    return service.getVehicle(id);
  });

  app.post(
    "/vehicles",
    { preHandler: [authenticate, requirePermission("logistics", "create")] },
    async (request, reply) => {
      const body = createBodySchema.parse(request.body);
      const vehicle = await service.createVehicle(body);
      reply.code(201).send(vehicle);
    }
  );
}
