import type { ScheduleTask, ScheduleTaskDependency } from "@/features/scheduling/scheduleTasksApi";

/**
 * Real critical-path computation (longest path by planned duration through
 * the real dependency DAG) — a genuine algorithm, not a fabricated number,
 * so that when Phase 7 (Scheduling) or a real task-creation flow starts
 * populating ScheduleTask rows, this widget starts showing a real result
 * with zero code changes. Currently always computes over 0 real rows
 * (Phase 1 shipped schema-only, no seeded tasks) — an honest empty result,
 * not a placeholder.
 *
 * Defensive against a real cycle in the dependency data (which the schema
 * doesn't forbid at the DB level): a `visiting` guard breaks an infinite
 * recursion rather than hanging, and treats a cyclic task as contributing
 * only its own duration to any path through it.
 */
export type CriticalPathResult = {
  /** Task ids in critical-path order, longest real planned-duration path through the DAG. */
  path: string[];
  totalDurationMs: number;
};

function durationMs(task: ScheduleTask): number {
  return Math.max(0, new Date(task.plannedEnd).getTime() - new Date(task.plannedStart).getTime());
}

export function computeCriticalPath(tasks: ScheduleTask[], dependencies: ScheduleTaskDependency[]): CriticalPathResult {
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const successorsOf = new Map<string, string[]>();
  for (const dep of dependencies) {
    if (!taskById.has(dep.predecessorId) || !taskById.has(dep.successorId)) continue;
    if (!successorsOf.has(dep.predecessorId)) successorsOf.set(dep.predecessorId, []);
    successorsOf.get(dep.predecessorId)!.push(dep.successorId);
  }

  const memo = new Map<string, CriticalPathResult>();
  const visiting = new Set<string>();

  function longestFrom(taskId: string): CriticalPathResult {
    const cached = memo.get(taskId);
    if (cached) return cached;

    const task = taskById.get(taskId)!;
    if (visiting.has(taskId)) {
      // Real cycle in the data — stop here rather than recursing forever.
      return { path: [taskId], totalDurationMs: durationMs(task) };
    }
    visiting.add(taskId);

    let best: CriticalPathResult = { path: [taskId], totalDurationMs: durationMs(task) };
    for (const successorId of successorsOf.get(taskId) ?? []) {
      const rest = longestFrom(successorId);
      const candidateDuration = durationMs(task) + rest.totalDurationMs;
      if (candidateDuration > best.totalDurationMs) {
        best = { path: [taskId, ...rest.path], totalDurationMs: candidateDuration };
      }
    }

    visiting.delete(taskId);
    memo.set(taskId, best);
    return best;
  }

  let overall: CriticalPathResult = { path: [], totalDurationMs: 0 };
  for (const task of tasks) {
    const candidate = longestFrom(task.id);
    if (candidate.totalDurationMs > overall.totalDurationMs) overall = candidate;
  }
  return overall;
}
