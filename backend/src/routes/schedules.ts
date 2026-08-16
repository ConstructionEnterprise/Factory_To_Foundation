import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate, requirePermission } from "../middleware/auth";
import * as scheduleService from "../services/scheduleService";
import * as canonicalStageService from "../services/canonicalStageService";

const createScheduleBodySchema = z.object({
  title: z.string().trim().min(1),
  constructionProjectId: z.string().optional(),
});

const createStageBodySchema = z.object({
  title: z.string().trim().min(1),
  canonicalStageId: z.string().optional(),
});

const reorderBodySchema = z.object({
  stageIds: z.array(z.string().min(1)).min(1),
});

/**
 * Real Phase 2.3 Scheduling routes (docs/decisions/
 * 2026-08-16-scheduling-phase2.3-frontend-wiring-plan.md §4). Gated on
 * the existing `scheduling` module -- same real per-role grants
 * `scheduleTasks.ts` already uses, no RBAC change needed.
 */
export async function scheduleRoutes(app: FastifyInstance) {
  const read = [authenticate, requirePermission("scheduling", "read")];
  const create = [authenticate, requirePermission("scheduling", "create")];
  const update = [authenticate, requirePermission("scheduling", "update")];

  app.get("/schedules", { preHandler: read }, async () => scheduleService.listSchedules());

  app.get("/schedules/:id", { preHandler: read }, async (request) => {
    const { id } = request.params as { id: string };
    return scheduleService.getSchedule(id);
  });

  app.post("/schedules", { preHandler: create }, async (request, reply) => {
    const body = createScheduleBodySchema.parse(request.body);
    const schedule = await scheduleService.createSchedule(body.title, request.user!.id, body.constructionProjectId ?? null);
    reply.code(201).send(schedule);
  });

  app.post("/schedules/:id/stages", { preHandler: create }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = createStageBodySchema.parse(request.body);
    const schedule = await scheduleService.addStage(id, body.title, body.canonicalStageId ?? null);
    reply.code(201).send(schedule);
  });

  app.patch("/schedules/:id/stages/reorder", { preHandler: update }, async (request) => {
    const { id } = request.params as { id: string };
    const { stageIds } = reorderBodySchema.parse(request.body);
    return scheduleService.reorderStages(id, stageIds);
  });

  app.get("/canonical-stages", { preHandler: read }, async () => canonicalStageService.listCanonicalStages());
}
