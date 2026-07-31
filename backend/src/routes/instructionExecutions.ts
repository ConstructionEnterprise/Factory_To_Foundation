import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate, requirePermission } from "../middleware/auth";
import * as service from "../services/instructionExecutionService";

const commandSchema = z.object({
  command: z.string(),
  params: z.record(z.string(), z.unknown()),
  ok: z.boolean(),
  reason: z.string().optional(),
});

const logExecutionBodySchema = z.object({
  instructionSet: z.object({
    sourceObjectId: z.string().min(1),
    generatedAt: z.string(),
    elementSpecJson: z.unknown().optional(),
    fabricationNotesJson: z.unknown().optional(),
  }),
  step: z.object({
    sequence: z.number().int(),
    targetSubsystemId: z.string().min(1),
    realCommandTarget: z.string().min(1),
    targetType: z.string().min(1),
    action: z.string().min(1),
    relatedObjectId: z.string().optional(),
    estimatedDurationSec: z.number().int().nonnegative(),
    dispatchJson: z.unknown().optional(),
    codeJson: z.unknown().optional(),
    reachabilityIssue: z.string().optional(),
  }),
  execution: z.object({
    ok: z.boolean(),
    commandsJson: z.array(commandSchema),
    twinFrameAtDispatch: z.number().int().optional(),
  }),
});

/**
 * Real audit-trail write path — one route, gated the same way Factory's
 * own real Execute button already is (factory:execute), since this is only
 * ever called as the direct, immediate result of that same real click
 * (features/factory/FactoryInstructions.tsx -> twinExecute.ts). Never a
 * batch/replay endpoint.
 */
export async function instructionExecutionRoutes(app: FastifyInstance) {
  const executePreHandler = [authenticate, requirePermission("factory", "execute")];
  const readPreHandler = [authenticate, requirePermission("analytics", "read")];

  app.post("/instruction-executions", { preHandler: executePreHandler }, async (request) => {
    const body = logExecutionBodySchema.parse(request.body);
    return service.logExecution({ ...body, userId: request.user!.id });
  });

  // Real read for Analytics' Production Output / Work Cell Performance
  // widgets (Phase 5) — gated on analytics:read, not factory:execute, since
  // reading the history is a different real permission than causing one.
  app.get("/instruction-executions", { preHandler: readPreHandler }, async (request) => {
    const { targetSubsystemId } = request.query as { targetSubsystemId?: string };
    return service.listExecutionHistory(targetSubsystemId);
  });
}
