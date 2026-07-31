import { graphEdges, graphNodes, TIER_LABEL, TIER_ORDER } from "./graphData";
import { canBeFinishedProduct } from "./genealogyRegistry";
import type { KpiDefinition } from "@/framework/ui";

/**
 * Real summary stats for the Relationship Explorer's summary strip (A6) —
 * replaces the Dashboard's old fixture KPIs (128,451 "Objects Tracked",
 * 96.7% "Complete Lineage", etc. — plausible-looking numbers with zero
 * real backing, since this thread only has 13 real nodes total). Every
 * value here is computed directly from the real thread, never invented.
 */
export function getGenealogyKpis(): KpiDefinition[] {
  const finishedProductCount = graphNodes.filter((n) => canBeFinishedProduct(n.tier)).length;
  const nodesWithQr = graphNodes.filter((n) => n.qr).length;

  return [
    { title: "Real Nodes", value: String(graphNodes.length) },
    { title: "Real Edges", value: String(graphEdges.length) },
    { title: "Tiers Represented", value: String(new Set(graphNodes.map((n) => n.tier)).size) },
    { title: "Finished-Product-Capable", value: String(finishedProductCount) },
    { title: "Nodes With Real QR", value: `${nodesWithQr} / ${graphNodes.length}` },
  ];
}

export type TierCount = { tier: string; label: string; count: number };

export function getTierCounts(): TierCount[] {
  return TIER_ORDER.map((tier) => ({
    tier,
    label: TIER_LABEL[tier],
    count: graphNodes.filter((n) => n.tier === tier).length,
  }));
}
