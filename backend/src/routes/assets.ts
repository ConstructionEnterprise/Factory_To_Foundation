import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate, requirePermission } from "../middleware/auth";
import * as service from "../services/assetService";

const categoryEnum = z.enum(["Vehicles", "Equipment", "Tools", "Infrastructure"]);
const statusEnum = z.enum(["active", "maintenance", "retired"]);

const createSchema = z.object({
  title: z.string().trim().min(1),
  subtitle: z.string().trim().min(1),
  category: categoryEnum,
  family: z.string().trim().min(1),
  status: statusEnum,
  manufacturer: z.string().trim().min(1),
  model: z.string().trim().min(1),
  serialNumber: z.string().trim().min(1),
  assetTag: z.string().trim().min(1),
  location: z.string().trim().min(1),
  acquisitionDate: z.string(),
  lastService: z.string(),
  nextService: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const updateSchema = createSchema.partial();

/**
 * Closes a real gap, not a new invention: the "assets" RBAC module and its
 * per-role permission grants already exist (backend/prisma/seed.ts) --
 * this is what was missing underneath it, same shape as Logistics'
 * material/dispatch routes closing a schema-without-routes gap.
 */
export async function assetRoutes(app: FastifyInstance) {
  const readPreHandler = [authenticate, requirePermission("assets", "read")];
  const createPreHandler = [authenticate, requirePermission("assets", "create")];
  const updatePreHandler = [authenticate, requirePermission("assets", "update")];
  const deletePreHandler = [authenticate, requirePermission("assets", "delete")];

  app.get("/assets", { preHandler: readPreHandler }, async () => service.listAssets());

  app.post("/assets", { preHandler: createPreHandler }, async (request, reply) => {
    const body = createSchema.parse(request.body);
    const asset = await service.createAsset(body);
    reply.code(201).send(asset);
  });

  app.patch("/assets/:id", { preHandler: updatePreHandler }, async (request) => {
    const { id } = request.params as { id: string };
    const patch = updateSchema.parse(request.body);
    return service.updateAsset(id, patch);
  });

  app.delete("/assets/:id", { preHandler: deletePreHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await service.deleteAsset(id);
    reply.code(204).send();
  });
}
