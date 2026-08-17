import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate, requirePermission } from "../middleware/auth";
import * as marketCostRecordService from "../services/marketCostRecordService";
import * as service from "../services/materialInventoryService";

const createCatalogItemBodySchema = z.object({
  name: z.string().trim().min(1),
  sku: z.string().trim().min(1).optional(),
  unit: z.string().trim().min(1),
});

const linkCatalogItemBodySchema = z.object({
  materialCatalogItemId: z.string().min(1),
});

const transactionBodySchema = z.object({
  quantity: z.number().int().positive(),
  reason: z.string().trim().min(1).optional(),
});

const productionTransactionBodySchema = transactionBodySchema.extend({
  productionRunId: z.string().min(1),
});

/**
 * Real material inventory routes (Phase 8, 2026-08-17) -- MaterialCatalogItem
 * identity, plus the real reserve/release/consume/receive ledger operations.
 * Gated on the existing `materials` module, same permission grain the
 * Materials Inventory capability already uses -- no new RBAC module needed.
 */
export async function materialInventoryRoutes(app: FastifyInstance) {
  const readPreHandler = [authenticate, requirePermission("materials", "read")];
  const createPreHandler = [authenticate, requirePermission("materials", "create")];
  const updatePreHandler = [authenticate, requirePermission("materials", "update")];

  app.get("/material-catalog-items", { preHandler: readPreHandler }, async () => service.listCatalogItems());

  app.post("/material-catalog-items", { preHandler: createPreHandler }, async (request, reply) => {
    const body = createCatalogItemBodySchema.parse(request.body);
    const item = await service.createCatalogItem(body, request.user!.id);
    reply.code(201).send(item);
  });

  app.patch("/logistics-materials/:id/catalog-link", { preHandler: updatePreHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { materialCatalogItemId } = linkCatalogItemBodySchema.parse(request.body);
    await service.linkMaterialToCatalogItem(id, materialCatalogItemId);
    reply.code(204).send();
  });

  /** Real bridge from a real MarketCostRecord (estimating BOM) to the stable MaterialCatalogItem identity -- see MaterialCatalogItem's own schema doc comment. Gated on `construction`, matching marketCostRecordRoutes.ts's own module. */
  app.patch(
    "/market-cost-records/:id/catalog-link",
    { preHandler: [authenticate, requirePermission("construction", "update")] },
    async (request) => {
      const { id } = request.params as { id: string };
      const { materialCatalogItemId } = linkCatalogItemBodySchema.parse(request.body);
      return marketCostRecordService.linkCatalogItem(id, materialCatalogItemId);
    }
  );

  app.get("/logistics-materials/:id/inventory-events", { preHandler: readPreHandler }, async (request) => {
    const { id } = request.params as { id: string };
    return service.listEventsForMaterial(id);
  });

  app.post("/logistics-materials/:id/receive", { preHandler: updatePreHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { quantity, reason } = transactionBodySchema.parse(request.body);
    const event = await service.receiveStock(id, quantity, request.user!.id, reason);
    reply.code(201).send(event);
  });

  app.post("/logistics-materials/:id/reserve", { preHandler: updatePreHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { quantity, productionRunId, reason } = productionTransactionBodySchema.parse(request.body);
    const event = await service.reserveQuantity(id, quantity, productionRunId, request.user!.id, reason);
    reply.code(201).send(event);
  });

  app.post("/logistics-materials/:id/release", { preHandler: updatePreHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { quantity, productionRunId, reason } = productionTransactionBodySchema.parse(request.body);
    const event = await service.releaseReservation(id, quantity, productionRunId, request.user!.id, reason);
    reply.code(201).send(event);
  });

  app.post("/logistics-materials/:id/consume", { preHandler: updatePreHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { quantity, productionRunId, reason } = productionTransactionBodySchema.parse(request.body);
    const event = await service.consumeQuantity(id, quantity, productionRunId, request.user!.id, reason);
    reply.code(201).send(event);
  });
}
