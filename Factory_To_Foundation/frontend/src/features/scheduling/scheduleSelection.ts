import type { SchedulePayload } from "@/context/SelectionContext";

import type { ScheduleDetail, ScheduleStageDetail } from "./scheduleApi";

/** Real Schedule -> SelectionContext payload, shared by Browse (tree click) and Layout (canvas click) so the two never drift apart. */
export function scheduleToPayload(schedule: ScheduleDetail): SchedulePayload {
  return {
    name: schedule.title,
    description: `Composition of ${schedule.stages.length} real stage${schedule.stages.length === 1 ? "" : "s"}, in real position order.`,
    ownedByModule: null,
    inputs: [],
    outputs: [],
  };
}

/** Real ScheduleStage -> SelectionContext payload. `ownedByModule` stays null: no real backfilled stage sets it, and none is fabricated here. */
export function stageToPayload(stage: ScheduleStageDetail): SchedulePayload {
  const task = stage.tasks[0];
  return {
    name: stage.title,
    description: task
      ? `Real task "${task.title}" — ${task.status.replace(/_/g, " ")}, planned ${new Date(task.plannedStart).toLocaleDateString()} – ${new Date(task.plannedEnd).toLocaleDateString()}.`
      : "No real task linked to this stage yet.",
    ownedByModule: null,
    inputs: [],
    outputs: [],
  };
}
