import {
  ARM_LINK_RADIUS,
  ATC,
  BRIDGE_BEAM,
  COL_H,
  D1,
  D6,
  FIXED,
  MOD,
  PANEL_ON_HOOK,
  PIVOT,
  RACK,
  RACK_TIERS,
  RACK_UPRIGHT_OFFSETS,
  RAIL,
  ROLLER,
  RUNWAY,
  TILT,
  type Vec3,
} from "./twinGeometryConstants";
import { IDENTITY_AXES, type ObbPrim, type Prim, type SegPrim } from "./collisionEngine";
import { robotJointPoints } from "./twinKinematics";
import type { TwinState } from "./useTwinState";

/**
 * Builds the real collision body set from live TwinState, in twin space.
 * Every shape here mirrors the same real geometry FactoryGeometryViewport
 * renders (itself a direct port of the twin's own draw functions) — same
 * constants, same live fields, nothing invented. Where the rendered form
 * is a zero-thickness quad (table tops, panels), the collision shape is
 * the same real degenerate slab, not a padded guess.
 *
 * Deliberately NOT modeled (all cosmetic line-art with no real solid
 * dimensions in the twin): tilt hydraulic rods, fixture-table legs,
 * safety fence, floor plane, material stacks, catwalk railings.
 */

export type CollisionBody = {
  /** Manifest id (robots.A1, gantry, …) or a disclosed non-manifest environment id (env.*). */
  id: string;
  prims: Prim[];
};

const obb = (center: Vec3, half: Vec3, axes: [Vec3, Vec3, Vec3] = IDENTITY_AXES): ObbPrim => ({
  kind: "obb",
  center,
  half,
  axes,
});

const seg = (a: Vec3, b: Vec3, r = 0): SegPrim => ({ kind: "seg", a, b, r });

/** Same real per-robot rail assignment the viewport uses (fixed at IntegratedCell.__init__, not in state.json — only rail_x is live). */
export const ROBOT_RAIL_Y: Record<string, number> = {
  A1: RAIL.A_Y,
  A2: RAIL.A_Y,
  B1: RAIL.B_Y,
  B2: RAIL.B_Y,
};

/**
 * Pairs excluded from collision testing because they are physical mounts
 * by design, not anomalies: each robot's kinematic chain starts at z=0
 * on its own rail (the DH base point is the rail plane), so its first
 * link "intersects" its own rail box permanently by construction.
 * Robot-vs-OTHER-rail stays tested. Key format: sorted "a|b".
 */
const EXCLUDED_PAIRS = new Set(
  ["A1", "A2", "B1", "B2"].map((name) => {
    const rail = name.startsWith("A") ? "rail_A" : "rail_B";
    return pairKey(`robots.${name}`, rail);
  })
);

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function isExcludedPair(a: string, b: string): boolean {
  if (EXCLUDED_PAIRS.has(pairKey(a, b))) return true;
  // env.rack_frame vs rack_light/standard/heavy -- disclosed exclusion,
  // found live (2026-08-03): the frame's real uprights sit exactly at
  // each zone's own X boundary and its arms start exactly at the shared
  // spine Y=0, so frame and arms genuinely touch by construction --
  // they're the same physical rack, structurally joined, not two
  // independent objects that happen to overlap.
  if ((a === "env.rack_frame" && b.startsWith("rack_")) || (b === "env.rack_frame" && a.startsWith("rack_"))) {
    return true;
  }
  // robots.* vs env.fixture_table -- disclosed uniform-capsule-vs-zero-
  // thickness-table modeling limitation (documented for the twin's own
  // Phase 3 policy in Chappell_Robotics/CLAUDE.md): a zero-thickness
  // table plus a nonzero-radius arm can't distinguish "resting on the
  // surface to do real work" from "colliding through it" -- real contact
  // there is expected, not a fault. The twin's own _is_excluded_pair()
  // has excluded this since Phase 3; this file never got the matching
  // exclusion, so the dashboard showed 4 "persistent" contacts (one per
  // robot) that are actually harmless by design -- found live (2026-08-03)
  // once four robots got real WORKING poses to compare against for the
  // first time. Twin and FF must share the same collision semantics.
  if (a === "env.fixture_table" && b.startsWith("robots.")) return true;
  if (b === "env.fixture_table" && a.startsWith("robots.")) return true;
  return false;
}

// ── Per-subsystem builders ──

