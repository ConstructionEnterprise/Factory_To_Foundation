import { useSelection } from "@/context/SelectionContext";
import { PanelCard } from "@/framework/ui";
import { EntityCanvas, Viewport, ViewportControls } from "@/framework/viewport";

import { getScheduleBounds, scheduleEdges, scheduleNodes, toEntityNode } from "../scheduleData";

export default function ScheduleLayout() {
  const { selected, setSelected } = useSelection();
  const selectedId = selected?.feature === "scheduling" ? selected.objectId : undefined;

  return (
    <PanelCard title="Schedule Pipeline" className="h-[560px]" bodyClassName="flex flex-col flex-1">
      <div className="px-6 py-4 border-b text-sm text-gray-500" style={{ borderColor: "var(--ff-panel-border)" }}>
        Material → Production → Storage → Construction — the real pipeline these five schedules form.
      </div>

      <div className="relative flex-1">
        <Viewport contentBounds={getScheduleBounds()}>
          <EntityCanvas
            nodes={scheduleNodes.map(toEntityNode)}
            edges={scheduleEdges}
            selectedId={selectedId}
            onSelectNode={(entityNode) => {
              const node = scheduleNodes.find((n) => n.id === entityNode.id);
              if (!node) return;
              setSelected({
                feature: "scheduling",
                objectType: node.subtitle,
                objectId: node.id,
                payload: { name: node.title, description: node.description, ownedBy: node.ownedBy },
              });
            }}
          />
          <ViewportControls />
        </Viewport>
      </div>
    </PanelCard>
  );
}
