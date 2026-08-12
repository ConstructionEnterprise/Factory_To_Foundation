import { useSelection } from "@/context/SelectionContext";
import { BrowseList, PanelCard, type BrowseListItem } from "@/framework/ui";

import { schedules, scheduleNodes } from "../scheduleData";

/**
 * Schedule -> Step containment tree (real one-parent hierarchy, per
 * BrowseList's own children-mode rule) sitting above the unchanged 5 stage
 * definitions. A step's row id is the stage id it points to, not a
 * composite — Phase 1 has exactly one schedule so no collision exists yet,
 * and this keeps a step's selection identical to selecting its stage
 * directly (see onSelect below), so ScheduleLayout's Function Block canvas
 * cross-highlight keeps working unchanged.
 */
function toBrowseItems(): BrowseListItem[] {
  return schedules.map((schedule) => ({
    id: schedule.id,
    title: schedule.title,
    children: schedule.stepStageIds.map((stageId) => {
      const node = scheduleNodes.find((n) => n.id === stageId)!;
      return { id: node.id, title: node.title };
    }),
  }));
}

export default function ScheduleBrowse() {
  const { selected, setSelected } = useSelection();
  const activeId = selected?.feature === "scheduling" ? selected.objectId : undefined;

  return (
    <PanelCard title="Browse Schedules" className="h-full">
      <BrowseList
        items={toBrowseItems()}
        activeId={activeId}
        onSelect={(id) => {
          const schedule = schedules.find((s) => s.id === id);
          if (schedule) {
            // Distinguishable from a step selection: real objectType/description,
            // but no single owning module or ports at the composition level yet --
            // honestly empty, matching the existing null-owner convention below,
            // not fabricated. Same payload shape ScheduleInspector already renders,
            // so that file needs no changes for this container case.
            setSelected({
              feature: "scheduling",
              objectType: "Schedule",
              objectId: schedule.id,
              payload: {
                name: schedule.title,
                description: `Composition of ${schedule.stepStageIds.length} scheduling steps, in pipeline order.`,
                ownedByModule: null,
                inputs: [],
                outputs: [],
              },
            });
            return;
          }
          const node = scheduleNodes.find((n) => n.id === id);
          if (!node) return;
          setSelected({
            feature: "scheduling",
            objectType: node.subtitle,
            objectId: node.id,
            payload: {
              name: node.title,
              description: node.description,
              ownedByModule: node.ownedByModule,
              inputs: node.inputs,
              outputs: node.outputs,
            },
          });
        }}
      />
    </PanelCard>
  );
}
