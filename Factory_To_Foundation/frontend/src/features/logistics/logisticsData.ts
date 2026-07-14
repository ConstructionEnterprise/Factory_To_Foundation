import type { Bounds, EntityNodeData } from "@/framework/viewport";

export type LogisticsStatus = "in-transit" | "staged" | "delivered";
export type LogisticsZone = "receiving" | "storage" | "yard" | "transportation";

export type LogisticsNodeData = {
  id: string;
  title: string;
  subtitle: string;
  zone: LogisticsZone;
  status: LogisticsStatus;
  x: number;
  y: number;
  width: number;
  height: number;
  location: string;
  destination: string;
  loadInfo: string;
};

const STATUS_COLOR: Record<LogisticsStatus, string> = {
  "in-transit": "#f59e0b",
  staged: "#3b82f6",
  delivered: "#22c55e",
};

export const logisticsNodes: LogisticsNodeData[] = [
  { id: "receiving-dock", title: "Receiving Dock", subtitle: "Receiving", zone: "receiving", status: "staged", x: 0, y: 0, width: 200, height: 100, location: "Dock 1", destination: "—", loadInfo: "2 trailers awaiting unload" },
  { id: "storage-a", title: "Storage Bay A", subtitle: "Storage", zone: "storage", status: "staged", x: 240, y: 0, width: 200, height: 100, location: "Bay A", destination: "—", loadInfo: "14 modules staged" },
  { id: "module-089", title: "Module M24-089", subtitle: "Module", zone: "yard", status: "staged", x: 0, y: 160, width: 180, height: 90, location: "Yard Row 3", destination: "Cedarwood Flats — Bldg B", loadInfo: "Wall Panel WA-03-S installed" },
  { id: "forklift-2", title: "Forklift F-2", subtitle: "Forklift", zone: "yard", status: "in-transit", x: 220, y: 160, width: 170, height: 90, location: "Yard Row 2 → Row 3", destination: "Storage Bay A", loadInfo: "Carrying: Fastener Pallet" },
  { id: "crane-1", title: "Gantry Crane C-1", subtitle: "Crane", zone: "yard", status: "staged", x: 430, y: 160, width: 170, height: 90, location: "Yard Row 1", destination: "—", loadInfo: "Idle — available" },
  { id: "trailer-118", title: "Trailer TRL-118", subtitle: "Trailer", zone: "transportation", status: "in-transit", x: 0, y: 300, width: 200, height: 90, location: "Route 45, Mile 12", destination: "Garden Lofts — Lewisville TX", loadInfo: "Module M24-091" },
];

export function toEntityNode(node: LogisticsNodeData): EntityNodeData {
  return { id: node.id, title: node.title, subtitle: node.subtitle, accentColor: STATUS_COLOR[node.status], x: node.x, y: node.y, width: node.width, height: node.height };
}

export function getLogisticsBounds(): Bounds {
  const xs = logisticsNodes.flatMap((n) => [n.x, n.x + n.width]);
  const ys = logisticsNodes.flatMap((n) => [n.y, n.y + n.height]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

export function formatLogisticsStatus(status: LogisticsStatus): string {
  switch (status) {
    case "in-transit": return "In Transit";
    case "staged": return "Staged";
    case "delivered": return "Delivered";
  }
}
