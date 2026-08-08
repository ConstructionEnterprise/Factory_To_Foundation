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
  odometerStart: z.number().nonnegative().optional(),
  businessPurpose: z.string().trim().min(1).optional(),
});

const transitionBodySchema = z.object({
  toStatus: z.enum(["staged", "in_transit", "delivered"]),
  notes: z.string().trim().min(1).optional(),
});

const mileageBodySchema = z
  .object({
    odometerStart: z.number().nonnegative().optional(),
    odometerEnd: z.number().nonnegative().optional(),
    businessPurpose: z.string().trim().min(1).optional(),
  })
  .refine((b) => b.odometerStart !== undefined || b.odometerEnd !== undefined || b.businessPurpose !== undefined, {
    message: "Provide at least one of odometerStart, odometerEnd, businessPurpose.",
  });

/**
 * Real create endpoint closing the gap Phase 5 flagged: nothing in the app
 * could create a real Dispatch. Gated on `logistics:create` — same
 * confirmed-already-granted Dispatcher permission as the other 2 new route
 * files. `status`/`dispatchedAt` are never client-supplied — real defaults
 * (staged / now()) own those, matching the schema's own design.
 *
 * Phase 7 adds the real chain-of-custody status-transition route and its
 * read-side (the event history) — gated on `logistics:update`/`read`
 * respectively, the same real Dispatcher grants Phase 1 already confirmed.
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
      const dispatch = await service.createDispatch({ ...body, createdById: request.user!.id });
      reply.code(201).send(dispatch);
    }
  );

  app.patch(
    "/logistics-dispatches/:id/status",
    { preHandler: [authenticate, requirePermission("logistics", "update")] },
    async (request) => {
      const { id } = request.params as { id: string };
      const { toStatus, notes } = transitionBodySchema.parse(request.body);
      return service.transitionStatus(id, toStatus, request.user!.id, notes);
    }
  );

  app.get(
    "/logistics-dispatches/:id/events",
    { preHandler: [authenticate, requirePermission("logistics", "read")] },
    async (request) => {
      const { id } = request.params as { id: string };
      return service.listCustodyEvents(id);
    }
  );

  /**
   * Real, separate mileage-recording endpoint — not folded into the status-
   * transition route, since setting an odometer reading isn't itself a
   * chain-of-custody status change (a driver might record a starting
   * reading well before "in_transit", or an ending reading after
   * "delivered" already fired). Gated on the same `logistics:update` grant
   * as the status-transition route.
   */
  app.patch(
    "/logistics-dispatches/:id/mileage",
    { preHandler: [authenticate, requirePermission("logistics", "update")] },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = mileageBodySchema.parse(request.body);
      return service.recordMileage(id, body);
    }
  );

  /**
   * Real "push to tax report" endpoint (Phase 2 of the pilot mileage-
   * tracking feature) — gated on the same `logistics:update` grant as
   * mileage recording, since this is a real state change on the dispatch,
   * not a read. service.pushToTaxReport() owns the real eligibility
   * validation (delivered + complete mileage + business purpose).
   */
  app.patch(
    "/logistics-dispatches/:id/tax-report",
    { preHandler: [authenticate, requirePermission("logistics", "update")] },
    async (request) => {
      const { id } = request.params as { id: string };
      return service.pushToTaxReport(id, request.user!.id);
    }
  );

  /**
   * The real Mileage Tax Report — every dispatch actually pushed, each with
   * the real IRS rate in effect on that trip's own date. Read-only, gated
   * on `logistics:read` like every other GET in this module.
   */
  app.get(
    "/logistics-mileage-tax-report",
    { preHandler: [authenticate, requirePermission("logistics", "read")] },
    async () => service.listTaxReportEntries()
  );
}
