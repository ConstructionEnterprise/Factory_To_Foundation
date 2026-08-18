import { useState } from "react";

import { FeaturePage } from "@/framework/ui";

import EndToEndReport from "@/features/reports/EndToEndReport";
import ProductionReport from "@/features/reports/ProductionReport";
import LogisticsReport from "@/features/reports/LogisticsReport";
import InventoryReport from "@/features/reports/InventoryReport";
import ConstructionReport from "@/features/reports/ConstructionReport";
import GenealogyReport from "@/features/reports/GenealogyReport";
import DocumentSearchReport from "@/features/reports/DocumentSearchReport";

type ReportsCapability = "end-to-end" | "production" | "logistics" | "inventory" | "construction" | "genealogy" | "documents";

const CAPABILITY_LABEL: Record<ReportsCapability, string> = {
  "end-to-end": "End-to-End",
  production: "Production",
  logistics: "Logistics",
  inventory: "Inventory",
  construction: "Construction",
  genealogy: "Genealogy",
  documents: "Document Search",
};

/**
 * Reports rebuild (2026-08-18, docs/decisions/2026-08-18-reports-domain-audit-and-taxonomy.md) --
 * converted from a bare SimplePage stacking 4 uncategorized capabilities
 * to the same real FeaturePage/CommandRibbon capability-switch pattern
 * every other domain now uses. Each tab is a real read projection of data
 * another domain already owns (same cross-domain-projection contract
 * Factory Flow/Scheduling's timelines use) -- Reports creates nothing new
 * here except the End-to-End tab's own backend read (a flat, cross-run
 * sibling of factoryFlowService.getFactoryFlow()).
 *
 * Collision Report moved to Analytics (live, non-persisted twin
 * projection -- wrong category for a formal report). Instruction
 * Sequence removed entirely, not relocated -- Factory's own Instructions
 * ribbon tab is the sole real view of that data.
 */
export default function ReportsPage() {
  const [capability, setCapability] = useState<ReportsCapability>("end-to-end");

  const extraMenus = (Object.keys(CAPABILITY_LABEL) as ReportsCapability[]).map((key) => ({
    label: CAPABILITY_LABEL[key],
    onClick: () => setCapability(key),
    active: capability === key,
  }));

  const workspace = {
    "end-to-end": <EndToEndReport />,
    production: <ProductionReport />,
    logistics: <LogisticsReport />,
    inventory: <InventoryReport />,
    construction: <ConstructionReport />,
    genealogy: <GenealogyReport />,
    documents: <DocumentSearchReport />,
  }[capability];

  return (
    <FeaturePage
      pageLabel="Reports"
      pageSubtitle={CAPABILITY_LABEL[capability]}
      extraMenus={extraMenus}
      workspace={workspace}
    />
  );
}
