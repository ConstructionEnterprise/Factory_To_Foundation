import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate, requirePermission } from "../middleware/auth";
import * as service from "../services/scheduleTaskService";

const createTaskSchema = z.object({
  title: z.string().min(1),
  scheduleId: z.string().optional(),
  stageId: z.string().optional(),
  ownedByModuleId: z.string().optional(),
  plannedStart: z.string(),
  plannedEnd: z.string(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  plannedStart: z.string().optional(),
  plannedEnd: z.string().optional(),
  actualStart: z.string().nullable().optional(),
  actualEnd: z.string().nullable().optional(),
});

const transitionSchema = z.object({
  toStatus: z.enum(["planned", "in_progress", "blocked", "complete"]),
  notes: z.string().trim().min(1).optional(),
});

const createDependencySchema = z.object({
  predecessorId: z.string().min(1),
  successorId: z.string().min(1),
});

/**
 * Real ScheduleTask directory (Phase 1 schema) — read used by Analytics
 * (A5) and Scheduling itself (A7); create/update/status-transition/delete
 * added here for A7's real Interactive Gantt Timeline (drag-to-move/
 * resize) and Heat Map (real planned-vs-actual, real status).
 */
export async function scheduleTaskRoutes(app: FastifyInstance) {
  const readPreHandler = [authenticate, requirePermission("scheduling", "read")];
  const createPreHandler = [authenticate, requirePermission("scheduling", "create")];
  const updatePreHandler = [authenticate, requirePermission("scheduling", "update")];
  const deletePreHandler = [authenticate, requirePermission("scheduling", "delete")];

  app.get("/schedule-tasks", { preHandler: readPreHandler }, async () => {
    return service.getScheduleTaskDirectory();
  });

  /** Real cross-task recent activity for Analytics' Events feed (Phase 1.3, 2026-08-16 rollout). */
  app.get("/schedule-tasks/events/recent", { preHandler: readPreHandler }, async () => {
    return service.listRecentStatusEvents(10);
  });

  app.post("/schedule-tasks", { preHandler: createPreHandler }, async (request) => {
    const body = createTaskSchema.parse(request.body);
    return service.createTask({ ...body, changedById: request.user!.id });
  });

  app.patch("/schedule-tasks/:id", { preHandler: updatePreHandler }, async (request) => {
    const { id } = request.params as { id: string };
    const patch = updateTaskSchema.parse(request.body);
    return service.updateTaskDates(id, patch);
  });

  app.patch("/schedule-tasks/:id/status", { preHandler: updatePreHandler }, async (request) => {
    const { id } = request.params as { id: string };
    const { toStatus, notes } = transitionSchema.parse(request.body);
    return service.transitionStatus(id, toStatus, request.user!.id, notes);
  });

  app.delete("/schedule-tasks/:id", { preHandler: deletePreHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await service.deleteTask(id);
    reply.code(204).send();
  });

  app.post("/schedule-task-dependencies", { preHandler: createPreHandler }, async (request) => {
    const { predecessorId, successorId } = createDependencySchema.parse(request.body);
    return service.createDependency(predecessorId, successorId);
  });
}
