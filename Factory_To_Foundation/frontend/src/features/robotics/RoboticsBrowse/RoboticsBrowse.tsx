import { useSelection } from "@/context/SelectionContext";
import { BrowseList, PanelCard, type BrowseListItem } from "@/framework/ui";

import { ROBOT_NAMES } from "../roboticsData";

/**
 * The four real twin robots (A1/A2/B1/B2). Selecting one drives the same
 * global SelectionContext the isolated viewport and Inspector read, so
 * all three stay on one identity — and it's the same selection Factory's
 * "View Robot" cross-nav button sets, so arriving from Factory lands on
 * the right robot with no second mechanism.
 */
export default function RoboticsBrowse() {
  const { selected, setSelected } = useSelection();
  const activeId = selected?.feature === "robotics" ? selected.objectId : undefined;

  const items: BrowseListItem[] = ROBOT_NAMES.map((name) => ({ id: name, title: `Robot ${name}` }));

  return (
    <PanelCard title="Robot Library" className="h-[560px]">
      <BrowseList
        items={items}
        activeId={activeId}
        onSelect={(id) =>
          setSelected({
            feature: "robotics",
            objectType: "CR6 Robot",
            objectId: id,
            payload: { name: `Robot ${id}`, robotName: id },
          })
        }
      />
    </PanelCard>
  );
}
