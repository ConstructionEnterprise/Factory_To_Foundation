import { useSelection } from "@/context/SelectionContext";
import { BrowseList, PanelCard } from "@/framework/ui";

import { getTierDepth, graphNodes } from "../graphData";

/**
 * Browses the same genealogy tree the Relationship Graph renders — one
 * data source (graphData.ts), two views. Ordered Material → Project,
 * indented by tier depth. "Level" is not a genealogy tier and doesn't
 * appear here; it belongs to Construction as a data point on a Module,
 * not as an object in this hierarchy.
 */
export default function GenealogyBrowser() {
  const { selected, setSelected } = useSelection();
  const activeId = selected?.feature === "genealogy" ? selected.objectId : undefined;

  return (
    <PanelCard title="Genealogy Browser" className="h-full">
      <BrowseList
        items={graphNodes.map((node) => ({
          id: node.id,
          title: node.title,
          indent: getTierDepth(node.tier),
        }))}
        activeId={activeId}
        onSelect={(id) => {
          const node = graphNodes.find((n) => n.id === id);
          if (!node) return;
          setSelected({
            feature: "genealogy",
            objectType: node.subtitle,
            objectId: node.id,
            payload: { name: node.title },
          });
        }}
      />
    </PanelCard>
  );
}
