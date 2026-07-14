import { useSelection } from "@/context/SelectionContext";
import { BrowseList, PanelCard, type BrowseListItem } from "@/framework/ui";

import { roboticsNodes } from "../roboticsData";

// ATCs are coordinated by the rail, not contained by it — Rail stays a
// root-level leaf, ATCs stay root-level too. Each ATC's real tools[]
// (from the digital twin subsystem model) becomes its child list; tool
// leaves are static/informational, not backed by a selectable node.
function toBrowseItems(): BrowseListItem[] {
  return roboticsNodes.map((node) => ({
    id: node.id,
    title: node.title,
    children:
      node.tools.length > 0
        ? node.tools.map((tool, i) => ({ id: `${node.id}-tool-${i}`, title: tool }))
        : undefined,
  }));
}

export default function RoboticsBrowse() {
  const { selected, setSelected } = useSelection();

  const activeId = selected?.feature === "robotics" ? selected.objectId : undefined;

  return (
    <PanelCard title="Browse Robotics" className="h-[560px]">
      <BrowseList
        items={toBrowseItems()}
        activeId={activeId}
        onSelect={(id) => {
          const node = roboticsNodes.find((n) => n.id === id);
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
    </PanelCard>
  );
}
