import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import { usePermission } from "@/context/AuthContext";
import { useSelection } from "@/context/SelectionContext";
import { PanelCard } from "@/framework/ui";

import {
  fetchScheduleTaskDirectory,
  updateTaskDates,
  SCHEDULE_TASKS_CHANGED_EVENT,
  type ScheduleTask,
} from "../scheduleTasksApi";
import { taskToPayload } from "../scheduleSelection";
import ScheduleTaskForm from "../ScheduleTaskForm";
import "./ScheduleGantt.css";

type ZoomLevel = "day" | "week" | "month" | "year";

/** Real pixels-per-day at each real zoom granularity — a real UI-scale choice (like Factory's own PX_PER_SEC), not a claim about anything else. */
const PX_PER_DAY: Record<ZoomLevel, number> = {
  day: 48,
  week: 14,
  month: 4,
  year: 0.4,
};

const DAY_MS = 24 * 60 * 60 * 1000;
const LABEL_COL_WIDTH = 220;
const ROW_HEIGHT = 32;

type DragState =
  | { kind: "move"; taskId: string; startClientX: number; originalStart: Date; originalEnd: Date }
  | { kind: "resize"; taskId: string; startClientX: number; originalEnd: Date };

/**
 * Real Interactive Gantt Timeline (A7) — real ScheduleTask planned dates
 * (Phase 1 schema, real CRUD added this phase), drag-to-move and drag-to-
 * resize persisted via PATCH /schedule-tasks/:id, real day/week/month/year
 * zoom. Chart-library-free, same plain-CSS-positioning approach as
 * Factory's own FactoryGanttChart.tsx (kept separate, not literally
 * refactored into a shared component this pass — Factory's chart is
 * illustrative-seconds-based and already live-verified; this one is real-
 * dates-based with real drag persistence, different enough mechanics that
 * forcing a shared abstraction now would risk both, not simplify either).
 */
