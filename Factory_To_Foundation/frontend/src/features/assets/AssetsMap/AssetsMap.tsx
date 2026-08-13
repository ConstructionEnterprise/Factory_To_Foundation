import { useSelection } from "@/context/SelectionContext";
import { Legend, PanelCard } from "@/framework/ui";
import { EntityCanvas, Viewport, ViewportControls } from "@/framework/viewport";

import { formatAssetDate, getAssetsBounds, toEntityNode, type AssetNodeData } from "../assetsData";

export default function AssetsMap({ assetNodes }: { assetNodes: AssetNodeData[] }) {
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
        <Viewport contentBounds={getAssetsBounds(assetNodes)}>
          <EntityCanvas
            nodes={assetNodes.map(toEntityNode)}
            selectedId={selectedId}
            onSelectNode={(entityNode) => {
          const node = assetNodes.find((n) => n.id === entityNode.id);
          if (!node) return;
          setSelected({
            feature: "assets",
            objectType: node.family,
            objectId: node.id,
            payload: {
              name: node.title,
              family: node.family,
              category: node.category,
              status: node.status,
              location: node.location,
              manufacturer: node.manufacturer,
              model: node.model,
              serialNumber: node.serialNumber,
              assetTag: node.assetTag,
              acquisitionDate: formatAssetDate(node.acquisitionDate),
              lastService: formatAssetDate(node.lastService),
              nextService: formatAssetDate(node.nextService),
              notes: node.notes,
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
