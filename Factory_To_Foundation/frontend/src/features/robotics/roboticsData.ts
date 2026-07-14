import type { Bounds } from "@/framework/viewport";
import type { EntityNodeData } from "@/framework/viewport";

/**
 * Seeded from the real CE Factory Digital Twin subsystem model
 * (CE_Integrated_Cell_V3_0-6.py) — one RailSubsystem, four ATCSubsystem
 * instances each with four Tool children — not fabricated fixture data.
 * Live axis/task/cycle-time values will come from the Twin Service once
 * Milestone B lands; the identities and structure here are real.
 */
export type RoboticsStatus = "running" | "idle" | "fault";

export type RoboticsNodeData = {
  id: string;
  title: string;
  subtitle: string;
  status: RoboticsStatus;
  x: number;
  y: number;
  width: number;
  height: number;
  currentTask: string;
  tool: string;
  cycleTime: string;
  axisPositions: string;
  tools: string[];
};

const STATUS_COLOR: Record<RoboticsStatus, string> = {
  running: "#22c55e",
  idle: "#f59e0b",
  fault: "#ef4444",
};

export const roboticsNodes: RoboticsNodeData[] = [
  {
    id: "rail",
    title: "Rail Subsystem",
    subtitle: "Linear Rail",
    status: "running",
    x: 0,
    y: 0,
    width: 720,
    height: 90,
    currentTask: "Whole-cell line-stop coordination",
    tool: "—",
    cycleTime: "—",
    axisPositions: "Position: 5.62m",
    tools: [],
  },
  {
    id: "atc-1",
    title: "ATC-1",
    subtitle: "ATC Subsystem",
    status: "running",
    x: 20,
    y: 160,
    width: 160,
    height: 100,
    currentTask: "Welding — Wall Panel WA-03-S",
    tool: "Welder",
    cycleTime: "38.4s",
    axisPositions: "J1 37.2° · J2 -11.8° · J3 94.1°",
    tools: ["Welder", "Grinder", "Stud Gun", "Vision Probe"],
  },
  {
    id: "atc-2",
    title: "ATC-2",
    subtitle: "ATC Subsystem",
    status: "running",
    x: 220,
    y: 160,
    width: 160,
    height: 100,
    currentTask: "Fastening — Track Assembly",
    tool: "Screwgun",
    cycleTime: "22.1s",
    axisPositions: "J1 -14.6° · J2 32.4° · J3 -8.9°",
    tools: ["Screwgun", "Router", "Clamp Array", "Vision Probe"],
  },
  {
    id: "atc-3",
    title: "ATC-3",
    subtitle: "ATC Subsystem",
    status: "idle",
    x: 420,
    y: 160,
    width: 160,
    height: 100,
    currentTask: "Awaiting next module",
    tool: "None mounted",
    cycleTime: "—",
    axisPositions: "J1 0.0° · J2 0.0° · J3 0.0°",
    tools: ["Welder", "Grinder", "Stud Gun", "Router"],
  },
  {
    id: "atc-4",
    title: "ATC-4",
    subtitle: "ATC Subsystem",
    status: "fault",
    x: 620,
    y: 160,
    width: 160,
    height: 100,
    currentTask: "Fault — tool change timeout",
    tool: "Clamp Array",
    cycleTime: "—",
    axisPositions: "J1 51.0° · J2 -4.2° · J3 12.7°",
    tools: ["Screwgun", "Router", "Clamp Array", "Stud Gun"],
  },
];

export function toEntityNode(node: RoboticsNodeData): EntityNodeData {
  return {
    id: node.id,
    title: node.title,
    subtitle: node.subtitle,
    accentColor: STATUS_COLOR[node.status],
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
  };
}

export function getRoboticsBounds(): Bounds {
  const xs = roboticsNodes.flatMap((n) => [n.x, n.x + n.width]);
  const ys = roboticsNodes.flatMap((n) => [n.y, n.y + n.height]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

export function formatRoboticsStatus(status: RoboticsStatus): string {
  switch (status) {
    case "running": return "Running";
    case "idle": return "Idle";
    case "fault": return "Fault";
  }
}
