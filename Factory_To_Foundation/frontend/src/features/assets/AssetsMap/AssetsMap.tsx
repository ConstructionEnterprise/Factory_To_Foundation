import { useSelection } from "@/context/SelectionContext";
import { Legend, PanelCard } from "@/framework/ui";
import { EntityCanvas, Viewport, ViewportControls } from "@/framework/viewport";

import { assetNodes, getAssetsBounds, toEntityNode } from "../assetsData";

export default function AssetsMap() {
  const { selected, setSelected } = useSelection();
  const selectedId = selected?.feature === "assets" ? selected.objectId : undefined;

  return (
    <PanelCard title="Asset Map" className="h-full" bodyClassName="flex flex-col flex-1">
      <div className="flex flex-wrap gap-6 px-6 py-4 border-b border-gray-100">
        <Legend color="var(--ff-status-positive)" label="Active" />
        <Legend color="var(--ff-status-warning)" label="Maintenance" />
        <Legend color="var(--ff-status-neutral)" label="Retired" />
      </div>

      <div className="relative flex-1">
        <Viewport contentBounds={getAssetsBounds()}>
          <EntityCanvas
            nodes={assetNodes.map(toEntityNode)}
            selectedId={selectedId}
            onSelectNode={(entityNode) => {
              const node = assetNodes.find((n) => n.id === entityNode.id);
              if (!node) return;
              setSelected({
                feature: "assets",
                objectType: node.subtitle,
                objectId: node.id,
                payload: { name: node.title, category: node.category, status: node.status, lastService: node.lastService },
              });
            }}
          />
          <ViewportControls />
        </Viewport>
      </div>
    </PanelCard>
  );
}
