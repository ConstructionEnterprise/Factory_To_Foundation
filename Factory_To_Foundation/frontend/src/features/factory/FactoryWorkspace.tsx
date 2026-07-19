import { Group, Panel, Separator } from "react-resizable-panels";

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
 * Shape:
 *   (Browse | Viewport + Selected Machine)
 *   ---------------------------------------
 *              Gantt Chart
 *
 * Every panel keeps the same `collapsible`/`collapsedSize={0}` behavior
 * as the shared `Workspace` — drag any divider fully closed, drag it
 * back open, on both axes.
 */
export default function FactoryWorkspace() {
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
