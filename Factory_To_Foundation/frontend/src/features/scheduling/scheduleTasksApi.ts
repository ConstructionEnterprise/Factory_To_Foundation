import { authFetch } from "@/lib/authFetch";
import { BACKEND_URL } from "@/lib/env";

/**
 * Real client for Phase 1's ScheduleTask/ScheduleTaskDependency tables
 * (backend/src/routes/scheduleTasks.ts) — real CRUD added in Phase 7 (A7)
 * for the Interactive Gantt Timeline (drag-to-move/resize) and Heat Map.
 * Moved here from features/analytics/ (its original Phase 5 home) now that
 * Scheduling is a second, write-capable real consumer — this is genuinely
 * Scheduling's own domain data, Analytics just reads it too.
 */
export type ScheduleTask = {
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

export type ScheduleTaskDependency = { predecessorId: string; successorId: string };

export type ScheduleTaskDirectory = {
  tasks: ScheduleTask[];
  dependencies: ScheduleTaskDependency[];
};

async function describeResponseError(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  if (body && typeof body.error === "string") return body.error;
  return `server responded ${res.status}`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(`${BACKEND_URL}${path}`, init);
  if (!res.ok) throw new Error(await describeResponseError(res));
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/**
 * Real fix for a real bug found live: the Gantt and Heat Map panels each
 * fetch the real ScheduleTask directory independently on their own mount
 * with no shared refresh trigger — creating (or drag-moving) a task in one
 * panel left the other showing stale data until a manual reload. Same
 * generic "a plain window event, any interested store can listen without
 * this module needing to import that store" mechanism AuthContext's own
 * AUTH_CHANGED_EVENT already established, not a new pattern invented here.
 */
export const SCHEDULE_TASKS_CHANGED_EVENT = "ff:schedule-tasks-changed";

function broadcastScheduleTasksChanged(): void {
  window.dispatchEvent(new Event(SCHEDULE_TASKS_CHANGED_EVENT));
}

export function fetchScheduleTaskDirectory(): Promise<ScheduleTaskDirectory> {
  return requestJson("/schedule-tasks");
}

export type CreateTaskInput = {
  title: string;
  stageId?: string;
  ownedByModuleId?: string;
  plannedStart: string;
  plannedEnd: string;
};

export async function createTask(input: CreateTaskInput): Promise<ScheduleTask> {
  const task = await requestJson<ScheduleTask>("/schedule-tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  broadcastScheduleTasksChanged();
  return task;
}

export type UpdateTaskDatesInput = {
  title?: string;
  plannedStart?: string;
  plannedEnd?: string;
  actualStart?: string | null;
  actualEnd?: string | null;
};

/** Real persistence for drag-to-move (shift both dates) / drag-to-resize (shift plannedEnd only). */
export async function updateTaskDates(id: string, patch: UpdateTaskDatesInput): Promise<ScheduleTask> {
  const task = await requestJson<ScheduleTask>(`/schedule-tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  broadcastScheduleTasksChanged();
  return task;
}

export async function transitionTaskStatus(id: string, toStatus: string, notes?: string): Promise<ScheduleTask> {
  const task = await requestJson<ScheduleTask>(`/schedule-tasks/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ toStatus, notes }),
  });
  broadcastScheduleTasksChanged();
  return task;
}

export async function deleteTask(id: string): Promise<void> {
  await requestJson(`/schedule-tasks/${id}`, { method: "DELETE" });
  broadcastScheduleTasksChanged();
}

export function createDependency(predecessorId: string, successorId: string): Promise<ScheduleTaskDependency> {
  return requestJson("/schedule-task-dependencies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ predecessorId, successorId }),
  });
}
