import { FeaturePage, KpiList } from "@/framework/ui";

import {
  GenealogyBrowser,
  GenealogyToolbar,
  RelationshipGraph,
  SelectedObject,
} from "@/features/genealogy";
import { getGenealogyKpis } from "@/features/genealogy/genealogySummary";

// Real, computed summary stats (A6) — replaces the old fixture KPIs
// (128,451 "Objects Tracked", 96.7% "Complete Lineage", etc.), which had
// no real backing at all (this thread has 13 real nodes total). See
// genealogySummary.ts for what's actually computed.
const genealogyKpis = getGenealogyKpis();

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
