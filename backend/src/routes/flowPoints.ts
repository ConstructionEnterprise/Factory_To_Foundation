import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate, requirePermission } from "../middleware/auth";
import * as service from "../services/flowPointService";

const createBodySchema = z.object({
  type: z.string().trim().min(1),
  name: z.string().trim().min(1),
  positionX: z.number(),
  positionY: z.number(),
  assetRef: z.string().trim().min(1).optional(),
  status: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).optional(),
});

const updateBodySchema = z.object({
  type: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
  assetRef: z.string().trim().min(1).nullable().optional(),
  status: z.string().trim().min(1).nullable().optional(),
  notes: z.string().trim().min(1).nullable().optional(),
});

/**
 * Logistics Flow map — real point CRUD. Gated on the existing `logistics`
 * RBAC module, not a new module — matches the "reference/reuse an existing
 * module before inventing a new one" discipline used throughout this
 * backend. Domain correction (2026-08-14): this feature was originally
 * placed under `manufacturing`; the underlying FlowPoint/FlowConnection
 * model was confirmed domain-neutral on review and moved to Logistics,
 * where it represents point-to-point movement relationships (internal
 * material flow today, expected to grow to autonomous dolly movement,
 * staging, and yard flow) rather than a Manufacturing concept.
 */
export async function flowPointRoutes(app: FastifyInstance) {
  const readPreHandler = [authenticate, requirePermission("logistics", "read")];
  const createPreHandler = [authenticate, requirePermission("logistics", "create")];
  const updatePreHandler = [authenticate, requirePermission("logistics", "update")];
  const deletePreHandler = [authenticate, requirePermission("logistics", "delete")];

  app.get("/flow-points", { preHandler: readPreHandler }, async () => service.listPoints());

  app.post("/flow-points", { preHandler: createPreHandler }, async (request, reply) => {
    const body = createBodySchema.parse(request.body);
    const point = await service.createPoint(body);
    reply.code(201).send(point);
  });

  app.patch("/flow-points/:id", { preHandler: updatePreHandler }, async (request) => {
    const { id } = request.params as { id: string };
    const body = updateBodySchema.parse(request.body);
    return service.updatePoint(id, body);
  });

  app.delete("/flow-points/:id", { preHandler: deletePreHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await service.deletePoint(id);
    reply.code(204).send();
  });
}
