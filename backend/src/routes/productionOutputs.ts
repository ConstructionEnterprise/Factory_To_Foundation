import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate, requirePermission } from "../middleware/auth";
import * as service from "../services/productionOutputService";

const createOutputBodySchema = z.object({
  productionRunId: z.string().min(1),
  serialNumber: z.string().trim().min(1),
  destinationProjectId: z.string().optional(),
  destinationTreeNodeId: z.string().optional(),
});

const listQuerySchema = z.object({
  productionRunId: z.string().min(1).optional(),
});

const transitionStatusBodySchema = z.object({
  toStatus: z.enum(["in_production", "complete"]),
  toQcStatus: z.enum(["pending", "passed", "failed"]).optional(),
  reason: z.string().trim().min(1).optional(),
});

/**
 * Real ProductionOutput routes (Phase 9, 2026-08-17) -- the physical-
 * result identity Manufacturing/Factory production creates, which
 * Inventory/Logistics/Genealogy then consume via the shared InventoryItem
 * link rather than duplicating it. Same `manufacturing` module as
 * productionRuns.ts.
 */
export async function productionOutputRoutes(app: FastifyInstance) {
  const readPreHandler = [authenticate, requirePermission("manufacturing", "read")];
  const createPreHandler = [authenticate, requirePermission("manufacturing", "create")];
  const updatePreHandler = [authenticate, requirePermission("manufacturing", "update")];

  app.get("/production-outputs", { preHandler: readPreHandler }, async (request) => {
    const { productionRunId } = listQuerySchema.parse(request.query);
    return service.listOutputs(productionRunId);
  });

  app.get("/production-outputs/:id", { preHandler: readPreHandler }, async (request) => {
    const { id } = request.params as { id: string };
    return service.getOutput(id);
  });

  app.post("/production-outputs", { preHandler: createPreHandler }, async (request, reply) => {
    const body = createOutputBodySchema.parse(request.body);
    const output = await service.createOutput({ ...body, createdById: request.user!.id });
    reply.code(201).send(output);
  });

  app.patch("/production-outputs/:id/status", { preHandler: updatePreHandler }, async (request) => {
    const { id } = request.params as { id: string };
    const body = transitionStatusBodySchema.parse(request.body);
    return service.transitionOutputStatus(id, body.toStatus, request.user!.id, body.toQcStatus, body.reason);
  });

  app.get("/production-outputs/:id/status-events", { preHandler: readPreHandler }, async (request) => {
    const { id } = request.params as { id: string };
    return service.listStatusEvents(id);
  });
}
