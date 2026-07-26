import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate, requirePermission } from "../middleware/auth";
import * as service from "../services/logisticsTruckService";

const createBodySchema = z.object({
  identifier: z.string().trim().min(1),
});

/**
 * Real create endpoint that didn't exist after Phase 4 — that phase shipped
 * schema + migration only (no API routes, disclosed explicitly in
 * CLAUDE.md). Gated on the same real `logistics` permissions Phase 1
 * confirmed the Dispatcher role already has.
 */
export async function logisticsTruckRoutes(app: FastifyInstance) {
  app.get("/logistics-trucks", { preHandler: [authenticate, requirePermission("logistics", "read")] }, async () =>
    service.listTrucks()
  );

  app.post(
    "/logistics-trucks",
    { preHandler: [authenticate, requirePermission("logistics", "create")] },
    async (request, reply) => {
      const { identifier } = createBodySchema.parse(request.body);
      const truck = await service.createTruck(identifier);
      reply.code(201).send(truck);
    }
  );
}
