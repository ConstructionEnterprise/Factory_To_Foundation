import { useEffect, useState } from "react";

import { useSelection } from "@/context/SelectionContext";
import { PanelCard } from "@/framework/ui";
import { Viewport, ViewportControls, type Bounds } from "@/framework/viewport";

import FunctionBlockCanvas, { NODE_GAP, NODE_HEIGHT, NODE_WIDTH } from "./FunctionBlockCanvas";
import { fetchScheduleDetail, fetchSchedules, type ScheduleDetail } from "../scheduleApi";
import { stageToPayload } from "../scheduleSelection";

function computeBounds(stageCount: number): Bounds {
  const maxX = stageCount > 0 ? (stageCount - 1) * NODE_GAP + NODE_WIDTH : NODE_WIDTH;
  return { minX: 0, maxX, minY: 0, maxY: NODE_HEIGHT };
}

/**
 * Schedule-aware Function Block viewport (Phase 2.3) -- renders whichever
 * real schedule is currently selected (from Browse's tree, or by
 * selecting one of its own stages here), not a fixed fixture. No
 * schedule-independent fallback view: selecting nothing shows an honest
 * empty state.
 */
export default function ScheduleLayout() {
  const { selected, setSelected } = useSelection();
  const selectedId = selected?.feature === "scheduling" ? selected.objectId : undefined;

  const [schedules, setSchedules] = useState<ScheduleDetail[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSchedules()
      .then((summaries) => Promise.all(summaries.map((s) => fetchScheduleDetail(s.id))))
      .then(setSchedules)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const currentSchedule = selectedId
    ? schedules.find((s) => s.id === selectedId || s.stages.some((stage) => stage.id === selectedId))
    : undefined;

  return (
    <PanelCard title="Schedule Function Blocks" className="h-full" bodyClassName="flex flex-col flex-1">
      <div className="px-6 py-4 border-b text-sm text-gray-500" style={{ borderColor: "var(--ff-panel-border)" }}>
        {currentSchedule
          ? `${currentSchedule.title} — real stages, node-to-node in real sequence order.`
          : "Select a real schedule from Browse to see its stages."}
      </div>

      <div className="relative flex-1">
        {error && <p className="p-4 text-xs" style={{ color: "var(--ff-status-critical)" }}>{error}</p>}
        {!error && !currentSchedule && (
          <p className="p-4 text-xs" style={{ color: "var(--ff-text-muted)" }}>No real schedule selected yet.</p>
        )}
        {!error && currentSchedule && (
          <Viewport contentBounds={computeBounds(currentSchedule.stages.length)}>
            <FunctionBlockCanvas
              stages={currentSchedule.stages}
              selectedId={selectedId}
              onSelectStage={(stage) => {
                setSelected({ feature: "scheduling", objectType: "Stage", objectId: stage.id, payload: stageToPayload(stage) });
              }}
            />
            <ViewportControls />
          </Viewport>
        )}
      </div>
    </PanelCard>
  );
}
