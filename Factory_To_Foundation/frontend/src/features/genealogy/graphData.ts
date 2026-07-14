import type { Bounds } from "@/framework/viewport";

import { makeMaterialQr, makeObjectQr } from "./genealogyRegistry";

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

const COLUMN_GAP = 220;
const ROW_GAP = 160;
const SPINE_X = 330;

const PROJECT_CODE = "CWF"; // Cedarwood Flats
const BUILDING_CODE = "BLD1"; // Building B

/**
 * Real thread from `build_thread()` in CE_Genealogy_AllInOne-5.py — the
 * Cedarwood Flats exterior wall panel. Materials attach at the tier that
 * actually consumes them (LGS-0041/LGS-0050 feed the Framing-Package,
 * SCR-0010 feeds the Component, the remaining four feed the Sub-Assembly)
 * — that's a real structural fact and drives `graphEdges` and the x/y
 * layout below. Array ORDER here is a separate concern: it's grouped by
 * tier (all Materials, then Framing-Package, then Component, ...) so
 * GenealogyBrowser's flat indent list reads as a clean Material-first-
 * through-Project staircase, not interleaved by which tier a given
 * material happens to feed.
 */
export const graphNodes: GraphNodeData[] = [
  // Materials — grouped together regardless of which tier consumes them.
  {
    id: "lgs-0041",
    title: "LGS Stud (roll-formed)",
    subtitle: TIER_LABEL.material,
    tier: "material",
    x: SPINE_X - COLUMN_GAP / 2,
    y: 0,
    qr: makeMaterialQr(PROJECT_CODE, "LGS-0041", 1),
  },
  {
    id: "lgs-0050",
    title: "LGS Track (roll-formed)",
    subtitle: TIER_LABEL.material,
    tier: "material",
    x: SPINE_X + COLUMN_GAP / 2,
    y: 0,
    qr: makeMaterialQr(PROJECT_CODE, "LGS-0050", 1),
  },
  {
    id: "scr-0010",
    title: "Self-Tapping Framing Screws",
    subtitle: TIER_LABEL.material,
    tier: "material",
    x: SPINE_X + COLUMN_GAP,
    y: ROW_GAP,
    qr: makeMaterialQr(PROJECT_CODE, "SCR-0010", 1),
  },
  {
    id: "sh-0144",
    title: "Sheathing 7/16in OSB",
    subtitle: TIER_LABEL.material,
    tier: "material",
    x: 0,
    y: ROW_GAP * 3,
    qr: makeMaterialQr(PROJECT_CODE, "SH-0144", 1),
  },
  {
    id: "fn-0022",
    title: "Structural Fasteners",
    subtitle: TIER_LABEL.material,
    tier: "material",
    x: COLUMN_GAP,
    y: ROW_GAP * 3,
    qr: makeMaterialQr(PROJECT_CODE, "FN-0022", 1),
  },
  {
    id: "mri-0001",
    title: "MEP Rough-In Assembly",
    subtitle: TIER_LABEL.material,
    tier: "material",
    x: COLUMN_GAP * 2,
    y: ROW_GAP * 3,
    qr: makeMaterialQr(PROJECT_CODE, "MRI-0001", 1),
  },
  {
    id: "win-0012",
    title: "Window Package",
    subtitle: TIER_LABEL.material,
    tier: "material",
    x: COLUMN_GAP * 3,
    y: ROW_GAP * 3,
    qr: makeMaterialQr(PROJECT_CODE, "WIN-0012", 1),
  },

  // Framing-Package — built from LGS-0041 + LGS-0050 above.
  {
    id: "fpw-03-112",
    title: "Wall Framing Package",
    subtitle: TIER_LABEL["framing-package"],
    tier: "framing-package",
    x: SPINE_X,
    y: ROW_GAP,
    qr: makeObjectQr(PROJECT_CODE, BUILDING_CODE, "FPW-03-112", 1),
  },

  // Component — the Framing-Package plus SCR-0010 above.
  {
    id: "ewf-03-112",
    title: "Exterior Wall Frame",
    subtitle: TIER_LABEL.component,
    tier: "component",
    x: SPINE_X,
    y: ROW_GAP * 2,
    qr: makeObjectQr(PROJECT_CODE, BUILDING_CODE, "EWF-03-112", 1),
  },

  // Sub-Assembly — the Component plus the four Sub-Assembly materials above.
  {
    id: "ewp-03-s",
    title: "Exterior Wall Panel",
    subtitle: TIER_LABEL.subassembly,
    tier: "subassembly",
    x: SPINE_X,
    y: ROW_GAP * 4,
    qr: makeObjectQr(PROJECT_CODE, BUILDING_CODE, "EWP-03-S", 1),
  },

  // Module, Building, Project — unchanged. No real module-type assignment
  // exists for this thread yet, so this stays Module M24-089 as-is rather
  // than inventing an MLV/MBP/MEP code; no QR since nothing built it.
  {
    id: "module-089",
    title: "Module M24-089",
    subtitle: TIER_LABEL.module,
    tier: "module",
    x: SPINE_X,
    y: ROW_GAP * 5,
  },
  {
    id: "building-b",
    title: "Building B",
    subtitle: TIER_LABEL.building,
    tier: "building",
    x: SPINE_X,
    y: ROW_GAP * 6,
  },
  {
    id: "project",
    title: "Cedarwood Flats",
    subtitle: TIER_LABEL.project,
    tier: "project",
    x: SPINE_X,
    y: ROW_GAP * 7,
  },
];

export const graphEdges: GraphEdgeData[] = [
  { from: "lgs-0041", to: "fpw-03-112" },
  { from: "lgs-0050", to: "fpw-03-112" },
  { from: "fpw-03-112", to: "ewf-03-112" },
  { from: "scr-0010", to: "ewf-03-112" },
  { from: "ewf-03-112", to: "ewp-03-s" },
  { from: "sh-0144", to: "ewp-03-s" },
  { from: "fn-0022", to: "ewp-03-s" },
  { from: "mri-0001", to: "ewp-03-s" },
  { from: "win-0012", to: "ewp-03-s" },
  { from: "ewp-03-s", to: "module-089" },
  { from: "module-089", to: "building-b" },
  { from: "building-b", to: "project" },
];

export function getGraphBounds(): Bounds {
  const xs = graphNodes.flatMap((n) => [n.x, n.x + NODE_WIDTH]);
  const ys = graphNodes.flatMap((n) => [n.y, n.y + NODE_HEIGHT]);

  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}
