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

/**
 * Real per-link collision radius (Phase 2.5), ported verbatim from the
 * twin's own `ARM_LINK_RADIUS`. Unlike D1/A2/A3/D6 above, this is NOT a
 * measured DH parameter -- the twin has no real per-link thickness
 * anywhere (arm linewidths are display pixels), so this is a
 * deliberate, honestly-labeled uniform engineering estimate for a
 * robot this size class, not vendor CAD. Keep in sync with the twin's
 * own value if it ever changes.
 */
export const ARM_LINK_RADIUS = 0.1;

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

// FAR_X was 11.1 -- stale copy of the twin's own ATC_FAR_X, never synced
// when that constant moved to 11.0 to fix a real 50mm roller/ATC-far
// collision (Phase 2). This file's own header says every number here is
// "read directly off that file, not estimated or re-derived" -- this one
// had drifted from its real source. Confirm this stays in sync if the
// twin's ATC_FAR_X ever changes again.
export const ATC = { NEAR_X: 5.5, FAR_X: 11.0 } as const;

/**
 * Real material-rack placement and geometry — v13 consolidation
 * (`Construction_Enterprises/CE_Digital_Twin_Unified_Plan_v13.md`).
 * Replaces the old 3-stacked-cube placement (behind atc_A_near, out of
 * reach of either robot at any rail position — confirmed a real, not
 * eyeballed, unreachable placement). This is the FIRST real rack geometry
 * on the FF side; the old rack only ever existed twin-side
 * (`_static_collision_bodies()`'s rack_light/standard/heavy, and
 * pyvista_render.py's rendering of the same three boxes) — FF's
 * `collisionGeometry.ts`/`FactoryGeometryViewport.tsx` never had it. Per
 * v13 Decision 1, this file (not the twin) is now the one real geometry
 * definition going forward.
 *
 * Shape: one open cantilever structure — a thin spine (post line) along X
 * at Y=RACK.Y, with arms projecting +-Y toward each rail so A-side and
 * B-side robots each work their own side, never reaching across. Three
 * material-tier zones (light/standard/heavy) sit side-by-side along the
 * spine's X length, each with its own arm pair — not stacked by Z, so
 * profiles rest horizontally (lying lengthwise on the arms), matching how
 * SSMA stud/track is actually racked, not standing/stacked as the old
 * cubes implied.
 *
 * Position (RACK.X=3.2, RACK.Y=0.0) and the overall footprint
 * (X[1.7,4.7], Y[-0.9,0.9], the same span ZONE_SPACING/ARM_PROJECTION
 * below reproduce) were verified, not guessed: (1) a real static check
 * against every other body (fixture table, both rails, all 4 ATC racks —
 * zero X-overlap with any of them, so the check holds regardless of real
 * rack height); (2) a real reach-envelope check (SAFE_REACH=4.5m) from
 * each rail's own X_MIN; (3) a real headless motion-path simulation
 * driving the twin's own ik()/dispatch/Phase 3 rejection/Phase 4
 * continuous per-tick collision monitor through a full rail-travel ->
 * approach -> retract -> rail-back -> placement sequence for A1 and B1,
 * checked every tick, not just endpoints. See that session's chat log for
 * the verification script; not committed to either repo (throwaway).
 */
export const RACK = {
  X: 3.2,
  Y: 0.0,
  ZONE_SPACING: 1.0, // center-to-center X spacing between the 3 zones
  ZONE_HALF_X: 0.5, // each zone's half-width along X (spine length = 3*ZONE_SPACING = 3.0m total)
  ARM_PROJECTION: 0.85, // each arm's real Y length from the spine to its outer (aisle) edge
  ARM_HALF_THICK: 0.05, // arm cross-section half-thickness (Z)
  POST_HALF_Y: 0.08, // spine post half-depth (Y) — thin, real structural post, not a wall
  HEIGHT: 1.8, // real post height
  SHELF_Z: 0.5, // real height where material rests on the arms
} as const;

/** Real per-tier zone identity, same X-ordering `_static_collision_bodies()` already uses (index 0 = RACK.X - ZONE_SPACING, the outermost/farthest-X zone). Colors carried over from pyvista_render.py's draw_material_rack_static tier coloring (silver-gray/blue/dark-red), the one part of the old PyVista rack worth keeping even though PyVista itself is parked. */
export const RACK_TIERS = [
  { key: "light", color: "#9AA0A6" },
  { key: "standard", color: "#3A6EA5" },
  { key: "heavy", color: "#8B3A3A" },
] as const;

/** Real carried-panel dimensions from the twin's draw_panel_on_hook (PL/PW/THK literals in CE_Integrated_Cell_V3_0-6.py) — PL is full length, W is HALF-depth (the twin's dy runs -PW..+PW), THK is the ±ts thickness offset. */
export const PANEL_ON_HOOK = { L: 4.0, W: 1.4, THK: 0.1 } as const;

/** Real hook travel heights from the twin source (HOOK_PARK_Z / HOOK_LOWER_Z / HOOK_DELIVER_Z). */
export const HOOK = { PARK_Z: 7.5, LOWER_Z: 5.25, DELIVER_Z: 1.2 } as const;

/**
 * Real IK acceptance constants from the twin's kinematics section
 * (SECTION 1B): MAX_REACH = A2+A3+D6; ik() rejects wrist targets beyond
 * MAX_REACH*0.99 and |c3|>1 (which bounds the wrist no closer than
 * |A2-A3| from the shoulder). These are the twin's ONLY real reach
 * constraints — no per-joint angle limits exist anywhere in its code
 * (verified by direct search, 2026-07-20), so any reach-envelope math
 * must derive from these and nothing else.
 */
export const MAX_REACH = A2 + A3 + D6;
export const IK_ACCEPT_REACH = MAX_REACH * 0.99;
export const IK_INNER_REACH = Math.abs(A2 - A3);