function gantryBody(state: TwinState): CollisionBody {
  const { bridge_x: bx, trolley_y: ty, hook_z: hz } = state.gantry;
  const prims: Prim[] = [
    obb([bx, RUNWAY.Y_NEG, COL_H / 2], [0.2, 0.25, COL_H / 2]),
    obb([bx, RUNWAY.Y_POS, COL_H / 2], [0.2, 0.25, COL_H / 2]),
    // Beam: the twin draws bottom+top faces at Z and Z+H — the real solid between them.
    obb([bx, 0, BRIDGE_BEAM.Z + BRIDGE_BEAM.H / 2], [0.15, RUNWAY.Y_POS, BRIDGE_BEAM.H / 2]),
    obb([bx, ty, BRIDGE_BEAM.Z - 0.45 / 2 - 0.05], [0.27, 0.35, 0.22]),
    obb([bx, ty, hz], [0.12, 0.1, 0.12]),
  ];

  if (state.gantry.carrying) {
    // Direct port of the twin's draw_panel_on_hook positioning math.
    // Pickup attachment point is deterministic from constants (the twin
    // stores it at __init__ from the same formula), so it needs no extra
    // state.json field.
    const ang = (state.gantry.panel_ang * Math.PI) / 180;
    const th = ang - Math.PI / 2;
    let ox: number;
    let oz: number;
    if (state.gantry.state === "HOOKED" || state.gantry.state === "LIFTING") {
      const pickupU = TILT.W * 0.7;
      ox = PIVOT.X - pickupU * Math.cos(Math.PI / 3);
      oz = PIVOT.Z + pickupU * Math.sin(Math.PI / 3);
    } else {
      let panelTop = hz - 0.15;
      if (panelTop - PANEL_ON_HOOK.L < 0.12) panelTop = 0.12 + PANEL_ON_HOOK.L;
      ox = bx;
      oz = panelTop;
    }
    const u: Vec3 = [-Math.sin(th), 0, -Math.cos(th)];
    const n: Vec3 = [Math.cos(th), 0, -Math.sin(th)];
    const center: Vec3 = [ox + (PANEL_ON_HOOK.L / 2) * u[0], ty, oz + (PANEL_ON_HOOK.L / 2) * u[2]];
    prims.push(obb(center, [PANEL_ON_HOOK.L / 2, PANEL_ON_HOOK.W, PANEL_ON_HOOK.THK], [u, [0, 1, 0], n]));
  }

  return { id: "gantry", prims };
}

const PANEL_VISIBLE_STATES = new Set(["RECEIVING", "TRANSFER_FORWARD", "DELIVERED"]);

function rollerBody(state: TwinState): CollisionBody {
  const cx = ROLLER.CX,
    cy = ROLLER.CY,
    hw = ROLLER.W / 2,
    hd = ROLLER.D / 2;
  const bz = ROLLER.Z - 0.32,
    tz = ROLLER.Z;
  const prims: Prim[] = [
    // Frame top rails (real zero-thickness strips) + side skirts (real vertical planes).
    obb([cx, -hd + 0.06, tz], [hw, 0.06, 0]),
    obb([cx, hd - 0.06, tz], [hw, 0.06, 0]),
    obb([cx, -hd, (bz + tz) / 2], [hw, 0, (tz - bz) / 2]),
    obb([cx, hd, (bz + tz) / 2], [hw, 0, (tz - bz) / 2]),
  ];
  // 20 real rollers as capsules along Y at the viewport's rendered height
  // (axis z = tz + R). Capsule vs the twin's flat-capped cylinder differs
  // only at the end caps, which sit inside the frame skirts.
  const halfLen = hd - 0.12;
  for (let i = 0; i < ROLLER.COUNT; i++) {
    const rx = cx - hw + 0.2 + (i * (2 * hw - 0.4)) / (ROLLER.COUNT - 1);
    prims.push(seg([rx, cy - halfLen, tz + ROLLER.R], [rx, cy + halfLen, tz + ROLLER.R], ROLLER.R));
  }
  if (PANEL_VISIBLE_STATES.has(state.roller.state)) {
    prims.push(obb([state.roller.panel_x, cy, tz + ROLLER.R * 2 + 0.01], [3.0, 1.65, 0]));
  }
  return { id: "roller", prims };
}

