import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate, requirePermission } from "../middleware/auth";
import * as service from "../services/moduleSequenceService";

const createBodySchema = z.object({
  inventoryItemId: z.string().min(1),
});

const statusBodySchema = z.object({
  toStatus: z.enum(["pending", "site_arrival", "site_acceptance", "installation", "placement", "complete"]),
  notes: z.string().optional(),
});

const positionBodySchema = z.object({
  sequencePosition: z.number().int().nullable(),
});

const dependencyBodySchema = z.object({
  blockingEntryId: z.string().min(1),
});

/**
 * Real Modular Sequencing routes (Phase 2.2, 2026-08-16 rollout). Gated
 * on `construction` -- this is a Construction domain, not Logistics or
 * Inventory, despite anchoring on InventoryItem for identity (see
 * schema.prisma's Modular Sequencing section header comment).
 */
export async function moduleSequenceRoutes(app: FastifyInstance) {
  app.get(
    "/construction-projects/:id/module-sequences",
    { preHandler: [authenticate, requirePermission("construction", "read")] },
    async (request) => {
      const { id } = request.params as { id: string };
      return service.listEntriesForProject(id);
    }
  );

  app.get(
    "/construction-projects/:id/eligible-sequence-modules",
    { preHandler: [authenticate, requirePermission("construction", "read")] },
    async (request) => {
      const { id } = request.params as { id: string };
      return service.listEligibleModules(id);
    }
  );

  app.post(
    "/construction-projects/:id/module-sequences",
    { preHandler: [authenticate, requirePermission("construction", "create")] },
    async (request, reply) => {
      const body = createBodySchema.parse(request.body);
      const entry = await service.createEntry(body.inventoryItemId, request.user!.id);
      reply.code(201).send(entry);
    }
  );

  app.patch(
    "/module-sequences/:id/status",
    { preHandler: [authenticate, requirePermission("construction", "update")] },
    async (request) => {
      const { id } = request.params as { id: string };
      const { toStatus, notes } = statusBodySchema.parse(request.body);
      return service.transitionStatus(id, toStatus, request.user!.id, notes);
    }
  );

  app.patch(
    "/module-sequences/:id/position",
    { preHandler: [authenticate, requirePermission("construction", "update")] },
    async (request) => {
      const { id } = request.params as { id: string };
      const { sequencePosition } = positionBodySchema.parse(request.body);
      return service.updatePosition(id, sequencePosition);
    }
  );

  app.get(
    "/module-sequences/:id/events",
    { preHandler: [authenticate, requirePermission("construction", "read")] },
    async (request) => {
      const { id } = request.params as { id: string };
      return service.listEvents(id);
    }
  );

  app.post(
    "/module-sequences/:id/dependencies",
    { preHandler: [authenticate, requirePermission("construction", "update")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { blockingEntryId } = dependencyBodySchema.parse(request.body);
      await service.addDependency(blockingEntryId, id);
      reply.code(201).send({ blockingEntryId, blockedEntryId: id });
    }
  );
}
