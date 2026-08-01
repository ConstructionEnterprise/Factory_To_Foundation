import { Group, Panel, Separator } from "react-resizable-panels";

import { useResponsiveMode } from "@/framework/ui";
import { WorkspaceStack } from "@/framework/workspace";

import FactoryBrowse from "./FactoryBrowse";
import FactoryGanttChart from "./FactoryGanttChart";
import FactoryGeometryViewport from "./FactoryGeometryViewport";
import FactoryInspector from "./FactoryInspector";
import "./FactoryWorkspace.css";

/**
 * Factory's own bespoke panel layout — bespoke to this feature, not a
 * change to the shared `framework/workspace/Workspace.tsx` three-panel
 * shape (only promote a shape to `framework/` once a second feature
 * genuinely needs it too, same discipline as everything else there).
 * The outer split is vertical, not horizontal: Gantt Chart is a real
 * full-width row spanning under Browse Factory too, not just under the
 * viewport/inspector — the same relationship Selected Machine already
 * has with Gantt (stacked, same column), extended to Browse Factory as
 * well. `react-resizable-panels` already supports a `Panel` containing
 * its own differently-oriented `Group`, no library workaround needed.
 *
 * Shape (desktop / tablet-landscape / phone-landscape):
 *   (Browse | Viewport + Selected Machine)
 *   ---------------------------------------
 *              Gantt Chart
 *
 * Every panel keeps the same `collapsible`/`collapsedSize={0}` behavior
 * as the shared `Workspace` — drag any divider fully closed, drag it
 * back open, on both axes.
 *
 * Responsive UI & Mobile Experience milestone: tablet-portrait keeps the
 * same real 4 sections but reflows to 3 real rows (Browse full-width,
 * then Viewport|Inspector side by side, then Gantt full-width) instead of
 * squeezing the existing 2-column top row; phone-portrait stacks all 4
 * sections via the same real `WorkspaceStack` the base `Workspace` uses
 * (§28.3) — no separate mechanism invented here.
 */
export default function FactoryWorkspace() {
  const mode = useResponsiveMode();

  if (mode === "phone-portrait") {
    return (
      <WorkspaceStack
        sections={[
          <FactoryBrowse key="browse" />,
          <FactoryGeometryViewport key="viewport" />,
          <FactoryInspector key="inspector" />,
          <FactoryGanttChart key="gantt" />,
        ]}
      />
    );
  }

  if (mode === "tablet-portrait") {
    return (
      <Group orientation="vertical" className="factory-workspace">
        <Panel id="factory-tp-browse-panel" defaultSize="28%" minSize="15%" collapsible collapsedSize={0}>
          <FactoryBrowse />
        </Panel>

        <Separator id="factory-tp-browse-divider" className="resize-handle-horizontal" />

        <Panel id="factory-tp-main-panel" defaultSize="47%" minSize="25%" collapsible collapsedSize={0}>
          <Group orientation="horizontal" className="factory-workspace">
            <Panel id="factory-tp-viewport-panel" defaultSize="60%" minSize="30%" collapsible collapsedSize={0}>
              <FactoryGeometryViewport />
            </Panel>

            <Separator id="factory-tp-viewport-divider" className="resize-handle" />

            <Panel id="factory-tp-inspector-panel" defaultSize="40%" minSize="20%" collapsible collapsedSize={0}>
              <FactoryInspector />
            </Panel>
          </Group>
        </Panel>

        <Separator id="factory-tp-gantt-divider" className="resize-handle-horizontal" />

        <Panel id="factory-tp-gantt-panel" defaultSize="25%" minSize="15%" collapsible collapsedSize={0}>
          <FactoryGanttChart />
        </Panel>
      </Group>
    );
  }

  return (
    <Group orientation="vertical" className="factory-workspace">
      <Panel id="factory-top-row-panel" defaultSize="70%" minSize="30%" collapsible collapsedSize={0}>
        <Group orientation="horizontal" className="factory-workspace">
          <Panel id="factory-browse-panel" defaultSize="22%" minSize="18%" collapsible collapsedSize={0}>
            <FactoryBrowse />
          </Panel>

          <Separator id="factory-browse-divider" className="resize-handle" />

          <Panel id="factory-main-panel" defaultSize="78%" minSize="40%" collapsible collapsedSize={0}>
            <Group orientation="horizontal" className="factory-workspace">
              <Panel id="factory-viewport-panel" defaultSize="65%" minSize="35%" collapsible collapsedSize={0}>
                <FactoryGeometryViewport />
              </Panel>

              <Separator id="factory-viewport-divider" className="resize-handle" />

              <Panel id="factory-inspector-panel" defaultSize="35%" minSize="20%" collapsible collapsedSize={0}>
                <FactoryInspector />
              </Panel>
            </Group>
          </Panel>
        </Group>
      </Panel>

      <Separator id="factory-gantt-divider" className="resize-handle-horizontal" />

      <Panel id="factory-gantt-panel" defaultSize="30%" minSize="15%" collapsible collapsedSize={0}>
        <FactoryGanttChart />
      </Panel>
    </Group>
  );
}