function tiltBody(state: TwinState, gantryState: string): CollisionBody {
  const ang = (state.tilt.angle_deg * Math.PI) / 180;
  const cos = Math.cos(ang),
    sin = Math.sin(ang);
  const u: Vec3 = [-cos, 0, sin];
  const n: Vec3 = [sin, 0, cos];
  const axes: [Vec3, Vec3, Vec3] = [u, [0, 1, 0], n];

  const prims: Prim[] = [
    // Leaf: real solid slab, top face through the real lp() corners, thickness below.
    obb(
      [
        PIVOT.X - (TILT.W / 2) * cos - (TILT.THICK / 2) * sin,
        TILT.CY,
        PIVOT.Z + (TILT.W / 2) * sin - (TILT.THICK / 2) * cos,
      ],
      [TILT.W / 2, TILT.D / 2, TILT.THICK / 2],
      axes
    ),
    // Base: real solid under the leaf's flat position.
    obb([PIVOT.X - TILT.BASE_W / 2, TILT.CY, TILT.BASE_H / 2], [TILT.BASE_W / 2, TILT.D / 2, TILT.BASE_H / 2]),
  ];

  // 4 real locating pins (segments, real extension state).
  const ph = state.tilt.pin_extended ? 0.28 : 0.08;
  for (const [uOff, vOff] of [
    [-2.5, -1.1],
    [-2.5, 1.1],
    [2.5, -1.1],
    [2.5, 1.1],
  ]) {
    const uu = TILT.W / 2 - uOff;
    const wx = PIVOT.X - uu * cos,
      wz = PIVOT.Z + uu * sin;
    prims.push(seg([wx, TILT.CY + vOff, wz], [wx + ph * sin, TILT.CY + vOff, wz + ph * cos]));
  }

  // Panel on leaf — same real visibility condition the twin (and the
  // viewport port) uses, including hiding once the gantry takes it.
  const liftVisible = state.tilt.state !== "CRANE_PICKUP" && state.tilt.angle_deg > 0.1 && gantryState !== "LIFTING";
  if (liftVisible) {
    const lift = 0.06;
    prims.push(
      obb(
        [PIVOT.X - (TILT.W / 2) * cos - lift * sin, TILT.CY, PIVOT.Z + (TILT.W / 2) * sin + lift * cos],
        [(TILT.W - 0.4) / 2, TILT.D / 2 - 0.15, 0],
        axes
      )
    );
  }
  return { id: "tilt", prims };
}

function robotBody(name: string, state: TwinState): CollisionBody {
  const robot = state.robots[name as keyof TwinState["robots"]];
  const railY = ROBOT_RAIL_Y[name];
  const pts = robotJointPoints(robot.q, [robot.rail_x, railY, 0]);
  const prims: Prim[] = [obb([robot.rail_x, railY, 0.48], [0.18, 0.18, 0.14])];
  for (let i = 0; i < pts.length - 1; i++) {
    // Phase 2.5: real capsule radius (ARM_LINK_RADIUS), not a zero-
    // thickness centerline. Some of these 6 segments are zero-length
    // (pure-rotation DH joints, a=0/d=0) -- seg() degenerates those to a
    // sphere at that joint, still a real capsule check, not a special
    // case. Uniform radius across all links -- see ARM_LINK_RADIUS's own
    // comment for why this is an honest estimate, not tapered CAD data.
    prims.push(seg(pts[i], pts[i + 1], ARM_LINK_RADIUS));
  }
  return { id: `robots.${name}`, prims };
}

