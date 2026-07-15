import type { Bounds } from "@/framework/viewport";

/**
 * Phase 1 of real IEC 61131-3-style function blocks for Scheduling: named,
 * typed ports and port-to-port wires, derived directly from the real
 * pipeline order already specified (PO placed → Material arrives →
 * Sub-Assembly/Module production → Storage & Logistics →
 * Construction/Install) — not an invented ordering. Deliberately NOT an
 * execution engine: no value propagation, no tick/evaluation loop,
 * nothing runs. Same honest "no live data yet" placeholders Scheduling
 * already had, just modeled with real ports/wires instead of a generic
 * node-to-node connector.
 */
export type PortType = "BOOL"; // Phase 1: one minimal type, deliberately not
// inventing a richer payload type without a real reason to yet.

export type FunctionBlockPort = {
  id: string;
  label: string;
  type: PortType;
};

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
  inputs: FunctionBlockPort[];
  outputs: FunctionBlockPort[];
};

export type FunctionBlockWire = {
  fromNodeId: string;
  fromPortId: string;
  toNodeId: string;
  toPortId: string;
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
    inputs: [],
    outputs: [{ id: "poPlaced", label: "PO Placed", type: "BOOL" }],
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
    inputs: [{ id: "poPlaced", label: "PO Placed", type: "BOOL" }],
    outputs: [{ id: "materialReceived", label: "Material Received", type: "BOOL" }],
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
    inputs: [{ id: "materialReceived", label: "Material Received", type: "BOOL" }],
    // The digital twin's real state.json already has a `module_done: boolean`
    // field that is conceptually this exact signal — a real, concrete future
    // wiring point. Not connected here: doing so would be execution, out of
    // scope for Phase 1.
    outputs: [{ id: "moduleComplete", label: "Module Complete", type: "BOOL" }],
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
    inputs: [{ id: "moduleComplete", label: "Module Complete", type: "BOOL" }],
    outputs: [{ id: "readyForInstall", label: "Ready for Install", type: "BOOL" }],
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
    inputs: [{ id: "readyForInstall", label: "Ready for Install", type: "BOOL" }],
    outputs: [],
  },
];

export function getScheduleBounds(): Bounds {
  const xs = scheduleNodes.flatMap((n) => [n.x, n.x + n.width]);
  const ys = scheduleNodes.flatMap((n) => [n.y, n.y + n.height]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

/** One real wire per consecutive pipeline pair, connecting the exact output port to the exact input port it feeds — not a generic node-to-node line. */
export const scheduleWires: FunctionBlockWire[] = scheduleNodes.slice(0, -1).map((node, i) => {
  const nextNode = scheduleNodes[i + 1];
  return {
    fromNodeId: node.id,
    fromPortId: node.outputs[0].id,
    toNodeId: nextNode.id,
    toPortId: nextNode.inputs[0].id,
  };
});

const PORT_ZONE_TOP = 46;
const PORT_ZONE_BOTTOM_MARGIN = 12;

/**
 * Vertical offset (local to the node's own top edge) of a single port's
 * pin, given its index among the ports on that side and how many there
 * are. Shared by FunctionBlockNode (drawing its own pins) and
 * FunctionBlockCanvas (drawing wires that must land exactly on them) so
 * the two never drift apart. Distributes evenly rather than assuming
 * "exactly one port" — every block happens to have 0 or 1 per side today,
 * but this doesn't hardcode that.
 */
export function getPortOffsetY(nodeHeight: number, index: number, count: number): number {
  const zoneHeight = nodeHeight - PORT_ZONE_TOP - PORT_ZONE_BOTTOM_MARGIN;
  return PORT_ZONE_TOP + ((index + 0.5) / count) * zoneHeight;
}
