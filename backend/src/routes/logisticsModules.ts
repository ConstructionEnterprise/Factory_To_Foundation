import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate, requirePermission } from "../middleware/auth";
import * as service from "../services/logisticsModuleService";

const createBodySchema = z.object({
  name: z.string().trim().min(1),
  location: z.string().trim().min(1).optional(),
  dispatchId: z.string().min(1).optional(),
});

/** Same real gap/fix as logisticsMaterials.ts — Phase 4 shipped no create route for this model either. */
export async function logisticsModuleRoutes(app: FastifyInstance) {
  app.get("/logistics-modules", { preHandler: [authenticate, requirePermission("logistics", "read")] }, async () =>
    service.listModules()
  );

  app.post(
    "/logistics-modules",
    { preHandler: [authenticate, requirePermission("logistics", "create")] },
    async (request, reply) => {
      const body = createBodySchema.parse(request.body);
      const module_ = await service.createModule(body);
      reply.code(201).send(module_);
    }
  );
}