function staticBodies(): CollisionBody[] {
  const bodies: CollisionBody[] = [];

  // 2 rails: solid envelope of the two stacked real rail plates (z 0.06–0.20).
  for (const [id, railY] of [
    ["rail_A", RAIL.A_Y],
    ["rail_B", RAIL.B_Y],
  ] as const) {
    bodies.push({
      id,
      prims: [obb([(RAIL.X_MIN + RAIL.X_MAX) / 2, railY, 0.13], [(RAIL.X_MAX - RAIL.X_MIN) / 2, 0.15, 0.07])],
    });
  }

  // 4 ATC racks — same placement math as the viewport's ATC_RACKS.
  for (const railName of ["A", "B"] as const) {
    const railY = railName === "A" ? RAIL.A_Y : RAIL.B_Y;
    const side = railName === "A" ? -1 : 1;
    for (const [key, cx] of [
      ["near", ATC.NEAR_X],
      ["far", ATC.FAR_X],
    ] as const) {
      bodies.push({
        id: `atc_${railName}_${key}`,
        // Near-Y offset was 0.15 -- 30mm short of the robot base's real
        // Y half-depth (0.18, matching RobotArm.tsx's real rendered base
        // box), so parked robot bases overlapped their ATC rack by 30mm.
        // 0.21 mirrors that 30mm as real clearance instead. Kept in sync
        // with the identical formula in FactoryGeometryViewport.tsx's
        // ATC_RACKS -- this is real placement math, not collision-only.
        prims: [obb([cx, railY + side * (0.21 + 0.37), 0.4], [0.55, 0.37, 0.4])],
      });
    }
  }

  // Fixture table top (real zero-thickness work surface; legs are cosmetic lines, not modeled).
  bodies.push({
    id: "env.fixture_table",
    prims: [obb([FIXED.CX, FIXED.CY, FIXED.Z], [FIXED.W / 2, FIXED.D / 2, 0])],
  });

  // Material rack (v13, redesigned 2026-08-03) — ONE unified structural
  // frame (env.rack_frame: slender uprights at each zone boundary + a
  // continuous top rail spanning the whole length, replacing the
  // original per-zone full-width posts that read as a solid divider
  // wall) plus three separate per-zone arm pairs (rack_light/standard/
  // heavy, same ids as before) that stay the real, distinct inventory
  // compartments — a single piece of equipment with three compartments,
  // not three separate rack units.
  const frameHalfX = (RACK_TIERS.length * RACK.ZONE_SPACING) / 2;
  const framePrims: Prim[] = RACK_UPRIGHT_OFFSETS.map((offset) =>
    obb([RACK.X + offset, RACK.Y, RACK.HEIGHT / 2], [RACK.UPRIGHT_HALF, RACK.UPRIGHT_HALF, RACK.HEIGHT / 2])
  );
  framePrims.push(obb([RACK.X, RACK.Y, RACK.HEIGHT], [frameHalfX, RACK.UPRIGHT_HALF, RACK.TOP_RAIL_HALF_Z]));
  bodies.push({ id: "env.rack_frame", prims: framePrims });

  RACK_TIERS.forEach(({ key }, i) => {
    const zoneX = RACK.X + (i - 1) * RACK.ZONE_SPACING;
    const prims: Prim[] = [];
    for (const side of [-1, 1] as const) {
      prims.push(
        obb(
          [zoneX, side * (RACK.ARM_PROJECTION / 2), RACK.SHELF_Z],
          [RACK.ZONE_HALF_X, RACK.ARM_PROJECTION / 2, RACK.ARM_HALF_THICK]
        )
      );
    }
    bodies.push({ id: `rack_${key}`, prims });
  });

  return bodies;
}

function moduleJigBody(placedWalls: string[]): CollisionBody | null {
  if (placedWalls.length === 0) return null;
  const prims: Prim[] = placedWalls.map((name, i) => {
    const s = MOD.S;
    const [xo, yo, hwP, hdP] =
      name.includes("PANEL_1") || i === 0
        ? [-s, 0, s, 0.1]
        : i === 1
          ? [s, 0, s, 0.1]
          : i === 2
            ? [0, -s, 0.1, s]
            : [0, s, 0.1, s];
    return obb([MOD.CX + xo, MOD.CY + yo, 0.1], [hwP, hdP, 0]);
  });
  return { id: "env.module_jig", prims };
}

export function buildCollisionBodies(state: TwinState): CollisionBody[] {
  const bodies: CollisionBody[] = [
    gantryBody(state),
    rollerBody(state),
    tiltBody(state, state.gantry.state),
    robotBody("A1", state),
    robotBody("A2", state),
    robotBody("B1", state),
    robotBody("B2", state),
    ...staticBodies(),
  ];
  const jig = moduleJigBody(state.placed_walls);
  if (jig) bodies.push(jig);
  return bodies;
}

/**
 * Real reach envelope per robot, derived ONLY from the twin's actual
 * ik() acceptance (no per-joint limits exist in the twin — verified):
 * for the twin's fixed tool-down convention the wrist sits at
 * TCP + (0,0,D6), and ik() accepts wrist targets whose distance from
 * the shoulder (base + (0,0,D1)) is within [|A2-A3|, MAX_REACH*0.99].
 * The reachable TCP set is therefore an exact spherical shell centered
 * at base + (0,0, D1 - D6). Closed form — nothing sampled, nothing
 * assumed.
 */
export function reachEnvelopeCenter(railX: number, railY: number): Vec3 {
  return [railX, railY, D1 - D6];
}
