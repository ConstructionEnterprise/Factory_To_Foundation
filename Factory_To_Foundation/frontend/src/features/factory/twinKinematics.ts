import * as THREE from "three";

import { A2, A3, D1, D6, MAX_REACH, type Vec3 } from "./twinGeometryConstants";
import type { Quat6 } from "./useTwinState";

/**
 * Real 6-axis forward kinematics for the CR6 arm — the three.js
 * equivalent of CE_Integrated_Cell_V3_0-6.py's `fk(q)` (SECTION 1B,
 * itself ported verbatim from CR6_V8_0_Dual_Robot_Cell.py's validated
 * V6.1 DH convention). Same DH row layout, same convention, just built
 * on THREE.Matrix4 instead of a hand-rolled 4x4 — `Matrix4.set(...)`
 * takes its arguments row-major, so each row below reads identically to
 * the Python source's `dh_transform` array literal, and `.multiply()`
 * post-multiplies exactly like the Python side's `T = T @ dh_transform(...)`.
 */

const HALF_PI = Math.PI / 2;

function dhTransform(a: number, alpha: number, d: number, theta: number): THREE.Matrix4 {
  const ct = Math.cos(theta);
  const st = Math.sin(theta);
  const ca = Math.cos(alpha);
  const sa = Math.sin(alpha);
  const m = new THREE.Matrix4();
  // prettier-ignore
  m.set(
    ct, -st * ca,  st * sa, a * ct,
    st,  ct * ca, -ct * sa, a * st,
    0,   sa,        ca,     d,
    0,   0,         0,      1
  );
  return m;
}

/**
 * Real per-joint world positions for one CR6 arm. `base` is
 * `[rail_x, rail_y, 0]` — the rail-X linear stage is NOT a 7th DH joint
 * (matches the twin side's `CR6Robot.base` computed property), so it's
 * added after solving the 6-DOF chain, not folded into the DH rows.
 *
 * Returns 7 real twin-space (x, y, z) points — index 0 is the rail-
 * mounted shoulder origin (== base), index 6 is the TCP. Callers must
 * still run each point through `toThree` before rendering, same as every
 * other real geometry helper in this feature.
 */
export function robotJointPoints(q: Quat6, base: Vec3): Vec3[] {
  const [q1, q2, q3, q4, q5, q6] = q;
  const dhRows: [number, number, number, number][] = [
    [0, HALF_PI, D1, q1],
    [A2, 0, 0, q2],
    [A3, 0, 0, q3],
    [0, -HALF_PI, 0, q4],
    [0, HALF_PI, 0, q5],
    [0, 0, D6, q6],
  ];

  const T = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const pts: Vec3[] = [[base[0], base[1], base[2]]];

  for (const [a, alpha, d, theta] of dhRows) {
    T.multiply(dhTransform(a, alpha, d, theta));
    v.setFromMatrixPosition(T);
    pts.push([v.x + base[0], v.y + base[1], v.z + base[2]]);
  }

  return pts;
}

/**
 * Real reachability check for the one fixed tool-down orientation
 * `robot_execute_point` always uses (DEFAULT_RPY = [0, pi, 0] in the
 * twin — see Phase G/Track B). Mirrors `ik()`'s own real early-exit
 * reach checks in CE_Integrated_Cell_V3_0-6.py: distance to the wrist
 * center vs `MAX_REACH*0.99`, and the `|c3|>1` inner-bound check — the
 * same real formula, not an approximation, specialized for this one
 * orientation whose wrist-offset vector simplifies to a constant
 * `[0, 0, D6]` (worked out by hand from `rpy_to_R([0, pi, 0])`, whose
 * third column — the tool's Z axis — comes out to exactly `[0, 0, -1]`).
 * Used to warn a human BEFORE they click Execute (Phase B3's decision),
 * not just to explain a dispatch failure after the fact — the real
 * dispatch-time gate in `robot_execute_point` remains the actual
 * backstop regardless of what this predicts.
 */
export function isPointReachableToolDown(targetWorld: Vec3, base: Vec3): boolean {
  const px = targetWorld[0] - base[0];
  const py = targetWorld[1] - base[1];
  const pz = targetWorld[2] - base[2];
  const wx = px;
  const wy = py;
  const wz = pz + D6;
  const r = Math.hypot(wx, wy);
  const s = wz - D1;
  const d2 = r * r + s * s;
  if (Math.sqrt(d2) > MAX_REACH * 0.99) return false;
  const c3 = (d2 - A2 * A2 - A3 * A3) / (2 * A2 * A3);
  return Math.abs(c3) <= 1;
}
