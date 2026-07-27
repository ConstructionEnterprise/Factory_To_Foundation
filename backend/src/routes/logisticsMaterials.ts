import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate, requirePermission } from "../middleware/auth";
import * as service from "../services/logisticsMaterialService";

const createBodySchema = z.object({
  name: z.string().trim().min(1),
  quantity: z.number().int().positive().optional(),
  location: z.string().trim().min(1).optional(),
});

/**
 * Real create/list endpoints closing the gap Phase 6 explicitly flagged as
 * unbuilt: LogisticsMaterial had schema + zero API routes since Phase 4.
 * Phase 8's real Storage Browse zone needs this to ever show anything but
 * an empty state. Gated on the same real `logistics` permissions Phase 1
 * confirmed the Dispatcher role already has.
 */
export async function logisticsMaterialRoutes(app: FastifyInstance) {
  app.get("/logistics-materials", { preHandler: [authenticate, requirePermission("logistics", "read")] }, async () =>
    service.listMaterials()
  );

  app.post(
    "/logistics-materials",
    { preHandler: [authenticate, requirePermission("logistics", "create")] },
    async (request, reply) => {
      const body = createBodySchema.parse(request.body);
      const material = await service.createMaterial(body);
      reply.code(201).send(material);
    }
  );
}
