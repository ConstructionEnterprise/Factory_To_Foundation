import { useSelection } from "@/context/SelectionContext";
import { BrowseList, PanelCard, type BrowseListItem } from "@/framework/ui";

import { logisticsNodes, type LogisticsZone } from "../logisticsData";

const ZONE_ORDER: LogisticsZone[] = ["receiving", "storage", "yard", "transportation"];
const ZONE_LABEL: Record<LogisticsZone, string> = {
  receiving: "Receiving",
  storage: "Storage",
  yard: "Yard",
  transportation: "Transportation",
};

function toBrowseItems(): BrowseListItem[] {
  return ZONE_ORDER.filter((zone) => logisticsNodes.some((n) => n.zone === zone)).map((zone) => ({
    id: `zone-${zone}`,
    title: ZONE_LABEL[zone],
    children: logisticsNodes.filter((n) => n.zone === zone).map((n) => ({ id: n.id, title: n.title })),
  }));
}

export default function LogisticsBrowse() {
  const { selected, setSelected } = useSelection();
  const activeId = selected?.feature === "logistics" ? selected.objectId : undefined;

  return (
    <PanelCard title="Browse Logistics" className="h-[560px]">
      <BrowseList
        items={toBrowseItems()}
        activeId={activeId}
        onSelect={(id) => {
          const node = logisticsNodes.find((n) => n.id === id);
          if (!node) return;
          setSelected({
            feature: "logistics",
            objectType: node.subtitle,
            objectId: node.id,
            payload: { name: node.title, status: node.status, location: node.location, destination: node.destination, loadInfo: node.loadInfo },
          });
        }}
      />
    </PanelCard>
  );
}
