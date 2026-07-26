import { FeaturePage, KpiList, type KpiDefinition } from "@/framework/ui";

import {
  ConstructionDocumentViewer,
  ConstructionMap,
  ConstructionProjectObjects,
  ConstructionProjects,
  ConstructionToolbar,
} from "@/features/construction";
import { useDocumentPreview } from "@/features/construction/constructionDocumentPreviewStore";

const constructionKpis: KpiDefinition[] = [
  { title: "Buildings Complete", value: "1 / 3" },
  { title: "Open Punch Items", value: "8" },
  { title: "Modules Installed", value: "22" },
  { title: "Avg Progress", value: "54%" },
];

export default function ConstructionPage() {
  // Construction tab reorg — the center panel toggles between the map
  // (default) and a document viewer, driven by constructionDocumentPreviewStore.
  // Selecting a document in the left "Construction Projects" tree
  // (FileCard's click-to-preview) sets this; clearDocumentPreview() (an
  // explicit Close, or selecting anything in the right "Project Objects"
  // tree) reverts to the map.
  const { file } = useDocumentPreview();

  return (
    <FeaturePage
      pageLabel="Construction"
      pageSubtitle="Construction Site Operations"
      kpis={<KpiList kpis={constructionKpis} />}
      toolbar={<ConstructionToolbar />}
      left={<ConstructionProjects />}
      center={file ? <ConstructionDocumentViewer /> : <ConstructionMap />}
      right={<ConstructionProjectObjects />}
    />
  );
}
