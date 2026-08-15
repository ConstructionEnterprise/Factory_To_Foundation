import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate, requirePermission } from "../middleware/auth";
import * as service from "../services/flowConnectionService";

const createBodySchema = z.object({
  sourcePointId: z.string().min(1),
  targetPointId: z.string().min(1),
  relationship: z.string().trim().min(1).optional(),
  distanceMeters: z.number().nonnegative().optional(),
  notes: z.string().trim().min(1).optional(),
});

const updateBodySchema = z.object({
  relationship: z.string().trim().min(1).nullable().optional(),
  distanceMeters: z.number().nonnegative().nullable().optional(),
  notes: z.string().trim().min(1).nullable().optional(),
});

/** Logistics Flow map — real directed-connection CRUD, same `logistics` RBAC module as flowPoints.ts (see that file's doc comment for the domain-correction note). */
export async function flowConnectionRoutes(app: FastifyInstance) {
  const readPreHandler = [authenticate, requirePermission("logistics", "read")];
  const createPreHandler = [authenticate, requirePermission("logistics", "create")];
  const updatePreHandler = [authenticate, requirePermission("logistics", "update")];
  const deletePreHandler = [authenticate, requirePermission("logistics", "delete")];

  app.get("/flow-connections", { preHandler: readPreHandler }, async () => service.listConnections());

  app.post("/flow-connections", { preHandler: createPreHandler }, async (request, reply) => {
    const body = createBodySchema.parse(request.body);
    const connection = await service.createConnection(body);
    reply.code(201).send(connection);
  });

  app.patch("/flow-connections/:id", { preHandler: updatePreHandler }, async (request) => {
    const { id } = request.params as { id: string };
    const body = updateBodySchema.parse(request.body);
    return service.updateConnection(id, body);
  });

  app.delete("/flow-connections/:id", { preHandler: deletePreHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await service.deleteConnection(id);
    reply.code(204).send();
  });
}
