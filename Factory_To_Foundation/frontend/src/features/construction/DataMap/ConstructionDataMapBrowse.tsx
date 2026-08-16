import { BrowseList, PanelCard, type BrowseListItem } from "@/framework/ui";

import { constructionProjects } from "../constructionData";

type ConstructionDataMapBrowseProps = {
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
};

const items: BrowseListItem[] = constructionProjects.map((project) => ({
  id: project.id,
  title: project.title,
}));

/**
 * Real Construction Data Map project picker (Phase 1.1, 2026-08-16
 * rollout). Reuses the same real project id/title list every other
 * Construction panel already reads from `constructionData.ts` -- no
 * second project list, no new fetch.
 */
export default function ConstructionDataMapBrowse({ selectedProjectId, onSelectProject }: ConstructionDataMapBrowseProps) {
  return (
    <PanelCard title="Construction Data Map" className="h-full">
      <BrowseList items={items} activeId={selectedProjectId ?? undefined} onSelect={onSelectProject} />
    </PanelCard>
  );
}
