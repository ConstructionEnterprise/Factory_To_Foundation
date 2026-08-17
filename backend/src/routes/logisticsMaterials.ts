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
 * an empty state.
 *
 * Gated on the real `materials` module (Phase 3, 2026-08-17) -- Materials
 * was promoted to a first-class Inventory capability alongside Assets/
 * Genealogy, so it gets its own dedicated permission grain like they do,
 * not `logistics`. Every role's `materials` grant in seed.ts's real RBAC
 * matrix was set to mirror its own pre-existing `logistics` grant exactly,
 * so this rename preserves real current access rather than silently
 * changing who can do what.
 */
export async function logisticsMaterialRoutes(app: FastifyInstance) {
  app.get("/logistics-materials", { preHandler: [authenticate, requirePermission("materials", "read")] }, async () =>
    service.listMaterials()
  );

  app.post(
    "/logistics-materials",
    { preHandler: [authenticate, requirePermission("materials", "create")] },
    async (request, reply) => {
      const body = createBodySchema.parse(request.body);
      const material = await service.createMaterial(body);
      reply.code(201).send(material);
    }
  );
}
