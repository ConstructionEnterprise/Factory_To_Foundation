import { useEffect, useState } from "react";

import { useSelection } from "@/context/SelectionContext";
import { BrowseList, PanelCard, ToolbarButton, ToolbarInput, type BrowseListItem } from "@/framework/ui";

import { createSchedule, fetchScheduleDetail, fetchSchedules, type ScheduleDetail, type ScheduleSummary } from "../scheduleApi";
import { scheduleToPayload, stageToPayload } from "../scheduleSelection";

/**
 * Real Schedule -> Stage containment tree (Phase 2.3, docs/decisions/
 * 2026-08-16-scheduling-phase2.3-frontend-wiring-plan.md), reading the
 * real backend instead of the old `scheduleData.ts` fixture. A stage's
 * row id is its own real ScheduleStage id directly -- real Schedule/
 * ScheduleStage ids are global cuids now (Phase 2.1), so the old
 * composite-id worry Phase 1 flagged never actually materializes (§2 of
 * the plan doc).
 */
export default function ScheduleBrowse() {
  const { selected, setSelected } = useSelection();
  const activeId = selected?.feature === "scheduling" ? selected.objectId : undefined;

  const [schedules, setSchedules] = useState<ScheduleDetail[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchSchedules()
      .then((summaries: ScheduleSummary[]) => Promise.all(summaries.map((s) => fetchScheduleDetail(s.id))))
      .then(setSchedules)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createSchedule(newTitle.trim());
      setNewTitle("");
      setShowCreate(false);
      load();
      setSelected({
        feature: "scheduling",
        objectType: "Schedule",
        objectId: created.id,
        payload: scheduleToPayload({
          id: created.id,
          title: created.title,
          constructionProjectId: created.constructionProjectId,
          createdById: created.createdById,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
          stages: [],
        }),
      });
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const items: BrowseListItem[] = schedules.map((schedule) => ({
    id: schedule.id,
    title: schedule.title,
    children: schedule.stages.map((stage) => ({ id: stage.id, title: stage.title })),
  }));

  return (
    <PanelCard title="Browse Schedules" className="h-full">
      <div className="mb-2 flex items-center justify-between px-2">
        <span className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
          {loading ? "Loading…" : `${schedules.length} real schedule${schedules.length === 1 ? "" : "s"}`}
        </span>
        <ToolbarButton onClick={() => setShowCreate((v) => !v)}>{showCreate ? "Cancel" : "+ New Schedule"}</ToolbarButton>
      </div>

      {showCreate && (
        <div className="mb-2 space-y-2 px-2">
          <ToolbarInput placeholder="Schedule title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          {createError && <p className="text-xs" style={{ color: "var(--ff-status-critical)" }}>{createError}</p>}
          <ToolbarButton onClick={handleCreate} disabled={creating || !newTitle.trim()}>
            {creating ? "Creating…" : "Create"}
          </ToolbarButton>
        </div>
      )}

      {error && <p className="px-2 text-xs" style={{ color: "var(--ff-status-critical)" }}>{error}</p>}
      {!error && !loading && schedules.length === 0 && (
        <p className="px-2 text-xs" style={{ color: "var(--ff-text-muted)" }}>No real schedules exist yet.</p>
      )}

      <BrowseList
        items={items}
        activeId={activeId}
        onSelect={(id) => {
          const schedule = schedules.find((s) => s.id === id);
          if (schedule) {
            setSelected({ feature: "scheduling", objectType: "Schedule", objectId: schedule.id, payload: scheduleToPayload(schedule) });
            return;
          }

          for (const s of schedules) {
            const stage = s.stages.find((st) => st.id === id);
            if (!stage) continue;
            setSelected({ feature: "scheduling", objectType: "Stage", objectId: stage.id, payload: stageToPayload(stage) });
            return;
          }
        }}
      />
    </PanelCard>
  );
}
