import { FeaturePage, KpiList, type KpiDefinition } from "@/framework/ui";

import {
  ConstructionBrowse,
  ConstructionInspector,
  ConstructionLayout,
  ConstructionToolbar,
} from "@/features/construction";

const constructionKpis: KpiDefinition[] = [
  { title: "Buildings Complete", value: "1 / 3" },
  { title: "Open Punch Items", value: "8" },
  { title: "Modules Installed", value: "22" },
  { title: "Avg Progress", value: "54%" },
];

export default function ConstructionPage() {
  return (
    <FeaturePage
      pageLabel="Construction"
      pageSubtitle="Construction Site Operations"
      kpis={<KpiList kpis={constructionKpis} />}
      toolbar={<ConstructionToolbar />}
      left={<ConstructionBrowse />}
      center={<ConstructionLayout />}
      right={<ConstructionInspector />}
    />
  );
}
