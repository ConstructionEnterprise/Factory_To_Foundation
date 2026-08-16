import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate } from "../middleware/auth";
import { NotFoundError } from "../lib/httpErrors";
import * as service from "../services/inventoryItemService";

const listQuerySchema = z.object({
  query: z.string().trim().min(1).optional(),
});

/**
 * Real Inventory read routes — the shared identity layer over Asset and
 * GenealogyNode (see InventoryItem's own schema.prisma doc comment).
 * Deliberately no requirePermission preHandler gating the whole route: per
 * -kind visibility is resolved inside inventoryItemService.ts against the
 * caller's real, already-seeded assets/genealogy grants, so a role's real
 * Inventory view exactly matches what it can already see in Assets and
 * Genealogy separately, never wider.
 */
export async function inventoryItemRoutes(app: FastifyInstance) {
  app.get("/inventory-items", { preHandler: [authenticate] }, async (request) => {
    const { query } = listQuerySchema.parse(request.query);
    return service.listItems(request.user!.roleId, query);
  });

  app.get("/inventory-items/:id", { preHandler: [authenticate] }, async (request) => {
    const { id } = request.params as { id: string };
    const item = await service.getItem(request.user!.roleId, id);
    if (!item) throw new NotFoundError(`No inventory item with id "${id}"`);
    return item;
  });
}
