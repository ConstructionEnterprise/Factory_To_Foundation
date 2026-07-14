import type { Bounds, EntityNodeData } from "@/framework/viewport";

export type ConstructionObjectType = "Project" | "Building" | "Floor" | "Floor Plans";

export type ConstructionInspectable = {
  progress: string;
  trade: string;
  inspector: string;
  punchListCount: string;
};

export type ConstructionTreeNode = {
  id: string;
  title: string;
  objectType: ConstructionObjectType;
  /** Present on Project rows and Cedarwood's Building row — purely navigational, not independently selectable in BrowseList. */
  children?: ConstructionTreeNode[];
  /** Only present for nodes that make sense to inspect (a building, a floor, an honest placeholder) — never fabricated for navigational-only rows. */
  inspectable?: ConstructionInspectable;
};

const NO_DATA: ConstructionInspectable = {
  progress: "No progress data yet",
  trade: "—",
  inspector: "Unassigned",
  punchListCount: "0",
};

function floors(count: number, idPrefix: string): ConstructionTreeNode[] {
  return Array.from({ length: count }, (_, i) => {
    const floorNumber = i + 1;
    return {
      id: `${idPrefix}-floor-${floorNumber}`,
      title: `Floor ${floorNumber}`,
      objectType: "Floor",
      inspectable: NO_DATA,
    };
  });
}

export const constructionProjects: ConstructionTreeNode[] = [
  {
    id: "stonepine",
    title: "Stonepine Residences",
    objectType: "Project",
    // 200-unit single-family subdivision — no discrete buildings, so the
    // second tier is Floor Plans, not Buildings. We don't have real floor
    // plan names, so this is one honest placeholder rather than 16 invented ones.
    children: [
      {
        id: "stonepine-floor-plans",
        title: "16 Floor Plans — not yet itemized",
        objectType: "Floor Plans",
        inspectable: NO_DATA,
      },
    ],
  },
  {
    id: "cedarwood",
    title: "Cedarwood Flats",
    objectType: "Project",
    // Buildings A–E, confirmed by the user. Building B intentionally
    // matches Genealogy's graphData.ts fixture (same project, same
    // building name).
    children: [
      {
        id: "cedarwood-building-a",
        title: "Building A",
        objectType: "Building",
        inspectable: { progress: "100%", trade: "General", inspector: "M. Alvarez", punchListCount: "0" },
      },
      {
        id: "cedarwood-building-b",
        title: "Building B",
        objectType: "Building",
        inspectable: { progress: "62%", trade: "MEP Rough-In", inspector: "M. Alvarez", punchListCount: "6" },
      },
      {
        id: "cedarwood-building-c",
        title: "Building C",
        objectType: "Building",
        inspectable: NO_DATA,
      },
      // D and E are new to this pass (the prior fixture only went to C) —
      // no established data of any kind for these two, so honest
      // placeholders rather than invented progress numbers.
      {
        id: "cedarwood-building-d",
        title: "Building D",
        objectType: "Building",
        inspectable: NO_DATA,
      },
      {
        id: "cedarwood-building-e",
        title: "Building E",
        objectType: "Building",
        inspectable: NO_DATA,
      },
    ],
  },
  {
    id: "garden-lofts",
    title: "Garden Lofts",
    objectType: "Project",
    // Single 20-story tower — no Buildings tier, Floors sit directly under
    // the project. Floor count is a real known fact; per-floor progress is not.
    children: floors(20, "garden-lofts"),
  },
  {
    id: "skyline",
    title: "Skyline Towers",
    objectType: "Project",
    // Single high-rise building, confirmed by the user despite the plural
    // name. Same Floors-directly-under-project shape as Garden Lofts.
    children: floors(40, "skyline"),
  },
];

export function findConstructionNode(
  id: string,
  nodes: ConstructionTreeNode[] = constructionProjects
): ConstructionTreeNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findConstructionNode(id, node.children);
      if (found) return found;
    }
  }
  return undefined;
}

export type ConstructionProjectBox = {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

// The Site Plan viewport shows the 4 projects as boxes. There's no real
// per-project status yet, so no status coloring — just the shared
// genealogy "project" tier token for visual identity, not a status color.
export const constructionProjectBoxes: ConstructionProjectBox[] = constructionProjects.map((project, i) => ({
  id: project.id,
  title: project.title,
  x: i * 260,
  y: 0,
  width: 220,
  height: 120,
}));

export function toProjectEntityNode(box: ConstructionProjectBox): EntityNodeData {
  return {
    id: box.id,
    title: box.title,
    subtitle: "Project",
    accentColor: "var(--ff-tier-project)",
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
  };
}

export function getConstructionBounds(): Bounds {
  const xs = constructionProjectBoxes.flatMap((n) => [n.x, n.x + n.width]);
  const ys = constructionProjectBoxes.flatMap((n) => [n.y, n.y + n.height]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}