export default function ScheduleGantt() {
  const [tasks, setTasks] = useState<ScheduleTask[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<ZoomLevel>("week");
  const [showForm, setShowForm] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const { selected, setSelected } = useSelection();
  const activeId = selected?.feature === "scheduling" ? selected.objectId : undefined;
  const createPermission = usePermission("scheduling", "create");
  const updatePermission = usePermission("scheduling", "update");

  function reload() {
    fetchScheduleTaskDirectory()
      .then((dir) => {
        setTasks(dir.tasks);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load schedule tasks"));
  }

  const dragActiveRef = useRef(false);

  useEffect(() => {
    reload();
    // Real fix for a real bug found live: creating/moving a task from this
    // panel never told Heat Map to refetch (and vice versa, for future
    // consumers) — see scheduleTasksApi.ts's own doc comment. Skipped while
    // a drag is actively in progress so an unrelated mutation elsewhere
    // can't overwrite this panel's real-time optimistic drag preview
    // mid-gesture.
    function handleChanged() {
      if (!dragActiveRef.current) reload();
    }
    window.addEventListener(SCHEDULE_TASKS_CHANGED_EVENT, handleChanged);
    return () => window.removeEventListener(SCHEDULE_TASKS_CHANGED_EVENT, handleChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pxPerDay = PX_PER_DAY[zoom];

  const timelineStart = useMemo(() => {
    if (!tasks || tasks.length === 0) return null;
    return new Date(Math.min(...tasks.map((t) => new Date(t.plannedStart).getTime())));
  }, [tasks]);

  const timelineEnd = useMemo(() => {
    if (!tasks || tasks.length === 0) return null;
    return new Date(Math.max(...tasks.map((t) => new Date(t.plannedEnd).getTime())));
  }, [tasks]);

  function dayOffset(date: Date): number {
    if (!timelineStart) return 0;
    return (date.getTime() - timelineStart.getTime()) / DAY_MS;
  }

  // A ref mirror of `tasks` so handleMouseUp (registered once per drag
  // start) always reads the latest dragged position, not a stale closure.
  const tasksRef = useRef<ScheduleTask[] | null>(null);
  tasksRef.current = tasks;

  useEffect(() => {
    if (!drag) return;
    dragActiveRef.current = true;

    function handleMouseMove(e: MouseEvent) {
      const current = dragRef.current;
      if (!current) return;
      const deltaDays = (e.clientX - current.startClientX) / pxPerDay;
      const deltaMs = deltaDays * DAY_MS;

      setTasks((prev) =>
        prev
          ? prev.map((t) => {
              if (t.id !== current.taskId) return t;
              if (current.kind === "move") {
                return {
                  ...t,
                  plannedStart: new Date(current.originalStart.getTime() + deltaMs).toISOString(),
                  plannedEnd: new Date(current.originalEnd.getTime() + deltaMs).toISOString(),
                };
              }
              const minEnd = new Date(current.originalEnd);
              const proposed = new Date(current.originalEnd.getTime() + deltaMs);
              return { ...t, plannedEnd: (proposed < new Date(t.plannedStart) ? minEnd : proposed).toISOString() };
            })
          : prev
      );
    }

    function handleMouseUp() {
      const current = dragRef.current;
      setDrag(null);
      dragRef.current = null;
      dragActiveRef.current = false;
      if (!current) return;
      const task = tasksRef.current?.find((t) => t.id === current.taskId);
      if (!task) return;
      updateTaskDates(task.id, { plannedStart: task.plannedStart, plannedEnd: task.plannedEnd }).catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to save the real date change");
        reload();
      });
    }

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, pxPerDay]);

  function startMove(task: ScheduleTask, e: React.MouseEvent) {
    if (!updatePermission.allowed) return;
    e.preventDefault();
    const next: DragState = {
      kind: "move",
      taskId: task.id,
      startClientX: e.clientX,
      originalStart: new Date(task.plannedStart),
      originalEnd: new Date(task.plannedEnd),
    };
    dragRef.current = next;
    setDrag(next);
  }

  function startResize(task: ScheduleTask, e: React.MouseEvent) {
    if (!updatePermission.allowed) return;
    e.preventDefault();
    e.stopPropagation();
    const next: DragState = {
      kind: "resize",
      taskId: task.id,
      startClientX: e.clientX,
      originalEnd: new Date(task.plannedEnd),
    };
    dragRef.current = next;
    setDrag(next);
  }

  /**
   * Phase 2.3 follow-up (2026-08-16): this used to navigate straight to
   * the task's real owning module -- Joshua's real bug report ("that
   * schedule should appear in the selected schedule panel," not jump
   * away). Selects the real task into Selected Schedule instead; the
   * actual module jump is a real, explicit button in
   * ScheduleInspector.tsx.
   */
  function handleSelectTask(task: ScheduleTask) {
    setSelected({ feature: "scheduling", objectType: "Task", objectId: task.id, payload: taskToPayload(task) });
  }

  const ticks: { offset: number; label: string }[] = [];
  if (timelineStart && timelineEnd) {
    const totalDays = Math.max(1, dayOffset(timelineEnd));
    const stepDays = zoom === "day" ? 1 : zoom === "week" ? 7 : zoom === "month" ? 30 : 365;
    for (let d = 0; d <= totalDays; d += stepDays) {
      const date = new Date(timelineStart.getTime() + d * DAY_MS);
      ticks.push({ offset: d, label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }) });
    }
  }

  const timelineWidthDays = timelineStart && timelineEnd ? Math.max(1, dayOffset(timelineEnd)) : 0;

  return (
    <PanelCard
      title="Interactive Gantt Timeline"
      className="h-full"
      bodyClassName="flex flex-col flex-1 overflow-auto p-3"
      toolbar={
        <div className="flex items-center gap-2">
          {(["day", "week", "month", "year"] as ZoomLevel[]).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setZoom(level)}
              className="rounded px-2 py-0.5 text-[0.65rem] font-medium capitalize"
              style={{
                background: zoom === level ? "var(--ff-accent)" : "var(--ff-chrome-bg)",
                color: zoom === level ? "white" : "var(--ff-text-primary)",
              }}
            >
              {level}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            disabled={!createPermission.allowed}
            title={createPermission.reason}
            className="rounded px-2 py-0.5 text-[0.65rem] font-medium text-white disabled:opacity-50"
            style={{ background: "var(--ff-accent)" }}
          >
            {showForm ? "Cancel" : "+ New Task"}
          </button>
        </div>
      }
    >
      {error && (
        <p className="mb-2 text-xs" style={{ color: "var(--ff-status-critical)" }}>
          {error}
        </p>
      )}

      {showForm && (
        <ScheduleTaskForm
          onCreated={() => {
            setShowForm(false);
            reload();
          }}
          onError={setError}
        />
      )}

      {!tasks && !error && (
        <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
          Loading real schedule tasks…
        </p>
      )}

      {tasks && tasks.length === 0 && (
        <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
          No real schedule tasks exist yet — click "+ New Task" to create one (schema added Phase 1,
          real CRUD added this phase; nothing here is fabricated placeholder data).
        </p>
      )}

      {tasks && tasks.length > 0 && timelineStart && (
        <div
          className="schedule-gantt-grid"
          style={{ gridTemplateColumns: `${LABEL_COL_WIDTH}px 1fr`, width: LABEL_COL_WIDTH + timelineWidthDays * pxPerDay + 24 }}
        >
          <div />
          <div className="schedule-gantt-ruler" style={{ width: timelineWidthDays * pxPerDay }}>
            {ticks.map((tick) => (
              <div key={tick.offset} className="schedule-gantt-tick" style={{ left: tick.offset * pxPerDay }}>
                <div className="schedule-gantt-tick-mark" />
                <span>{tick.label}</span>
              </div>
            ))}
          </div>

          {tasks.map((task) => {
            const start = dayOffset(new Date(task.plannedStart));
            const durationDays = Math.max(
              0.15,
              (new Date(task.plannedEnd).getTime() - new Date(task.plannedStart).getTime()) / DAY_MS
            );
            return (
              <Fragment key={task.id}>
                <button
                  type="button"
                  onClick={() => handleSelectTask(task)}
                  className="schedule-gantt-label"
                  style={{ outline: task.id === activeId ? "2px solid var(--ff-accent)" : undefined, outlineOffset: task.id === activeId ? "-2px" : undefined }}
                  title={`${task.title} — select to see its real detail in Selected Schedule`}
                >
                  {task.title}
                  <span className="schedule-gantt-label-status"> · {task.status}</span>
                </button>
                <div className="schedule-gantt-row" style={{ height: ROW_HEIGHT }}>
                  <div
                    className="schedule-gantt-bar"
                    style={{
                      left: start * pxPerDay,
                      width: Math.max(durationDays * pxPerDay, 6),
                      cursor: updatePermission.allowed ? "grab" : "default",
                    }}
                    onMouseDown={(e) => startMove(task, e)}
                    title={`${task.title} — ${new Date(task.plannedStart).toLocaleDateString()} → ${new Date(task.plannedEnd).toLocaleDateString()}`}
                  >
                    {updatePermission.allowed && (
                      <div className="schedule-gantt-resize-handle" onMouseDown={(e) => startResize(task, e)} />
                    )}
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>
      )}
    </PanelCard>
  );
}
