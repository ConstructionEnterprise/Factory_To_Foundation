import { useSelection } from "@/context/SelectionContext";
import { Legend, PanelCard } from "@/framework/ui";
import { EntityCanvas, Viewport, ViewportControls } from "@/framework/viewport";

import { getLogisticsBounds, logisticsNodes, toEntityNode } from "../logisticsData";

export default function LogisticsLayout() {
  const { selected, setSelected } = useSelection();
  const selectedId = selected?.feature === "logistics" ? selected.objectId : undefined;

  return (
    <PanelCard title="Yard & Flow Layout" className="h-[560px]" bodyClassName="flex flex-col flex-1">
      <div className="flex flex-wrap gap-6 px-6 py-4 border-b border-gray-100">
        <Legend color="var(--ff-status-warning)" label="In Transit" />
        <Legend color="var(--ff-tier-material)" label="Staged" />
        <Legend color="var(--ff-status-positive)" label="Delivered" />
      </div>

      <div className="relative flex-1">
        <Viewport contentBounds={getLogisticsBounds()}>
          <EntityCanvas
            nodes={logisticsNodes.map(toEntityNode)}
            selectedId={selectedId}
            onSelectNode={(entityNode) => {
              const node = logisticsNodes.find((n) => n.id === entityNode.id);
              if (!node) return;
              setSelected({
                feature: "logistics",
                objectType: node.subtitle,
                objectId: node.id,
                payload: { name: node.title, status: node.status, location: node.location, destination: node.destination, loadInfo: node.loadInfo },
              });
            }}
          />
          <ViewportControls />
        </Viewport>
      </div>
    </PanelCard>
  );
}
