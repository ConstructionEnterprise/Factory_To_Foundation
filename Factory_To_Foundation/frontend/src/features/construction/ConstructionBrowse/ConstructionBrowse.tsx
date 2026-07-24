import { useSelection } from "@/context/SelectionContext";
import { BrowseList, PanelCard, type BrowseListItem } from "@/framework/ui";

import { constructionProjects, findConstructionNode, type ConstructionTreeNode } from "../constructionData";
import { isConstructionProjectId } from "../constructionLocations";
import { setHoveredSite, useSiteState } from "../constructionSiteStore";

function toBrowseItems(nodes: ConstructionTreeNode[]): BrowseListItem[] {
  return nodes.map((node) => ({
    id: node.id,
    title: node.title,
    children: node.children ? toBrowseItems(node.children) : undefined,
  }));
}

export default function ConstructionBrowse() {
  const { selected, setSelected } = useSelection();
  const { hoveredId } = useSiteState();
  const activeId = selected?.feature === "construction" ? selected.objectId : undefined;

  return (
    <PanelCard title="Browse Construction" className="h-[560px]">
      <BrowseList
        items={toBrowseItems(constructionProjects)}
        activeId={activeId}
        // Hover syncs both ways with the Construction Enterprises Map:
        // hovering a project row highlights its massing, hovering massing
        // highlights the row. Only project rows have map presence.
        hoveredId={hoveredId ?? undefined}
        onHover={(id) => setHoveredSite(id && isConstructionProjectId(id) ? id : null)}
        onSelect={(id) => {
          const node = findConstructionNode(id);
          if (!node) return;
          if (node.inspectable) {
            setSelected({
              feature: "construction",
              objectType: node.objectType,
              objectId: node.id,
              payload: { name: node.title, ...node.inspectable },
            });
            return;
          }
          // Project rows have no inspectable (no fabricated data), but they
          // ARE selectable now — the map and the siting flow need project
          // selection. Same honest "—" payload the map's click-select sends.
          if (node.objectType === "Project") {
            setSelected({
              feature: "construction",
              objectType: "Project",
              objectId: node.id,
              payload: { name: node.title, progress: "—", trade: "—", inspector: "—", punchListCount: "—" },
            });
          }
        }}
      />
    </PanelCard>
  );
}
