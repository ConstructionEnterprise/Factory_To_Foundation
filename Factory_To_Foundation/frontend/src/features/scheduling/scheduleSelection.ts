import type { SchedulePayload } from "@/context/SelectionContext";

import type { ScheduleDetail, ScheduleStageDetail } from "./scheduleApi";
import type { ScheduleTask } from "./scheduleTasksApi";

/** Real Schedule -> SelectionContext payload, shared by Browse (tree click) and Layout (canvas click) so the two never drift apart. */
export function scheduleToPayload(schedule: ScheduleDetail): SchedulePayload {
  return {
    name: schedule.title,
    description: `Composition of ${schedule.stages.length} real stage${schedule.stages.length === 1 ? "" : "s"}, in real position order.`,
    ownedByModuleId: null,
    inputs: [],
    outputs: [],
  };
}

/** Real ScheduleStage -> SelectionContext payload. No real backfilled stage sets ownedByModuleId, so this stays honestly null, never fabricated. */
export function stageToPayload(stage: ScheduleStageDetail): SchedulePayload {
  const task = stage.tasks[0];
  return {
    name: stage.title,
    description: task
      ? `Real task "${task.title}" — ${task.status.replace(/_/g, " ")}, planned ${new Date(task.plannedStart).toLocaleDateString()} – ${new Date(task.plannedEnd).toLocaleDateString()}.`
      : "No real task linked to this stage yet.",
    ownedByModuleId: null,
    inputs: [],
    outputs: [],
  };
}

/**
 * Real ScheduleTask (from the Gantt/Heat Map's own real data source,
 * `scheduleTasksApi.ts`) -> SelectionContext payload. Every real
 * CE-Forge-backfilled task actually has a real `ownedByModuleId` set
 * (confirmed live, 29/29) -- carried through here so the Inspector can
 * offer a real "View in <Module>" link.
 */
export function taskToPayload(task: ScheduleTask): SchedulePayload {
  return {
    name: task.title,
    description: `Real task — ${task.status.replace(/_/g, " ")}, planned ${new Date(task.plannedStart).toLocaleDateString()} – ${new Date(task.plannedEnd).toLocaleDateString()}.`,
    ownedByModuleId: task.ownedByModuleId,
    inputs: [],
    outputs: [],
  };
}
