import { useSelection } from "@/context/SelectionContext";
import { Legend, PanelCard } from "@/framework/ui";
import { EntityCanvas, Viewport, ViewportControls } from "@/framework/viewport";

import { getRoboticsBounds, roboticsNodes, toEntityNode } from "../roboticsData";

export default function RoboticsLayout() {
  const { selected, setSelected } = useSelection();
  const selectedId = selected?.feature === "robotics" ? selected.objectId : undefined;

  return (
    <PanelCard title="Robot Cell Layout" className="h-[560px]" bodyClassName="flex flex-col flex-1">
      <div className="flex flex-wrap gap-6 px-6 py-4 border-b border-gray-100">
        <Legend color="var(--ff-status-positive)" label="Running" />
        <Legend color="var(--ff-status-warning)" label="Idle" />
        <Legend color="var(--ff-status-critical)" label="Fault" />
      </div>

      <div className="relative flex-1">
        <Viewport contentBounds={getRoboticsBounds()}>
          <EntityCanvas
            nodes={roboticsNodes.map(toEntityNode)}
            selectedId={selectedId}
            onSelectNode={(entityNode) => {
              const node = roboticsNodes.find((n) => n.id === entityNode.id);
              if (!node) return;
              setSelected({
                feature: "robotics",
                objectType: node.subtitle,
                objectId: node.id,
                payload: {
                  name: node.title,
                  status: node.status,
                  currentTask: node.currentTask,
                  tool: node.tool,
                  cycleTime: node.cycleTime,
                  axisPositions: node.axisPositions,
                },
              });
            }}
          />
          <ViewportControls />
        </Viewport>
      </div>
    </PanelCard>
  );
}
