import type { ScheduleTask, ScheduleTaskStatus } from "@prisma/client";

import { NotFoundError, ValidationError } from "../lib/httpErrors";
import * as repo from "../repositories/scheduleTaskRepository";

export type ScheduleTaskDto = {
  id: string;
  title: string;
  stageId: string | null;
  ownedByModuleId: string | null;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  status: string;
};

function toDto(t: ScheduleTask): ScheduleTaskDto {
  return {
    id: t.id,
    title: t.title,
    stageId: t.stageId,
    ownedByModuleId: t.ownedByModuleId,
    plannedStart: t.plannedStart.toISOString(),
    plannedEnd: t.plannedEnd.toISOString(),
    actualStart: t.actualStart ? t.actualStart.toISOString() : null,
    actualEnd: t.actualEnd ? t.actualEnd.toISOString() : null,
    status: t.status,
  };
}

export type ScheduleTaskDependencyDto = { predecessorId: string; successorId: string };

export type ScheduleTaskDirectoryDto = {
  tasks: ScheduleTaskDto[];
  dependencies: ScheduleTaskDependencyDto[];
};

/** Real read of Phase 1's ScheduleTask/ScheduleTaskDependency tables — consumed by Analytics (A5) and Scheduling's own real Gantt/Heat Map (A7). */
export async function getScheduleTaskDirectory(): Promise<ScheduleTaskDirectoryDto> {
  const [tasks, dependencies] = await Promise.all([repo.listTasks(), repo.listDependencies()]);
  return { tasks: tasks.map(toDto), dependencies };
}

export type CreateTaskInput = {
  title: string;
  stageId?: string | null;
  ownedByModuleId?: string | null;
  plannedStart: string;
  plannedEnd: string;
  changedById: string;
};

export async function createTask(input: CreateTaskInput): Promise<ScheduleTaskDto> {
  const plannedStart = new Date(input.plannedStart);
  const plannedEnd = new Date(input.plannedEnd);
  if (plannedEnd < plannedStart) {
    throw new ValidationError("plannedEnd cannot be before plannedStart");
  }
  const task = await repo.createTask({
    title: input.title,
    stageId: input.stageId ?? null,
    ownedByModuleId: input.ownedByModuleId ?? null,
    plannedStart,
    plannedEnd,
    changedById: input.changedById,
  });
  return toDto(task);
}

export type UpdateTaskDatesInput = {
  title?: string;
  plannedStart?: string;
  plannedEnd?: string;
  actualStart?: string | null;
  actualEnd?: string | null;
};

/** Real drag-to-move/drag-to-resize persistence (A7's Interactive Gantt Timeline) — dates/title only, never status. */
export async function updateTaskDates(id: string, patch: UpdateTaskDatesInput): Promise<ScheduleTaskDto> {
  const existing = await repo.findTaskById(id);
  if (!existing) throw new NotFoundError(`No schedule task with id "${id}"`);

  const updated = await repo.updateTaskDates(id, {
    title: patch.title,
    plannedStart: patch.plannedStart ? new Date(patch.plannedStart) : undefined,
    plannedEnd: patch.plannedEnd ? new Date(patch.plannedEnd) : undefined,
    actualStart: patch.actualStart === undefined ? undefined : patch.actualStart ? new Date(patch.actualStart) : null,
    actualEnd: patch.actualEnd === undefined ? undefined : patch.actualEnd ? new Date(patch.actualEnd) : null,
  });
  return toDto(updated);
}

/** Real, closed state machine — same shape as LogisticsDispatch's own VALID_TRANSITIONS, adapted to ScheduleTask's real 4 states. `blocked` can be reached from (and return to) `in_progress`, matching a real "work paused, not abandoned" state; `complete` is terminal. */
const VALID_TRANSITIONS: Record<ScheduleTaskStatus, ScheduleTaskStatus[]> = {
  planned: ["in_progress", "blocked"],
  in_progress: ["blocked", "complete"],
  blocked: ["in_progress"],
  complete: [],
};

export async function transitionStatus(
  taskId: string,
  toStatus: ScheduleTaskStatus,
  changedById: string,
  notes?: string
): Promise<ScheduleTaskDto> {
  const existing = await repo.findTaskById(taskId);
  if (!existing) throw new NotFoundError(`No schedule task with id "${taskId}"`);

  const allowed = VALID_TRANSITIONS[existing.status];
  if (!allowed.includes(toStatus)) {
    const allowedText = allowed.length > 0 ? allowed.join(", ") : "none — this task is already complete";
    throw new ValidationError(
      `Cannot transition this task from "${existing.status}" to "${toStatus}" — valid next state(s): ${allowedText}`
    );
  }

  const { task } = await repo.transitionStatus({
    taskId,
    fromStatus: existing.status,
    toStatus,
    changedById,
    notes: notes ?? null,
  });
  return toDto(task);
}

export type RecentScheduleEventDto = {
  id: string;
  taskId: string;
  taskTitle: string;
  fromStatus: string | null;
  toStatus: string;
  changedAt: string;
  notes: string | null;
};

/** Real cross-task recent activity for Analytics' Events feed (Phase 1.3, 2026-08-16 rollout). */
export async function listRecentStatusEvents(limit: number): Promise<RecentScheduleEventDto[]> {
  const rows = await repo.findRecentStatusEvents(limit);
  return rows.map((row) => ({
    id: row.id,
    taskId: row.taskId,
    taskTitle: row.task.title,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    changedAt: row.changedAt.toISOString(),
    notes: row.notes,
  }));
}

export async function deleteTask(id: string): Promise<void> {
  const existing = await repo.findTaskById(id);
  if (!existing) throw new NotFoundError(`No schedule task with id "${id}"`);
  await repo.deleteTask(id);
}

export async function createDependency(predecessorId: string, successorId: string): Promise<ScheduleTaskDependencyDto> {
  const [predecessor, successor] = await Promise.all([repo.findTaskById(predecessorId), repo.findTaskById(successorId)]);
  if (!predecessor) throw new NotFoundError(`No schedule task with id "${predecessorId}"`);
  if (!successor) throw new NotFoundError(`No schedule task with id "${successorId}"`);
  if (predecessorId === successorId) throw new ValidationError("A task cannot depend on itself");

  await repo.createDependency({ predecessorId, successorId });
  return { predecessorId, successorId };
}
