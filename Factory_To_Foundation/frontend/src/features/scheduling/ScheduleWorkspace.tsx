import { Group, Panel, Separator } from "react-resizable-panels";

import { useResponsiveMode } from "@/framework/ui";
import { WorkspaceStack } from "@/framework/workspace";

import ScheduleBrowse from "./ScheduleBrowse";
import ScheduleLayout from "./ScheduleLayout";
import ScheduleInspector from "./ScheduleInspector";
import ScheduleGantt from "./ScheduleGantt/ScheduleGantt";
import ScheduleHeatMap from "./ScheduleHeatMap/ScheduleHeatMap";
import DispatchTimeline from "./DispatchTimeline/DispatchTimeline";
import ModularSequenceTimeline from "./ModularSequenceTimeline/ModularSequenceTimeline";
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
 * Shape (desktop / tablet-landscape / phone-landscape):
 *   (Browse Schedules | Function Blocks + Selected Schedule)
 *   ----------------------------------------------------------
 *        Interactive Gantt Timeline | Schedule Heat Map
 *
 * Responsive UI & Mobile Experience milestone: tablet-portrait reflows to
 * 3 real rows (Browse full-width, then Layout|Inspector, then
 * Gantt|HeatMap); phone-portrait stacks all 5 real sections via the same
 * `WorkspaceStack` every other multi-panel workspace uses (§28.3).
 */
export default function ScheduleWorkspace() {
  const mode = useResponsiveMode();

  if (mode === "phone-portrait") {
    return (
      <WorkspaceStack
        sections={[
          <ScheduleBrowse key="browse" />,
          <ScheduleLayout key="layout" />,
          <ScheduleInspector key="inspector" />,
          <ScheduleGantt key="gantt" />,
          <ScheduleHeatMap key="heatmap" />,
          <DispatchTimeline key="dispatch-timeline" />,
          <ModularSequenceTimeline key="modular-sequence-timeline" />,
        ]}
      />
    );
  }

  if (mode === "tablet-portrait") {
    return (
      <Group orientation="vertical" className="schedule-workspace">
        <Panel id="schedule-tp-browse-panel" defaultSize="20%" minSize="15%" collapsible collapsedSize={0}>
          <ScheduleBrowse />
        </Panel>

        <Separator id="schedule-tp-browse-divider" className="resize-handle-horizontal" />

        <Panel id="schedule-tp-main-panel" defaultSize="34%" minSize="20%" collapsible collapsedSize={0}>
          <Group orientation="horizontal" className="schedule-workspace">
            <Panel id="schedule-tp-layout-panel" defaultSize="60%" minSize="30%" collapsible collapsedSize={0}>
              <ScheduleLayout />
            </Panel>

            <Separator id="schedule-tp-layout-divider" className="resize-handle" />

            <Panel id="schedule-tp-inspector-panel" defaultSize="40%" minSize="20%" collapsible collapsedSize={0}>
              <ScheduleInspector />
            </Panel>
          </Group>
        </Panel>

        <Separator id="schedule-tp-bottom-divider" className="resize-handle-horizontal" />

        <Panel id="schedule-tp-bottom-row-panel" defaultSize="30%" minSize="18%" collapsible collapsedSize={0}>
          <Group orientation="horizontal" className="schedule-workspace">
            <Panel id="schedule-tp-gantt-panel" defaultSize="60%" minSize="30%" collapsible collapsedSize={0}>
              <ScheduleGantt />
            </Panel>

            <Separator id="schedule-tp-gantt-divider" className="resize-handle" />

            <Panel id="schedule-tp-heatmap-panel" defaultSize="40%" minSize="20%" collapsible collapsedSize={0}>
              <ScheduleHeatMap />
            </Panel>
          </Group>
        </Panel>

        <Separator id="schedule-tp-dispatch-divider" className="resize-handle-horizontal" />

        <Panel id="schedule-tp-dispatch-panel" defaultSize="20%" minSize="12%" collapsible collapsedSize={0}>
          <Group orientation="horizontal" className="schedule-workspace">
            <Panel id="schedule-tp-dispatch-timeline-panel" defaultSize="50%" minSize="25%" collapsible collapsedSize={0}>
              <DispatchTimeline />
            </Panel>

            <Separator id="schedule-tp-projections-divider" className="resize-handle" />

            <Panel id="schedule-tp-modseq-timeline-panel" defaultSize="50%" minSize="25%" collapsible collapsedSize={0}>
              <ModularSequenceTimeline />
            </Panel>
          </Group>
        </Panel>
      </Group>
    );
  }

  return (
    <Group orientation="vertical" className="schedule-workspace">
      <Panel id="schedule-top-row-panel" defaultSize="50%" minSize="30%" collapsible collapsedSize={0}>
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

      <Panel id="schedule-bottom-row-panel" defaultSize="32%" minSize="20%" collapsible collapsedSize={0}>
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

      <Separator id="schedule-dispatch-divider" className="resize-handle-horizontal" />

      <Panel id="schedule-dispatch-panel" defaultSize="18%" minSize="12%" collapsible collapsedSize={0}>
        <Group orientation="horizontal" className="schedule-workspace">
          <Panel id="schedule-dispatch-timeline-panel" defaultSize="50%" minSize="25%" collapsible collapsedSize={0}>
            <DispatchTimeline />
          </Panel>

          <Separator id="schedule-projections-divider" className="resize-handle" />

          <Panel id="schedule-modseq-timeline-panel" defaultSize="50%" minSize="25%" collapsible collapsedSize={0}>
            <ModularSequenceTimeline />
          </Panel>
        </Group>
      </Panel>
    </Group>
  );
}
