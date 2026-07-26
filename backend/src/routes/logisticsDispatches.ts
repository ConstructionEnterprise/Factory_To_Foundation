import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate, requirePermission } from "../middleware/auth";
import * as service from "../services/logisticsDispatchService";

const createBodySchema = z.object({
  truckId: z.string().min(1),
  driverId: z.string().min(1),
  destinationProjectId: z.string().min(1),
  eta: z.string().datetime().optional(),
  route: z.string().trim().min(1).optional(),
  traffic: z.string().trim().min(1).optional(),
});

/**
 * Real create endpoint closing the gap Phase 5 flagged: nothing in the app
 * could create a real Dispatch. Gated on `logistics:create` — same
 * confirmed-already-granted Dispatcher permission as the other 2 new route
 * files. `status`/`dispatchedAt` are never client-supplied — real defaults
 * (staged / now()) own those, matching the schema's own design.
 */
export async function logisticsDispatchRoutes(app: FastifyInstance) {
  app.get("/logistics-dispatches", { preHandler: [authenticate, requirePermission("logistics", "read")] }, async () =>
    service.listDispatches()
  );

  app.post(
    "/logistics-dispatches",
    { preHandler: [authenticate, requirePermission("logistics", "create")] },
    async (request, reply) => {
      const body = createBodySchema.parse(request.body);
      const dispatch = await service.createDispatch(body);
      reply.code(201).send(dispatch);
    }
  );
}
