import { useSyncExternalStore } from "react";

import * as api from "./genealogyApi";
import { NODE_HEIGHT, NODE_WIDTH, TIER_LABEL, TIER_ORDER, type GraphEdgeData, type GraphNodeData, type GraphTier } from "./graphData";

/**
 * Real GenealogyNode/GenealogyEdge data, replacing graphData.ts's
 * hand-authored fixture (2026-08-15 — the real 13/12 seeded rows existed
 * since the initial migration but no route ever read them). Same small
 * module-level useSyncExternalStore pattern as logisticsFlowStore.ts — no
 * context provider needed.
 *
 * Position (x/y) was never a real backend attribute — GenealogyNode has no
 * such field, correctly, since it's a UI layout decision, not twin/
 * registry data. This computes the same tier-column "staircase" layout
 * graphData.ts used to hardcode by hand, from the real tier/edge data
 * instead — same visual shape, real source.
 */

const TIER_DB_TO_FRONTEND: Record<string, GraphTier> = {
  material: "material",
  framing_package: "framing-package",
  component: "component",
  subassembly: "subassembly",
  module: "module",
  building: "building",
  project: "project",
};

const COLUMN_GAP = 220;
const ROW_GAP = 160;

function layoutNodes(nodes: api.GenealogyNodeRecord[]): GraphNodeData[] {
  const byTier = new Map<GraphTier, api.GenealogyNodeRecord[]>();
  for (const n of nodes) {
    const tier = TIER_DB_TO_FRONTEND[n.tier];
    if (!tier) continue; // unknown tier value — skip rather than mis-render, real bug to surface separately if it ever happens
    if (!byTier.has(tier)) byTier.set(tier, []);
    byTier.get(tier)!.push(n);
  }

  const result: GraphNodeData[] = [];
  TIER_ORDER.forEach((tier, rowIndex) => {
    const rowNodes = (byTier.get(tier) ?? []).slice().sort((a, b) => a.title.localeCompare(b.title));
    const rowWidth = (rowNodes.length - 1) * COLUMN_GAP;
    rowNodes.forEach((n, i) => {
      result.push({
        id: n.id,
        title: n.title,
        subtitle: TIER_LABEL[tier],
        tier,
        x: i * COLUMN_GAP - rowWidth / 2,
        y: rowIndex * ROW_GAP,
        qr: n.qr ?? undefined,
      });
    });
  });
  return result;
}

function toEdgeData(edges: api.GenealogyEdgeRecord[]): GraphEdgeData[] {
  return edges.map((e) => ({ from: e.fromId, to: e.toId }));
}

type State = {
  nodes: GraphNodeData[];
  edges: GraphEdgeData[];
  loading: boolean;
  error: string | null;
};

let state: State = { nodes: [], edges: [], loading: false, error: null };
const listeners = new Set<() => void>();

function emit(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

export function useGenealogyGraph(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state
  );
}

let loaded = false;

export async function loadGenealogyGraph(): Promise<void> {
  emit({ ...state, loading: true, error: null });
  try {
    const [nodeRows, edgeRows] = await Promise.all([api.fetchGenealogyNodes(), api.fetchGenealogyEdges()]);
    loaded = true;
    emit({ nodes: layoutNodes(nodeRows), edges: toEdgeData(edgeRows), loading: false, error: null });
  } catch (err) {
    emit({ ...state, loading: false, error: err instanceof Error ? err.message : String(err) });
  }
}

export function ensureGenealogyGraphLoaded(): void {
  if (!loaded) void loadGenealogyGraph();
}

export { NODE_WIDTH, NODE_HEIGHT };
