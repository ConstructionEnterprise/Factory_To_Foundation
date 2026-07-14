import type { Bounds, EntityNodeData } from "@/framework/viewport";

/**
 * The five real schedule types, laid out as the actual pipeline they
 * form: PO placed → Material arrives → Sub-Assembly/Module production →
 * Storage & Logistics → Construction/Install. This is content you
 * specified directly, not fixture data — what's honestly absent is any
 * live date/status, since each type is owned by a feature (Factory,
 * Logistics, Construction) that doesn't have real schedule data yet.
 */
export type ScheduleNodeData = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  ownedBy: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

const GAP = 240;

export const scheduleNodes: ScheduleNodeData[] = [
  {
    id: "inbound-material",
    title: "Inbound Material",
    subtitle: "Purchase Orders",
    description: "Tracks purchase orders from the moment they're placed, before material has physically arrived or been assigned a genealogy identity.",
    ownedBy: "Not yet built",
    x: 0,
    y: 0,
    width: 200,
    height: 100,
  },
  {
    id: "material-arrival",
    title: "Material Arrival",
    subtitle: "Receiving",
    description: "Tracks when material actually arrives on site and where it's routed — the moment a Material genealogy node is created.",
    ownedBy: "Logistics",
    x: GAP,
    y: 0,
    width: 200,
    height: 100,
  },
  {
    id: "subassembly-module",
    title: "Sub-Assembly & Module Production",
    subtitle: "Production",
    description: "Tracks the making of sub-assemblies and modules on the factory floor — connects to real cycle-time data once the Twin Service lands.",
    ownedBy: "Factory",
    x: GAP * 2,
    y: 0,
    width: 200,
    height: 100,
  },
  {
    id: "storage-logistics",
    title: "Module Storage & Logistics",
    subtitle: "Storage / Yard",
    description: "Tracks where finished modules sit in the yard and their transportation status ahead of delivery.",
    ownedBy: "Logistics",
    x: GAP * 3,
    y: 0,
    width: 200,
    height: 100,
  },
  {
    id: "construction-schedule",
    title: "Construction Schedule",
    subtitle: "Install / Site",
    description: "Tracks on-site installation sequencing — the coarsest-grained schedule of the five, closer to a critical-path Gantt than a live feed.",
    ownedBy: "Construction",
    x: GAP * 4,
    y: 0,
    width: 200,
    height: 100,
  },
];

export function toEntityNode(node: ScheduleNodeData): EntityNodeData {
  return {
    id: node.id,
    title: node.title,
    subtitle: node.subtitle,
    accentColor: "#f97316",
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
  };
}

export function getScheduleBounds(): Bounds {
  const xs = scheduleNodes.flatMap((n) => [n.x, n.x + n.width]);
  const ys = scheduleNodes.flatMap((n) => [n.y, n.y + n.height]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

export const scheduleEdges = scheduleNodes.slice(0, -1).map((node, i) => ({
  from: toEntityNode(node),
  to: toEntityNode(scheduleNodes[i + 1]),
}));
