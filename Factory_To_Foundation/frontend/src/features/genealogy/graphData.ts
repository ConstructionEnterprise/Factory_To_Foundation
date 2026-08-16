import type { Bounds } from "@/framework/viewport";

/**
 * The canonical seven-tier genealogy hierarchy:
 * Material → Framing-Package → Component → Sub-Assembly → Module → Building → Project.
 */
export type GraphTier =
  | "material"
  | "framing-package"
  | "component"
  | "subassembly"
  | "module"
  | "building"
  | "project";

/** Material-to-Project order — used for both graph layout depth and browse-list ordering. */
export const TIER_ORDER: GraphTier[] = [
  "material",
  "framing-package",
  "component",
  "subassembly",
  "module",
  "building",
  "project",
];

/** Display label per tier — subtitle always comes from here, so it can never drift from `tier`. */
export const TIER_LABEL: Record<GraphTier, string> = {
  material: "Material",
  "framing-package": "Framing-Package",
  component: "Component",
  subassembly: "Sub-Assembly",
  module: "Module",
  building: "Building",
  project: "Project",
};

export function getTierDepth(tier: GraphTier): number {
  return TIER_ORDER.indexOf(tier);
}

export type GraphNodeData = {
  id: string;
  title: string;
  subtitle: string;
  tier: GraphTier;
  /** World-space coordinates. The browser never decides this — we do. */
  x: number;
  y: number;
  /** Real QR from the ported make*Qr functions. Absent for Module/Building/Project — no real thread built those tiers yet. */
  qr?: string;
};

export type GraphEdgeData = {
  from: string;
  to: string;
};

export const NODE_WIDTH = 168;
export const NODE_HEIGHT = 76;

/**
 * Real node/edge data now comes from genealogyStore.ts (GET
 * /genealogy-nodes, /genealogy-edges) — the fixture thread that used to be
 * hardcoded here (Cedarwood Flats' exterior wall panel) is the exact same
 * real thread seeded into the database (backend/prisma/seed.ts), just
 * fetched instead of duplicated. Position (x/y) was never a real backend
 * attribute; genealogyStore.ts computes the same tier-column layout shape
 * this file used to hand-place, from real tier/edge data instead.
 */
export function getGraphBounds(nodes: GraphNodeData[]): Bounds {
  const xs = nodes.flatMap((n) => [n.x, n.x + NODE_WIDTH]);
  const ys = nodes.flatMap((n) => [n.y, n.y + NODE_HEIGHT]);

  return {
    minX: xs.length ? Math.min(...xs) : 0,
    maxX: xs.length ? Math.max(...xs) : 0,
    minY: ys.length ? Math.min(...ys) : 0,
    maxY: ys.length ? Math.max(...ys) : 0,
  };
}
