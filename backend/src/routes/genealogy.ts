import type { FastifyInstance } from "fastify";

import { authenticate, requirePermission } from "../middleware/auth";
import * as service from "../services/genealogyService";

/**
 * Real GenealogyNode/GenealogyEdge read routes — closes the real gap found
 * 2026-08-15: the schema and 13/12 real seeded rows have existed since the
 * initial migration, but no route ever read them, so the live frontend
 * rendered a separate hardcoded fixture (features/genealogy/graphData.ts)
 * instead of this real data. Gated on the `genealogy` RBAC module, already
 * seeded with real per-role grants (backend/prisma/seed.ts) from before
 * any route existed to use them.
 */
export async function genealogyRoutes(app: FastifyInstance) {
  const readPreHandler = [authenticate, requirePermission("genealogy", "read")];

  app.get("/genealogy-nodes", { preHandler: readPreHandler }, async () => service.listNodes());
  app.get("/genealogy-edges", { preHandler: readPreHandler }, async () => service.listEdges());
}
