import type { FastifyInstance } from "fastify";

import { authenticate, requirePermission } from "../middleware/auth";
import * as service from "../services/logisticsKpiService";

/** Real Logistics KPI row data — read-only, gated on `logistics:read` like every other GET in this module. */
export async function logisticsKpiRoutes(app: FastifyInstance) {
  app.get(
    "/logistics-kpis",
    { preHandler: [authenticate, requirePermission("logistics", "read")] },
    async () => service.getLogisticsKpis()
  );
}
