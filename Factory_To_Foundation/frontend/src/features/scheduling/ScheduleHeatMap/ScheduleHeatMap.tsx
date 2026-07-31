import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { PanelCard } from "@/framework/ui";

import { fetchScheduleTaskDirectory, SCHEDULE_TASKS_CHANGED_EVENT, type ScheduleTask } from "../scheduleTasksApi";
import { heatMapToneFor, HEAT_MAP_TONE_COLOR, HEAT_MAP_TONE_LABEL } from "../heatMapStatus";
import { pathForModuleId } from "../moduleNavigation";

/**
 * Real Schedule Heat Map (A7) — one real tile per real ScheduleTask,
 * colored by heatMapStatus.ts's real, disclosed planned-vs-actual
 * derivation. Same real data source as the Gantt (fetchScheduleTaskDirectory),
 * fetched independently here rather than prop-drilled, since the two
 * panels can be resized/scrolled independently.
 */
export default function ScheduleHeatMap() {
  const [tasks, setTasks] = useState<ScheduleTask[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

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
              const ownerPath = pathForModuleId(task.ownedByModuleId);
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => ownerPath && navigate(ownerPath)}
                  disabled={!ownerPath}
                  className="rounded p-2 text-left"
                  style={{ background: HEAT_MAP_TONE_COLOR[tone], color: "white" }}
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
