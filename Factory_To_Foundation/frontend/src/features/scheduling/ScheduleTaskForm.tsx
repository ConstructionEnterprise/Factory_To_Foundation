import { useState } from "react";

import { ToolbarButton, ToolbarInput, ToolbarSelect } from "@/framework/ui";

import { createTask } from "./scheduleTasksApi";
import { MODULE_OPTIONS } from "./moduleNavigation";

type ScheduleTaskFormProps = {
  onCreated: () => void;
  onError: (message: string) => void;
};

/** Real task-creation form (A7) — the one real way to create a ScheduleTask row anywhere in this app (no fixture/seeded rows exist). */
export default function ScheduleTaskForm({ onCreated, onError }: ScheduleTaskFormProps) {
  const [title, setTitle] = useState("");
  const [ownedByModuleId, setOwnedByModuleId] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [plannedStart, setPlannedStart] = useState(today);
  const [plannedEnd, setPlannedEnd] = useState(today);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createTask({
        title,
        ownedByModuleId: ownedByModuleId || undefined,
        plannedStart: new Date(plannedStart).toISOString(),
        plannedEnd: new Date(plannedEnd).toISOString(),
      });
      onCreated();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to create schedule task");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-3 flex flex-wrap items-end gap-2 rounded-[0.2rem] p-3" style={{ border: "1px solid var(--ff-panel-border)" }}>
      <ToolbarInput required placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <ToolbarSelect value={ownedByModuleId} onChange={(e) => setOwnedByModuleId(e.target.value)}>
        <option value="">No owning module yet</option>
        {MODULE_OPTIONS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </ToolbarSelect>
      <label className="flex flex-col text-[0.6rem]" style={{ color: "var(--ff-text-muted)" }}>
        Planned start
        <ToolbarInput type="date" required value={plannedStart} onChange={(e) => setPlannedStart(e.target.value)} />
      </label>
      <label className="flex flex-col text-[0.6rem]" style={{ color: "var(--ff-text-muted)" }}>
        Planned end
        <ToolbarInput type="date" required value={plannedEnd} onChange={(e) => setPlannedEnd(e.target.value)} />
      </label>
      <ToolbarButton type="submit" disabled={submitting}>
        {submitting ? "Creating…" : "Create"}
      </ToolbarButton>
    </form>
  );
}
