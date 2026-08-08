import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate, requirePermission } from "../middleware/auth";
import * as service from "../services/mileageRateService";

const createBodySchema = z.object({
  centsPerMile: z.number().positive(),
  effectiveDate: z.string().datetime(),
});

/**
 * Real, configurable IRS standard mileage rate — Phase 1 of the pilot
 * mileage-tracking feature. Gated on the same real `logistics` permissions
 * every other Logistics route already uses (list = read, create = update,
 * since setting the rate is a configuration change to how existing
 * Logistics data gets interpreted at export time, not a new record the way
 * `create` means elsewhere in this module).
 */
export async function mileageRateRoutes(app: FastifyInstance) {
  app.get("/mileage-rates", { preHandler: [authenticate, requirePermission("logistics", "read")] }, async () =>
    service.listRates()
  );

  app.post(
    "/mileage-rates",
    { preHandler: [authenticate, requirePermission("logistics", "update")] },
    async (request, reply) => {
      const body = createBodySchema.parse(request.body);
      const rate = await service.createRate({ ...body, createdById: request.user!.id });
      reply.code(201).send(rate);
    }
  );
}
