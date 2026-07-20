/**
 * Real dimensioned geometry constants, ported directly from the digital
 * twin's own source (`Construction_Enterprises/Chappell_Robotics/
 * CE_Integrated_Cell_V3_0-6.py`) — the same real named constants
 * `pyvista_render.py`'s `draw_*`/`render_*` functions build the twin's own
 * reference viewport from. Every number here was read directly off that
 * file during the Step 0 investigation, not estimated or re-derived. All
 * units are meters, matching the twin's own coordinate system.
 *
 * The twin's Python code is Z-up (z = height, matching PyVista's
 * convention); three.js is Y-up. `toThree()` is the one place that
 * conversion happens — every consumer below reads real twin-space
 * (x, y, z) and calls `toThree` rather than reordering coordinates by
 * hand at each call site, so the mapping can't drift between subsystems.
 */

/** Real twin-space (x, y, z) point, pre-`toThree` conversion. */
export type Vec3 = [number, number, number];

/** Real twin-space (x, y, z) -> three.js (x, y, z), i.e. [x, z, y]. */
export function toThree(x: number, y: number, z: number): Vec3 {
  return [x, z, y];
}

/**
 * Real DH parameters for the CR6 arm, ported verbatim from
 * CE_Integrated_Cell_V3_0-6.py's SECTION 1B (itself ported verbatim from
 * CR6_V8_0_Dual_Robot_Cell.py's validated V6.1 DH convention — copied,
 * not re-derived, same discipline as every other constant in this file).
 * Used by `../twinKinematics.ts`'s forward-kinematics function.
 */
export const D1 = 1.5;
export const A2 = 2.5;
export const A3 = 2.0;
export const D6 = 0.5;

export const CE_COLOR = {
  gold: "#CC6600",
  column: "#4A4A4A",
  hoist: "#1E1E1E",
  base: "#2A2A2A",
  panelT: "#C8D8E8",
  leaf: "#333333",
  hydB: "#3A3A3A",
  hydR: "#AAAAAA",
  panelC: "#C8A44A",
} as const;

/** Real per-tool cosmetic color cycle from render_robot's tool_color — legacy, decoupled from real tool identity (see robot handoff notes), ported as-is since it's what the twin's own viewport really shows. */
export const TOOL_COLOR_CYCLE = ["#FF4400", "#44AAFF", "#44FF44", "#FFAA00", "#FF44AA"] as const;

export const FIXED = { W: 6.6, D: 3.8, CX: 8.3, CY: 0.0, Z: 0.9 } as const;

export const ROLLER = {
  W: 6.6,
  D: 3.8,
  COUNT: 20,
  R: 0.05,
  CX: 14.9,
  CY: 0.0,
  Z: 0.9,
} as const;

export const TILT = {
  W: 6.6,
  D: 3.8,
  CX: 21.5,
  CY: 0.0,
  Z: 0.9,
  BASE_W: 6.6,
  BASE_D: 3.8,
  BASE_H: 0.9,
  THICK: 0.18,
} as const;

/** PIVOT_X = TILT.CX + TILT.BASE_W / 2 (real formula from the twin source, not a separate constant there either). */
export const PIVOT = { X: TILT.CX + TILT.BASE_W / 2, Z: TILT.Z } as const;

export const MOD = { S: 2.2, CX: 32.0, CY: 0.0 } as const;

export const RUNWAY = { Y_NEG: -4.5, Y_POS: 4.5, X_MIN: 1.0, X_MAX: 36.0 } as const;

export const BRIDGE_BEAM = { Z: 7.8, H: 0.55 } as const;

/** COL_H = BRIDGE_BEAM.Z in the real source (columns reach the beam). */
export const COL_H = BRIDGE_BEAM.Z;

export const RAIL = { A_Y: -1.55, B_Y: 1.55, X_MIN: 5.0, X_MAX: 11.6 } as const;

export const ATC = { NEAR_X: 5.5, FAR_X: 11.1 } as const;
