import type { Bounds } from "@/framework/viewport";
import type { FactoryPayload } from "@/context/SelectionContext";

import type { TwinManifest, TwinManifestEntry } from "./useTwinManifest";
import type { TwinRobotState, TwinState } from "./useTwinState";

export type FactoryStatus = "running" | "idle" | "down" | "unknown";

export type FactoryNodeData = {
  id: string;
  title: string;
  subtitle: string;
  status: FactoryStatus;
  /** World-space position and footprint — explicit, not browser-decided. */
  x: number;
  y: number;
  width: number;
  height: number;
  cycleTime: string;
  utilization: string;
  operator: string;
  maintenance: string;
  alarms: string;
};

export function formatFactoryStatus(status: FactoryStatus): string {
  switch (status) {
    case "running":
      return "Running";
    case "idle":
      return "Idle";
    case "down":
      return "Down";
    case "unknown":
      return "—";
  }
}

/**
 * Static floor-plan layout, hand-placed only for the manifest identities
 * whose real physical arrangement is known today. Position is a UI
 * decision, not something read off the twin — `robots.*.x` in state.json
 * is rail-travel position (a single linear DOF), not a screen coordinate.
 * Anything in the manifest that isn't listed here (the 6 real rail/ATC
 * subsystems, or whatever the twin grows next) gets `fallbackGridSlot`
 * instead of a hand-authored position — deliberate, so a manifest that
 * grows doesn't require this table to grow in lockstep.
 */
const KNOWN_LAYOUT: Record<string, { x: number; y: number; width: number; height: number }> = {
  "robots.A1": { x: 40, y: 0, width: 160, height: 90 },
  "robots.A2": { x: 240, y: 0, width: 160, height: 90 },
  roller: { x: 40, y: 140, width: 170, height: 90 },
  tilt: { x: 240, y: 140, width: 170, height: 90 },
  gantry: { x: 440, y: 140, width: 170, height: 90 },
  "robots.B1": { x: 40, y: 280, width: 160, height: 90 },
  "robots.B2": { x: 240, y: 280, width: 160, height: 90 },
};

const FALLBACK_COLUMNS = 3;
const FALLBACK_CELL_WIDTH = 170;
const FALLBACK_CELL_HEIGHT = 90;
const FALLBACK_GAP = 20;
const FALLBACK_START_Y = 420; // clears KNOWN_LAYOUT's lowest row (y 280 + height 90)

function fallbackGridSlot(index: number) {
  const col = index % FALLBACK_COLUMNS;
  const row = Math.floor(index / FALLBACK_COLUMNS);
  return {
    x: 40 + col * (FALLBACK_CELL_WIDTH + FALLBACK_GAP),
    y: FALLBACK_START_Y + row * (FALLBACK_CELL_HEIGHT + FALLBACK_GAP),
    width: FALLBACK_CELL_WIDTH,
    height: FALLBACK_CELL_HEIGHT,
  };
}

/** Subtitle shown under the node title, keyed by the manifest's own `type` — falls back to the raw type string for anything not listed, so a new twin-side type still renders instead of erroring. */
const TYPE_SUBTITLES: Record<string, string> = {
  gantry: "Gantry",
  roller: "Roller",
  tilt: "Tilt",
  robot: "Robot",
  rail: "Rail",
  atc: "ATC",
};

// The twin has no per-subsystem fault concept — only a cell-wide
// `_last_error` for rejected commands, which is not an equipment alarm.
// "down" is therefore never derived from live data; only these known
// at-rest state strings count as "idle", everything else with a real
// state string is "running". "unknown" is reserved for manifest entries
// with no live data behind them at all — never guessed as idle/running.
const IDLE_STATES = new Set(["PARKED", "PARKED_AT_ATC", "IDLE", "FLAT"]);

function coarseStatus(rawState: string): FactoryStatus {
  return IDLE_STATES.has(rawState) ? "idle" : "running";
}

/** Resolves a manifest entry's dotted-path `id` (e.g. "robots.A1") against state.json's real shape — the same identity scheme both sides already share, not a second lookup table. */
function resolveByPath(state: TwinState, path: string): { state: string } | undefined {
  const value = path
    .split(".")
    .reduce<unknown>(
      (acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined),
      state
    );

  if (value && typeof value === "object" && typeof (value as Record<string, unknown>).state === "string") {
    return value as { state: string };
  }

  return undefined;
}

