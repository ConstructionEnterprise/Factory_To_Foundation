import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate, requirePermission } from "../middleware/auth";
import * as service from "../services/costAssemblyService";

const createAssemblyBodySchema = z.object({
  name: z.string().trim().min(1),
  unit: z.string().trim().min(1),
  description: z.string().optional(),
  assumptionNotes: z.string().optional(),
});

const addComponentBodySchema = z.object({
  marketCostRecordId: z.string().min(1),
  quantityPerUnit: z.number().positive(),
  quantitySourceName: z.string().trim().min(1),
  quantityNotes: z.string().optional(),
  productivityRecordId: z.string().optional(),
});

/**
 * Real assembly-recipe routes (2026-08-17, cost-data acquisition
 * iteration 2). Gated on the same `construction` RBAC module as
 * CostEstimateScenario/MarketCostRecord -- same domain, not a new one.
 */
export async function costAssemblyRoutes(app: FastifyInstance) {
  app.get(
    "/cost-assemblies",
    { preHandler: [authenticate, requirePermission("construction", "read")] },
    async () => service.listAssemblies()
  );

  app.get(
    "/cost-assemblies/:id",
    { preHandler: [authenticate, requirePermission("construction", "read")] },
    async (request) => {
      const { id } = request.params as { id: string };
      return service.getAssembly(id);
    }
  );

  app.post(
    "/cost-assemblies",
    { preHandler: [authenticate, requirePermission("construction", "create")] },
    async (request, reply) => {
      const body = createAssemblyBodySchema.parse(request.body);
      const assembly = await service.createAssembly({ ...body, createdById: request.user!.id });
      reply.code(201).send(assembly);
    }
  );

  app.post(
    "/cost-assemblies/:id/components",
    { preHandler: [authenticate, requirePermission("construction", "create")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = addComponentBodySchema.parse(request.body);
      const assembly = await service.addComponent(id, body);
      reply.code(201).send(assembly);
    }
  );
}
