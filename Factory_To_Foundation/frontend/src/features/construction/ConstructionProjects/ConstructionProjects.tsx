import { PanelCard, CollapsibleSection } from "@/framework/ui";

import { constructionProjects } from "../constructionData";
import ConstructionDocuments from "../ConstructionDocuments/ConstructionDocuments";

/**
 * Construction tab reorganization — new left panel. Was "Browse
 * Construction" (the project -> building/floor tree, now relocated to the
 * new right panel, ConstructionProjectObjects.tsx). This panel is
 * document-centric instead: every real project, expanded directly into its
 * 4 real document categories (never buildings/floors) — the same data
 * ConstructionDocuments.tsx already fetched when it lived in the old
 * Inspector, just mounted once per project instead of once per selected
 * node.
 *
 * Documents attach at the project level only (confirmed decision) — each
 * mount below passes the project's own id as BOTH projectId and
 * treeNodeId, never a building/floor id, so there's no node picker and no
 * way to construct a non-root target from this panel. Confirmed via Phase
 * 1 investigation: the project's own id is already a real, valid
 * ConstructionTreeNode row (seed.ts's CONSTRUCTION_TREE seeds it with
 * parentId: null), so this needs zero backend change.
 *
 * Real, disclosed behavior change from the old Inspector-hosted version:
 * CollapsibleSection doesn't unmount its children when collapsed (CSS-only
 * height animation), so all 4 projects' document lists fetch immediately
 * on mount rather than lazily per-selection — 4 small real GET requests
 * instead of 1-per-selection, not a concern at this data scale.
 */
export default function ConstructionProjects() {
  return (
    <PanelCard title="Construction Projects" className="h-full">
      <div className="space-y-1">
        {constructionProjects.map((project) => (
          <CollapsibleSection
            key={project.id}
            title={project.title}
            storageKey={`construction-projects-${project.id}`}
          >
            <ConstructionDocuments projectId={project.id} treeNodeId={project.id} />
          </CollapsibleSection>
        ))}
      </div>
    </PanelCard>
  );
}
