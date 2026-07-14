import { useSelection } from "@/context/SelectionContext";
import { BrowseList, PanelCard } from "@/framework/ui";

import { scheduleNodes } from "../scheduleData";

export default function ScheduleBrowse() {
  const { selected, setSelected } = useSelection();
  const activeId = selected?.feature === "scheduling" ? selected.objectId : undefined;

  return (
    <PanelCard title="Browse Schedules" className="h-[560px]">
      <BrowseList
        items={scheduleNodes.map((n) => ({ id: n.id, title: n.title, indent: 0 }))}
        activeId={activeId}
        onSelect={(id) => {
          const node = scheduleNodes.find((n) => n.id === id);
          if (!node) return;
          setSelected({
            feature: "scheduling",
            objectType: node.subtitle,
            objectId: node.id,
            payload: { name: node.title, description: node.description, ownedBy: node.ownedBy },
          });
        }}
      />
    </PanelCard>
  );
}
