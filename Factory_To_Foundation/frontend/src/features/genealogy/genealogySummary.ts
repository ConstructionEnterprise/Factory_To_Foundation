import type { GraphEdgeData, GraphNodeData } from "./graphData";
import { TIER_LABEL, TIER_ORDER } from "./graphData";
import { canBeFinishedProduct } from "./genealogyRegistry";
import type { KpiDefinition } from "@/framework/ui";

/**
 * Real summary stats for the Relationship Explorer's summary strip (A6) —
 * replaces the Dashboard's old fixture KPIs (128,451 "Objects Tracked",
 * 96.7% "Complete Lineage", etc. — plausible-looking numbers with zero
 * real backing, since this thread only has 13 real nodes total). Every
 * value here is computed directly from the real thread (now live-fetched,
 * genealogyStore.ts), never invented.
 */
export function getGenealogyKpis(nodes: GraphNodeData[], edges: GraphEdgeData[]): KpiDefinition[] {
  const finishedProductCount = nodes.filter((n) => canBeFinishedProduct(n.tier)).length;
  const nodesWithQr = nodes.filter((n) => n.qr).length;

  return [
    { title: "Real Nodes", value: String(nodes.length) },
    { title: "Real Edges", value: String(edges.length) },
    { title: "Tiers Represented", value: String(new Set(nodes.map((n) => n.tier)).size) },
    { title: "Finished-Product-Capable", value: String(finishedProductCount) },
    { title: "Nodes With Real QR", value: `${nodesWithQr} / ${nodes.length}` },
  ];
}

export type TierCount = { tier: string; label: string; count: number };

export function getTierCounts(nodes: GraphNodeData[]): TierCount[] {
  return TIER_ORDER.map((tier) => ({
    tier,
    label: TIER_LABEL[tier],
    count: nodes.filter((n) => n.tier === tier).length,
  }));
}
