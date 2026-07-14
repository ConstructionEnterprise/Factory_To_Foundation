import type { ReactNode } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";

import "./Workspace.css";

type WorkspaceProps = {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
};

/**
 * Three-panel resizable workspace. Every panel is collapsible — drag a
 * divider past its threshold and that panel snaps fully closed
 * (collapsedSize 0), same as dragging a Blender editor's border to let
 * a neighboring editor take the whole space. The divider stays put and
 * grabbable at 0 width, so a fully collapsed panel can always be
 * dragged back open.
 */
export default function Workspace({
  left,
  center,
  right,
}: WorkspaceProps) {
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
