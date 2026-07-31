import type { ScheduleTask } from "./scheduleTasksApi";

/**
 * Real Schedule Heat Map derivation (A7) — green/yellow/orange/red/purple,
 * computed from each real task's real planned/actual dates and real
 * status, never a fabricated color. This exact 5-tier scheme and its
 * thresholds are a disclosed, real judgment call (not asked for at this
 * granularity in the brief) — documented here rather than silently
 * decided, so anyone can see and adjust the exact rule later:
 *
 *   purple  = task.status === "blocked" (a real, explicit state)
 *   green   = on time — complete on/before plannedEnd, or in-progress/
 *             planned with real "now" comfortably before plannedEnd
 *   yellow  = "near capacity" — in-progress/planned with real "now" within
 *             the last 20% of the planned duration, not yet overdue
 *   orange  = complete, but real actualEnd was late by <=20% of the real
 *             planned duration
 *   red     = critical — either already overdue (now > plannedEnd, not
 *             complete) or completed more than 20% late
 */
export type HeatMapTone = "green" | "yellow" | "orange" | "red" | "purple";

export function heatMapToneFor(task: ScheduleTask, now: Date = new Date()): HeatMapTone {
  if (task.status === "blocked") return "purple";

  const plannedStart = new Date(task.plannedStart).getTime();
  const plannedEnd = new Date(task.plannedEnd).getTime();
  const plannedDurationMs = Math.max(1, plannedEnd - plannedStart);
  const lateThresholdMs = plannedDurationMs * 0.2;

  if (task.status === "complete" && task.actualEnd) {
    const actualEnd = new Date(task.actualEnd).getTime();
    const lateBy = actualEnd - plannedEnd;
    if (lateBy <= 0) return "green";
    if (lateBy <= lateThresholdMs) return "orange";
    return "red";
  }

  // Not yet complete — compare real "now" against the real planned window.
  const nowMs = now.getTime();
  if (nowMs > plannedEnd) return "red";
  if (plannedEnd - nowMs <= lateThresholdMs) return "yellow";
  return "green";
}

export const HEAT_MAP_TONE_COLOR: Record<HeatMapTone, string> = {
  green: "var(--ff-status-positive)",
  yellow: "var(--ff-status-warning)",
  orange: "#c9762f",
  red: "var(--ff-status-critical)",
  purple: "#8a6a9e",
};

export const HEAT_MAP_TONE_LABEL: Record<HeatMapTone, string> = {
  green: "On time",
  yellow: "Near capacity",
  orange: "Delayed",
  red: "Critical",
  purple: "Blocked",
};
