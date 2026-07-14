import type { Bounds, EntityNodeData } from "@/framework/viewport";

export type AssetStatus = "active" | "maintenance" | "retired";

export type AssetNodeData = {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  status: AssetStatus;
  x: number;
  y: number;
  width: number;
  height: number;
  lastService: string;
};

const STATUS_COLOR: Record<AssetStatus, string> = {
  active: "#22c55e",
  maintenance: "#f59e0b",
  retired: "#9ca3af",
};

export const assetNodes: AssetNodeData[] = [
  { id: "forklift-2", title: "Forklift F-2", subtitle: "Vehicle", category: "Vehicles", status: "active", x: 0, y: 0, width: 180, height: 90, lastService: "May 14, 2026" },
  { id: "crane-1", title: "Gantry Crane C-1", subtitle: "Equipment", category: "Equipment", status: "active", x: 220, y: 0, width: 180, height: 90, lastService: "Apr 2, 2026" },
  { id: "torque-wrench-12", title: "Torque Wrench Set #12", subtitle: "Tool", category: "Tools", status: "maintenance", x: 0, y: 140, width: 180, height: 90, lastService: "Jun 30, 2026" },
  { id: "dock-1", title: "Dock 1 Leveler", subtitle: "Infrastructure", category: "Infrastructure", status: "active", x: 220, y: 140, width: 180, height: 90, lastService: "Jan 9, 2026" },
];

export function toEntityNode(node: AssetNodeData): EntityNodeData {
  return { id: node.id, title: node.title, subtitle: node.subtitle, accentColor: STATUS_COLOR[node.status], x: node.x, y: node.y, width: node.width, height: node.height };
}

export function getAssetsBounds(): Bounds {
  const xs = assetNodes.flatMap((n) => [n.x, n.x + n.width]);
  const ys = assetNodes.flatMap((n) => [n.y, n.y + n.height]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

export function formatAssetStatus(status: AssetStatus): string {
  switch (status) {
    case "active": return "Active";
    case "maintenance": return "Maintenance";
    case "retired": return "Retired";
  }
}
