import { useEffect } from "react";

import { useSelection } from "@/context/SelectionContext";
import { BrowseList, PanelCard } from "@/framework/ui";

import { getTierDepth } from "../graphData";
import { ensureGenealogyGraphLoaded, useGenealogyGraph } from "../genealogyStore";

/**
 * Browses the same genealogy tree the Relationship Graph renders — one
 * live data source (genealogyStore.ts, real GET /genealogy-nodes), two
 * views. Ordered Material → Project, indented by tier depth. "Level" is
 * not a genealogy tier and doesn't appear here; it belongs to Construction
 * as a data point on a Module, not as an object in this hierarchy.
 */
export default function GenealogyBrowser() {
  const { selected, setSelected } = useSelection();
  const { nodes: graphNodes } = useGenealogyGraph();
  const activeId = selected?.feature === "genealogy" ? selected.objectId : undefined;

  useEffect(() => {
    ensureGenealogyGraphLoaded();
  }, []);

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
