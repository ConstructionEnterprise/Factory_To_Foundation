import type { FastifyInstance } from "fastify";

import { authenticate, requirePermission } from "../middleware/auth";
import * as service from "../services/networkService";

/**
 * Real Networking module (the real factory IT/OT infrastructure module,
 * genuinely distinct from Permissions — see prisma/seed.ts's MODULES
 * comment for the rename history). One combined read endpoint: the real
 * device inventory + VLAN topology are always rendered together, so there's
 * no real reason for a caller to fetch one without the other. Gated on the
 * real `networking` module (freed for this purpose by the Permissions
 * Migration), read-only per the brief's explicit scope.
 */
export async function networkRoutes(app: FastifyInstance) {
  app.get("/network-topology", { preHandler: [authenticate, requirePermission("networking", "read")] }, async () => {
    return service.getNetworkTopology();
  });
}
