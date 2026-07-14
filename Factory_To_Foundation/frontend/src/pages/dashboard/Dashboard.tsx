import { FeaturePage, KpiList, type KpiDefinition } from "@/framework/ui";

import {
  GenealogyBrowser,
  GenealogyToolbar,
  RelationshipGraph,
  SelectedObject,
} from "@/features/genealogy";

const genealogyKpis: KpiDefinition[] = [
  { title: "Objects Tracked", value: "128,451" },
  { title: "Complete Lineage", value: "96.7%" },
  { title: "Scans (MTD)", value: "24,782" },
  { title: "Auto Associations", value: "8,312" },
  { title: "Exceptions", value: "42" },
  { title: "Data Integrity", value: "99.2%" },
];

export default function Dashboard() {
  return (
    <FeaturePage
      pageLabel="Genealogy"
      pageSubtitle="End-to-End Traceability & Object Relationships"
      kpis={<KpiList kpis={genealogyKpis} />}
      toolbar={<GenealogyToolbar />}
      left={<GenealogyBrowser />}
      center={<RelationshipGraph />}
      right={<SelectedObject />}
    />
  );
}
