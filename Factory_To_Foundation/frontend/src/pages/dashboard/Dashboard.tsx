import { useEffect } from "react";

import { FeaturePage } from "@/framework/ui";

import { GenealogyBrowser, RelationshipGraph, SelectedObject } from "@/features/genealogy";
import { ensureGenealogyGraphLoaded } from "@/features/genealogy/genealogyStore";

/**
 * Metrics/Filters removed (Phase 10, 2026-08-18) per Joshua's explicit
 * "remove metrics and filters from every command ribbon" instruction --
 * GenealogyToolbar was confirmed decorative (no onClick/onChange anywhere).
 * The real, computed summary stats (A6, replacing the old fabricated
 * fixture KPIs) were genuinely real but purely informational, not a
 * functional control, so nothing actionable was lost.
 */
export default function Dashboard() {
  useEffect(() => {
    ensureGenealogyGraphLoaded();
  }, []);

  return (
    <FeaturePage
      pageLabel="Genealogy"
      pageSubtitle="End-to-End Traceability & Object Relationships"
      left={<GenealogyBrowser />}
      center={<RelationshipGraph />}
      right={<SelectedObject />}
    />
  );
}
