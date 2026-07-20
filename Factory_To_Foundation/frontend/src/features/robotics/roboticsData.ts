/**
 * The four real robots of the CE Factory Digital Twin
 * (CE_Integrated_Cell_V3_0-6.py's IntegratedCell.__init__: self.A1/A2/B1/B2).
 * Their identities are fixed at twin construction — not a runtime list —
 * so they're named here directly. All live telemetry (state, rail_x, the
 * six real joint angles q, tool_idx, cycles) is read live from the twin
 * store keyed on these names, never stored here (that would go stale).
 *
 * This replaces the previous fixture model entirely — the old rail/ATC
 * nodes with hardcoded "J1 37.2°" axis strings and invented cycle times
 * were placeholder data from before real joint telemetry existed, and are
 * gone rather than left to imply they were ever real.
 */
export const ROBOT_NAMES = ["A1", "A2", "B1", "B2"] as const;
export type RobotName = (typeof ROBOT_NAMES)[number];

// The twin's real robot state machine: PARKED_AT_ATC is the only at-rest
// state; every other real state string is active motion/work. "unknown"
// is reserved for no-live-data, never guessed.
const ROBOT_IDLE_STATES = new Set(["PARKED_AT_ATC"]);

export type RobotCoarseStatus = "running" | "idle" | "unknown";

export function robotCoarseStatus(state: string | undefined): RobotCoarseStatus {
  if (!state) return "unknown";
  return ROBOT_IDLE_STATES.has(state) ? "idle" : "running";
}
