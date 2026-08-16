import type { ScheduleTaskStatus } from "@prisma/client";

import { prisma } from "../lib/prisma";

/** Real ScheduleTask rows (Phase 1 schema). Read side used by Analytics (A5); Phase 7 (Scheduling's own Gantt/Heat Map, this file's other functions) adds real create/update/status-transition/delete. */
export function listTasks() {
  return prisma.scheduleTask.findMany({
    orderBy: { plannedStart: "asc" },
  });
}

/** Real cross-task recent activity for Analytics' Events feed (Phase 1.3, 2026-08-16 rollout). */
export function findRecentStatusEvents(limit: number) {
  return prisma.scheduleTaskStatusEvent.findMany({
    orderBy: { changedAt: "desc" },
    take: limit,
    include: { task: { select: { title: true } } },
  });
}

export function listDependencies() {
  return prisma.scheduleTaskDependency.findMany({
    select: { predecessorId: true, successorId: true },
  });
}

export function findTaskById(id: string) {
  return prisma.scheduleTask.findUnique({ where: { id } });
}

export type CreateTaskInput = {
  title: string;
  stageId: string | null;
  ownedByModuleId: string | null;
  plannedStart: Date;
  plannedEnd: Date;
  changedById: string;
};

/** Real, atomic: the task row and its own real creation status-event (fromStatus null -> toStatus planned) are written in one transaction, same pattern as LogisticsCustodyEvent — a task can never exist without a matching first status event. */
export function createTask(data: CreateTaskInput) {
  return prisma.$transaction(async (tx) => {
    const task = await tx.scheduleTask.create({
      data: {
        title: data.title,
        stageId: data.stageId,
        ownedByModuleId: data.ownedByModuleId,
        plannedStart: data.plannedStart,
        plannedEnd: data.plannedEnd,
      },
    });
    await tx.scheduleTaskStatusEvent.create({
      data: { taskId: task.id, fromStatus: null, toStatus: task.status, changedById: data.changedById },
    });
    return task;
  });
}

export type UpdateTaskDatesInput = {
  title?: string;
  plannedStart?: Date;
  plannedEnd?: Date;
  actualStart?: Date | null;
  actualEnd?: Date | null;
};

/** Real drag-to-move/drag-to-resize persistence — dates/title only, never status (see transitionStatus for that, which needs its own audit event). */
export function updateTaskDates(id: string, patch: UpdateTaskDatesInput) {
  return prisma.scheduleTask.update({ where: { id }, data: patch });
}

export type TransitionStatusInput = {
  taskId: string;
  fromStatus: ScheduleTaskStatus;
  toStatus: ScheduleTaskStatus;
  changedById: string;
  notes: string | null;
};

/** Real, atomic status update + audit event — same pattern as LogisticsCustodyEvent's own transitionStatus. */
export function transitionStatus(input: TransitionStatusInput) {
  return prisma.$transaction(async (tx) => {
    const task = await tx.scheduleTask.update({ where: { id: input.taskId }, data: { status: input.toStatus } });
    const event = await tx.scheduleTaskStatusEvent.create({
      data: {
        taskId: input.taskId,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        changedById: input.changedById,
        notes: input.notes,
      },
    });
    return { task, event };
  });
}

export function deleteTask(id: string) {
  return prisma.scheduleTask.delete({ where: { id } });
}

export type CreateDependencyInput = { predecessorId: string; successorId: string };

export function createDependency(data: CreateDependencyInput) {
  return prisma.scheduleTaskDependency.create({ data });
}

export function deleteDependency(predecessorId: string, successorId: string) {
  return prisma.scheduleTaskDependency.deleteMany({ where: { predecessorId, successorId } });
}
