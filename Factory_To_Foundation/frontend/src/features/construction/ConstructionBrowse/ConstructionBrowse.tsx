import { useSelection } from "@/context/SelectionContext";
import { BrowseList, PanelCard, type BrowseListItem } from "@/framework/ui";

import { constructionProjects, findConstructionNode, type ConstructionTreeNode } from "../constructionData";

function toBrowseItems(nodes: ConstructionTreeNode[]): BrowseListItem[] {
  return nodes.map((node) => ({
    id: node.id,
    title: node.title,
    children: node.children ? toBrowseItems(node.children) : undefined,
  }));
}

export default function ConstructionBrowse() {
  const { selected, setSelected } = useSelection();
  const activeId = selected?.feature === "construction" ? selected.objectId : undefined;

  return (
    <PanelCard title="Browse Construction" className="h-[560px]">
      <BrowseList
        items={toBrowseItems(constructionProjects)}
        activeId={activeId}
        onSelect={(id) => {
          const node = findConstructionNode(id);
          if (!node || !node.inspectable) return;
          setSelected({
            feature: "construction",
            objectType: node.objectType,
            objectId: node.id,
            payload: { name: node.title, ...node.inspectable },
          });
        }}
      />
    </PanelCard>
  );
}
