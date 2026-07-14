import { useSelection } from "@/context/SelectionContext";
import { PanelCard } from "@/framework/ui";
import { EntityCanvas, Viewport, ViewportControls } from "@/framework/viewport";

import { constructionProjectBoxes, getConstructionBounds, toProjectEntityNode } from "../constructionData";

export default function ConstructionLayout() {
  const { selected, setSelected } = useSelection();
  const selectedId = selected?.feature === "construction" ? selected.objectId : undefined;

  return (
    <PanelCard title="Site Plan" className="h-[560px]" bodyClassName="flex flex-col flex-1">
      <div className="relative flex-1">
        <Viewport contentBounds={getConstructionBounds()}>
          <EntityCanvas
            nodes={constructionProjectBoxes.map(toProjectEntityNode)}
            selectedId={selectedId}
            onSelectNode={(entityNode) => {
              const box = constructionProjectBoxes.find((b) => b.id === entityNode.id);
              if (!box) return;
              setSelected({
                feature: "construction",
                objectType: "Project",
                objectId: box.id,
                payload: { name: box.title, progress: "—", trade: "—", inspector: "—", punchListCount: "—" },
              });
            }}
          />
          <ViewportControls />
        </Viewport>
      </div>
    </PanelCard>
  );
}
