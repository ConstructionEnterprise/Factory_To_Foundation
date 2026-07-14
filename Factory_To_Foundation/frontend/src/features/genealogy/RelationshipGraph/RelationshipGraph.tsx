import { useSelection } from "@/context/SelectionContext";
import { Legend, PanelCard } from "@/framework/ui";
import { Viewport, ViewportControls } from "@/framework/viewport";

import GraphCanvas from "./GraphCanvas";
import { getGraphBounds, type GraphNodeData } from "../graphData";

/**
 * RelationshipGraph
 *   └── PanelCard ("Relationship Graph")
 *           ├── Legend
 *           └── GraphViewport (framework Viewport, camera-owning)
 *                   └── GraphCanvas (world-space, CSS-transform positioned)
 *                           ├── GraphNode
 *                           └── GraphEdge
 *
 * The card shell (border/shadow/header) comes from the shared PanelCard —
 * this component only supplies genealogy-specific content: the legend
 * and the graph itself.
 */
export default function RelationshipGraph() {
  const { selected, setSelected } = useSelection();

  const handleSelectNode = (node: GraphNodeData) => {
    setSelected({
      feature: "genealogy",
      objectType: node.subtitle,
      objectId: node.id,
      payload: { name: node.title },
    });
  };

  const selectedGenealogyId =
    selected?.feature === "genealogy" ? selected.objectId : undefined;

  return (
    <PanelCard
      title="Relationship Graph"
      className="h-[560px]"
      bodyClassName="flex flex-col flex-1"
    >

      {/* Legend */}

      <div className="flex flex-wrap gap-6 px-6 py-4 border-b border-gray-100">
        <Legend color="var(--ff-tier-material)" label="Material" />
        <Legend color="var(--ff-tier-framing-package)" label="Framing-Package" />
        <Legend color="var(--ff-tier-component)" label="Component" />
        <Legend color="var(--ff-tier-subassembly)" label="Sub-Assembly" />
        <Legend color="var(--ff-tier-module)" label="Module" />
        <Legend color="var(--ff-tier-building)" label="Building" />
        <Legend color="var(--ff-tier-project)" label="Project" />
      </div>

      {/* Graph Viewport */}

      <div className="relative flex-1">
        <Viewport contentBounds={getGraphBounds()}>
          <GraphCanvas
            selectedId={selectedGenealogyId}
            onSelectNode={handleSelectNode}
          />
          <ViewportControls />
        </Viewport>
      </div>

    </PanelCard>
  );
}