type LiveFields = { status: FactoryStatus; liveState?: string };

type TypeMapper = (entry: TwinManifestEntry, state: TwinState) => LiveFields | undefined;

/**
 * Per-type mapping functions for manifest types with a known, confirmed
 * shape in state.json today. Each currently reduces to the same
 * dotted-path lookup `resolveByPath` already does generically — kept as
 * explicit functions (not folded away) because this is the seam a future
 * type-specific field (e.g. surfacing gantry's real bridge_x) belongs in,
 * without disturbing the generic fallback below.
 */
const TYPE_MAPPERS: Record<string, TypeMapper> = {
  gantry: (_entry, state) => ({ status: coarseStatus(state.gantry.state), liveState: state.gantry.state }),
  roller: (_entry, state) => ({ status: coarseStatus(state.roller.state), liveState: state.roller.state }),
  tilt: (_entry, state) => ({ status: coarseStatus(state.tilt.state), liveState: state.tilt.state }),
  robot: (entry, state) => {
    const key = entry.id.split(".").pop() ?? "";
    const robot = (state.robots as Record<string, TwinRobotState>)[key];
    return robot ? { status: coarseStatus(robot.state), liveState: robot.state } : undefined;
  },
};

/**
 * The three-tier fallback the manifest-driven rewrite exists for:
 * 1. A known type (robot/gantry/roller/tilt) — dispatch to its mapper.
 * 2. An unmapped type that still has *something* at that path in
 *    state.json — generic raw-field read, same identity scheme.
 * 3. No data behind this identity at all (today: the real 2 rails + 4
 *    ATCs — confirmed real, confirmed zero live fields) — an honest
 *    "unknown" status, never a fabricated running/idle/down guess.
 */
function resolveLiveFields(entry: TwinManifestEntry, state: TwinState): LiveFields {
  const mapped = TYPE_MAPPERS[entry.type]?.(entry, state);
  if (mapped) return mapped;

  const generic = resolveByPath(state, entry.id);
  if (generic) return { status: coarseStatus(generic.state), liveState: generic.state };

  return { status: "unknown" };
}

export type LiveFactoryNode = {
  node: FactoryNodeData;
  payload: FactoryPayload;
};

/**
 * Maps every real manifest identity onto FactoryNodeData/FactoryPayload —
 * the full real subsystem count (13, not the 7 previously visible), not
 * just the ones with live state.json fields today. `state` may be null
 * (manifest reachable, state.json not) — every node still renders, just
 * with "unknown" status, since the manifest alone is enough to prove an
 * identity is real.
 */
export function translateManifest(manifest: TwinManifest, state: TwinState | null): LiveFactoryNode[] {
  let fallbackIndex = 0;

  return manifest.map((entry) => {
    const layout = KNOWN_LAYOUT[entry.id] ?? fallbackGridSlot(fallbackIndex++);
    const { status, liveState } = state ? resolveLiveFields(entry, state) : { status: "unknown" as FactoryStatus, liveState: undefined };
    const subtitle = TYPE_SUBTITLES[entry.type] ?? entry.type;

    const node: FactoryNodeData = {
      id: entry.id,
      title: entry.label,
      subtitle,
      status,
      x: layout.x,
      y: layout.y,
      width: layout.width,
      height: layout.height,
      cycleTime: "—",
      utilization: "—",
      operator: "Unassigned",
      maintenance: "—",
      alarms: "—",
    };

    return {
      node,
      payload: {
        name: node.title,
        status,
        cycleTime: node.cycleTime,
        utilization: node.utilization,
        operator: node.operator,
        maintenance: node.maintenance,
        alarms: node.alarms,
        liveState,
      },
    };
  });
}

export function getLiveFactoryBounds(nodes: LiveFactoryNode[]): Bounds {
  const boxes = nodes.map((n) => n.node);
  const xs = boxes.flatMap((b) => [b.x, b.x + b.width]);
  const ys = boxes.flatMap((b) => [b.y, b.y + b.height]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}
