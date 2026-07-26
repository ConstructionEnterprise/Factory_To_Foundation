import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate, requirePermission } from "../middleware/auth";
import * as service from "../services/logisticsDriverService";

const createBodySchema = z.object({
  name: z.string().trim().min(1),
});

/** Same real gap/fix as logisticsTrucks.ts — Phase 4 shipped no create route for this model either. */
export async function logisticsDriverRoutes(app: FastifyInstance) {
  app.get("/logistics-drivers", { preHandler: [authenticate, requirePermission("logistics", "read")] }, async () =>
    service.listDrivers()
  );

  app.post(
    "/logistics-drivers",
    { preHandler: [authenticate, requirePermission("logistics", "create")] },
    async (request, reply) => {
      const { name } = createBodySchema.parse(request.body);
      const driver = await service.createDriver(name);
      reply.code(201).send(driver);
    }
  );
}
