import { Group, Panel, Separator } from "react-resizable-panels";

import { useResponsiveMode } from "@/framework/ui";
import { WorkspaceStack } from "@/framework/workspace";

import ScheduleBrowse from "./ScheduleBrowse";
import ScheduleLayout from "./ScheduleLayout";
import ScheduleInspector from "./ScheduleInspector";
import DispatchTimeline from "./DispatchTimeline/DispatchTimeline";
import ModularSequenceTimeline from "./ModularSequenceTimeline/ModularSequenceTimeline";
import "./ScheduleWorkspace.css";

/**
 * Scheduling's own bespoke panel layout (A7). Only promoted to
 * `framework/` once a third feature needs the identical shape, per the
 * codebase's own standing discipline.
 *
 * Shape (desktop / tablet-landscape / phone-landscape):
 *   (Browse Schedules | Function Blocks + Selected Schedule)
 *   ----------------------------------------------------------
 *          Logistics Dispatches | Modular Sequences
 *
 * Real command-ribbon correction (Phase 10, 2026-08-18): the Interactive
 * Gantt Timeline and Schedule Heat Map rows moved out to their own real
 * ribbon capability pages ("Gantt Chart"/"Schedule Map" on
 * SchedulingPage.tsx) -- both are self-contained real views (each fetches
 * its own real data independently, no shared state with this workspace),
 * genuinely first-class capabilities in their own right, not fixed rows
 * of this one bespoke layout.
 *
 * Responsive UI & Mobile Experience milestone: tablet-portrait reflows to
 * 2 real rows (Browse full-width, then Layout|Inspector, then Dispatch);
 * phone-portrait stacks all real sections via the same `WorkspaceStack`
 * every other multi-panel workspace uses (§28.3).
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
          <DispatchTimeline key="dispatch-timeline" />,
          <ModularSequenceTimeline key="modular-sequence-timeline" />,
        ]}
      />
    );
  }

  if (mode === "tablet-portrait") {
    return (
      <Group orientation="vertical" className="schedule-workspace">
        <Panel id="schedule-tp-browse-panel" defaultSize="25%" minSize="15%" collapsible collapsedSize={0}>
          <ScheduleBrowse />
        </Panel>

        <Separator id="schedule-tp-browse-divider" className="resize-handle-horizontal" />

        <Panel id="schedule-tp-main-panel" defaultSize="50%" minSize="30%" collapsible collapsedSize={0}>
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

        <Separator id="schedule-tp-dispatch-divider" className="resize-handle-horizontal" />

        <Panel id="schedule-tp-dispatch-panel" defaultSize="25%" minSize="12%" collapsible collapsedSize={0}>
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
      <Panel id="schedule-top-row-panel" defaultSize="70%" minSize="30%" collapsible collapsedSize={0}>
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

      <Separator id="schedule-dispatch-divider" className="resize-handle-horizontal" />

      <Panel id="schedule-dispatch-panel" defaultSize="30%" minSize="12%" collapsible collapsedSize={0}>
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
