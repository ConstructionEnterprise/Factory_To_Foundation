import { useSelection } from "@/context/SelectionContext";
import { BrowseList, PanelCard, type BrowseListItem } from "@/framework/ui";

import { formatAssetDate, type AssetNodeData } from "../assetsData";

// Matches the original spec's left-panel categories — order isn't real
// data, but every category itself and its membership is (assetNodes.category).
const CATEGORY_ORDER = ["Vehicles", "Equipment", "Tools", "Infrastructure"];

function toBrowseItems(assetNodes: AssetNodeData[]): BrowseListItem[] {
  return CATEGORY_ORDER.filter((category) => assetNodes.some((n) => n.category === category)).map((category) => ({
    id: `category-${category.toLowerCase()}`,
    title: category,
    children: assetNodes
      .filter((n) => n.category === category)
      .map((n) => ({ id: n.id, title: n.title })),
  }));
}

export default function AssetsBrowse({ assetNodes }: { assetNodes: AssetNodeData[] }) {
  const { selected, setSelected } = useSelection();
  const activeId = selected?.feature === "assets" ? selected.objectId : undefined;

  return (
    <PanelCard title="Browse Assets" className="h-full">
      <BrowseList
        items={toBrowseItems(assetNodes)}
        activeId={activeId}
        onSelect={(id) => {
          const node = assetNodes.find((n) => n.id === id);
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
    </PanelCard>
  );
}
