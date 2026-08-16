import { useEffect } from "react";

import { FeaturePage, KpiList } from "@/framework/ui";

import {
  GenealogyBrowser,
  GenealogyToolbar,
  RelationshipGraph,
  SelectedObject,
} from "@/features/genealogy";
import { getGenealogyKpis } from "@/features/genealogy/genealogySummary";
import { ensureGenealogyGraphLoaded, useGenealogyGraph } from "@/features/genealogy/genealogyStore";

// Real, computed summary stats (A6) — replaces the old fixture KPIs
// (128,451 "Objects Tracked", 96.7% "Complete Lineage", etc.), which had
// no real backing at all (this thread has 13 real nodes total). Now
// computed from the live-fetched real graph (genealogyStore.ts), not the
// module-load-time fixture read this used to be.
export default function Dashboard() {
  const { nodes, edges } = useGenealogyGraph();

  useEffect(() => {
    ensureGenealogyGraphLoaded();
  }, []);

  return (
    <FeaturePage
      pageLabel="Genealogy"
      pageSubtitle="End-to-End Traceability & Object Relationships"
      kpis={<KpiList kpis={getGenealogyKpis(nodes, edges)} />}
      toolbar={<GenealogyToolbar />}
      left={<GenealogyBrowser />}
      center={<RelationshipGraph />}
      right={<SelectedObject />}
    />
  );
}
