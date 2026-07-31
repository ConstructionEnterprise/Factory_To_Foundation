import { Group, Panel, Separator } from "react-resizable-panels";

import ScheduleBrowse from "./ScheduleBrowse";
import ScheduleLayout from "./ScheduleLayout";
import ScheduleInspector from "./ScheduleInspector";
import ScheduleGantt from "./ScheduleGantt/ScheduleGantt";
import ScheduleHeatMap from "./ScheduleHeatMap/ScheduleHeatMap";
import "./ScheduleWorkspace.css";

/**
 * Scheduling's own bespoke panel layout (A7) — same real pattern Factory
 * proved out for its own Gantt addition (FactoryWorkspace.tsx): a vertical
 * outer split (top row unchanged, a new real bottom row added), each
 * `Panel` keeping the same `collapsible`/`collapsedSize={0}` behavior as
 * the shared `Workspace`. Only promoted to `framework/` once a third
 * feature needs the identical shape, per the codebase's own standing
 * discipline.
 *
 * Shape:
 *   (Browse Schedules | Function Blocks + Selected Schedule)
 *   ----------------------------------------------------------
 *        Interactive Gantt Timeline | Schedule Heat Map
 */
export default function ScheduleWorkspace() {
  return (
    <Group orientation="vertical" className="schedule-workspace">
      <Panel id="schedule-top-row-panel" defaultSize="60%" minSize="30%" collapsible collapsedSize={0}>
        <Group orientation="horizontal" className="schedule-workspace">
          <Panel id="schedule-browse-panel" defaultSize="22%" minSize="18%" collapsible collapsedSize={0}>
            <ScheduleBrowse />
          </Panel>

          <Separator id="schedule-browse-divider" className="resize-handle" />

          <Panel id="schedule-main-panel" defaultSize="78%" minSize="40%" collapsible collapsedSize={0}>
            <Group orientation="horizontal" className="schedule-workspace">
              <Panel id="schedule-layout-panel" defaultSize="65%" minSize="35%" collapsible collapsedSize={0}>
                <ScheduleLayout />
              </Panel>

              <Separator id="schedule-layout-divider" className="resize-handle" />

              <Panel id="schedule-inspector-panel" defaultSize="35%" minSize="20%" collapsible collapsedSize={0}>
                <ScheduleInspector />
              </Panel>
            </Group>
          </Panel>
        </Group>
      </Panel>

      <Separator id="schedule-bottom-divider" className="resize-handle-horizontal" />

      <Panel id="schedule-bottom-row-panel" defaultSize="40%" minSize="20%" collapsible collapsedSize={0}>
        <Group orientation="horizontal" className="schedule-workspace">
          <Panel id="schedule-gantt-panel" defaultSize="65%" minSize="35%" collapsible collapsedSize={0}>
            <ScheduleGantt />
          </Panel>

          <Separator id="schedule-gantt-divider" className="resize-handle" />

          <Panel id="schedule-heatmap-panel" defaultSize="35%" minSize="20%" collapsible collapsedSize={0}>
            <ScheduleHeatMap />
          </Panel>
        </Group>
      </Panel>
    </Group>
  );
}
