import type { ReactNode } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";

import { useResponsiveMode } from "@/framework/ui";

import WorkspaceStack from "./WorkspaceStack";
import "./Workspace.css";

type WorkspaceProps = {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
};

/**
 * The real three-panel workspace, now genuinely responsive per the
 * "Responsive UI & Mobile Experience" milestone's orientation-aware brief
 * (mode matrix: phone-portrait / phone-landscape / tablet-portrait /
 * tablet-landscape / desktop - see `useResponsiveMode`'s own doc comment).
 * Every one of `left`/`center`/`right`'s own panel components already
 * builds its `PanelCard` with `className="h-full"` (fixed per-panel
 * pixel heights removed across all 18 real panels this pass - see
 * CLAUDE.md §28.3) - so every branch below only needs to give its
 * immediate wrapper a real, definite height for that `h-full` to resolve
 * against; nothing panel-specific needs to change here or in any panel.
 *
 * desktop / tablet-landscape / phone-landscape ("Engineering Mode" /
 * "Workstation Mode" in the brief) all render the same real horizontal,
 * resizable three-column layout - the brief explicitly wants phone
 * landscape to behave like a compact version of desktop, not a distinct
 * mechanism, and tablet-landscape is asked to "closely resemble desktop."
 */
export default function Workspace({
  left,
  center,
  right,
}: WorkspaceProps) {
  const mode = useResponsiveMode();

  if (mode === "phone-portrait") {
    // "Inspection Mode" - stacked, one-handed, real page scroll between
    // sections rather than react-resizable-panels' drag-to-resize (touch
    // dragging a 6px divider doesn't fit "cards should expand naturally").
    // Each section gets a real definite height (70vh, in Workspace.css)
    // rather than just min-height, specifically because Construction's/
    // Logistics' maps, Manufacturing's/Factory's viewports, and
    // Genealogy's graph all need a real pixel-mapped ancestor to size
    // their own Three.js canvas / SVG against - an unconstrained
    // height:auto ancestor would size those to 0, a real regression, not
    // just a style compromise. A short panel (e.g. an empty Inspector)
    // gets some real bottom whitespace, accepted as the safer tradeoff.
    return <WorkspaceStack sections={[left, center, right]} />;
  }

  if (mode === "tablet-portrait") {
    // Real adaptive two-column layout: Browse/nav (left) as its own full-
    // width top row, Center+Selected (the "look at these two together"
    // pair, across every real feature's own panel semantics) as a
    // resizable side-by-side row underneath - a real, generic split that
    // doesn't need per-feature customization, since every FeaturePage
    // consumer already names its three props left/center/right with that
    // same navigation/content/detail shape. Both rows use the same real
    // nested-Group technique already proven in Factory's own Gantt layout
    // (CLAUDE.md §6.11: "a nested Panel containing its own differently-
    // oriented Group just works") - not a new mechanism.
    return (
      <Group orientation="vertical" className="workspace">
        <Panel
          id="tablet-portrait-top-panel"
          defaultSize="38%"
          minSize="20%"
          collapsible
          collapsedSize={0}
        >
          {left}
        </Panel>

        <Separator id="tablet-portrait-row-divider" className="resize-handle-horizontal" />

        <Panel
          id="tablet-portrait-bottom-panel"
          defaultSize="62%"
          minSize="35%"
          collapsible
          collapsedSize={0}
        >
          <Group orientation="horizontal" className="workspace">
            <Panel
              id="tablet-portrait-center-panel"
              defaultSize="55%"
              minSize="30%"
              collapsible
              collapsedSize={0}
            >
              {center}
            </Panel>

            <Separator id="tablet-portrait-col-divider" className="resize-handle" />

            <Panel
              id="tablet-portrait-right-panel"
              defaultSize="45%"
              minSize="25%"
              collapsible
              collapsedSize={0}
            >
              {right}
            </Panel>
          </Group>
        </Panel>
      </Group>
    );
  }

  // desktop, tablet-landscape, phone-landscape - the real, unchanged
  // horizontal three-panel layout every desktop workflow already depends
  // on, per the milestone brief's own explicit "do not redesign" instruction.
  return (
    <Group
      orientation="horizontal"
      className="workspace"
    >
      <Panel
        id="left-panel"
        defaultSize="22%"
        minSize="18%"
        collapsible
        collapsedSize={0}
      >
        {left}
      </Panel>

      <Separator
        id="left-divider"
        className="resize-handle"
      />

      <Panel
        id="center-panel"
        defaultSize="56%"
        minSize="35%"
        collapsible
        collapsedSize={0}
      >
        {center}
      </Panel>

      <Separator
        id="right-divider"
        className="resize-handle"
      />

      <Panel
        id="right-panel"
        defaultSize="22%"
        minSize="18%"
        collapsible
        collapsedSize={0}
      >
        {right}
      </Panel>
    </Group>
  );
}
