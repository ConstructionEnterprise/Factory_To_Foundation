import { useEffect, useState } from "react";

import { useSelection } from "@/context/SelectionContext";
import { PanelCard } from "@/framework/ui";

import { fetchScheduleTaskDirectory, SCHEDULE_TASKS_CHANGED_EVENT, type ScheduleTask } from "../scheduleTasksApi";
import { heatMapToneFor, HEAT_MAP_TONE_COLOR, HEAT_MAP_TONE_LABEL } from "../heatMapStatus";
import { taskToPayload } from "../scheduleSelection";

/**
 * Real Schedule Heat Map (A7) — one real tile per real ScheduleTask,
 * colored by heatMapStatus.ts's real, disclosed planned-vs-actual
 * derivation. Same real data source as the Gantt (fetchScheduleTaskDirectory),
 * fetched independently here rather than prop-drilled, since the two
 * panels can be resized/scrolled independently.
 *
 * Phase 2.3 follow-up (2026-08-16): a tile click used to navigate
 * straight to the task's real owning module -- Joshua's real bug
 * report ("it should not immediately take me to the parent... there
 * should be a link available for me in the selected schedule panel").
 * It now selects the real task into Selected Schedule instead; the
 * actual "go to owning module" jump lives in ScheduleInspector.tsx's own
 * real button.
 */
export default function ScheduleHeatMap() {
  const [tasks, setTasks] = useState<ScheduleTask[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { selected, setSelected } = useSelection();
  const activeId = selected?.feature === "scheduling" ? selected.objectId : undefined;

  useEffect(() => {
    function reload() {
      fetchScheduleTaskDirectory()
        .then((dir) => {
          setTasks(dir.tasks);
          setError(null);
        })
        .catch((err) => setError(err instanceof Error ? err.message : "Failed to load schedule tasks"));
    }
    reload();
    // Real fix for a real bug found live: this panel fetched once on mount
    // only, so creating/moving a task in the Gantt panel left this one
    // showing stale data until a manual reload — see scheduleTasksApi.ts's
    // own doc comment on the shared broadcast event this listens for.
    window.addEventListener(SCHEDULE_TASKS_CHANGED_EVENT, reload);
    return () => window.removeEventListener(SCHEDULE_TASKS_CHANGED_EVENT, reload);
  }, []);

  return (
    <PanelCard title="Schedule Heat Map" className="h-full" bodyClassName="flex-1 overflow-auto p-3">
      {error && (
        <p className="text-xs" style={{ color: "var(--ff-status-critical)" }}>
          {error}
        </p>
      )}
      {!tasks && !error && (
        <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
          Loading real schedule tasks…
        </p>
      )}
      {tasks && tasks.length === 0 && (
        <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
          No real schedule tasks exist yet — create one from the Gantt panel's "+ New Task".
        </p>
      )}
      {tasks && tasks.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {tasks.map((task) => {
              const tone = heatMapToneFor(task);
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => setSelected({ feature: "scheduling", objectType: "Task", objectId: task.id, payload: taskToPayload(task) })}
                  className="rounded p-2 text-left"
                  style={{
                    background: HEAT_MAP_TONE_COLOR[tone],
                    color: "white",
                    outline: task.id === activeId ? "2px solid var(--ff-accent)" : undefined,
                    outlineOffset: task.id === activeId ? "1px" : undefined,
                  }}
                  title={`${task.title} — ${HEAT_MAP_TONE_LABEL[tone]}`}
                >
                  <p className="truncate text-xs font-semibold">{task.title}</p>
                  <p className="text-[0.62rem] opacity-90">{HEAT_MAP_TONE_LABEL[tone]}</p>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-[0.62rem]" style={{ color: "var(--ff-text-muted)" }}>
            {(Object.keys(HEAT_MAP_TONE_LABEL) as (keyof typeof HEAT_MAP_TONE_LABEL)[]).map((tone) => (
              <span key={tone} className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: HEAT_MAP_TONE_COLOR[tone] }} />
                {HEAT_MAP_TONE_LABEL[tone]}
              </span>
            ))}
          </div>
        </>
      )}
    </PanelCard>
  );
}
