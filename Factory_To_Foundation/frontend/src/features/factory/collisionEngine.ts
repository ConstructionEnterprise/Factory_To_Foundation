import type { Vec3 } from "./twinGeometryConstants";

/**
 * Real geometric collision math for the twin's primitive shapes, in twin
 * space (z-up, meters). Hand-rolled rather than a mesh-BVH library
 * because every collision-relevant shape in the scene is a closed-form
 * primitive (axis-aligned or y-rotated box, line segment, cylinder) —
 * primitive-vs-primitive tests are EXACT for these where a
 * triangle-mesh approach would be approximate over a tessellation.
 *
 * Exactness contract, stated honestly:
 * - OBB-OBB: intersection boolean and penetration depth are exact (SAT
 *   minimum-overlap). Separation distance between two boxes is NOT
 *   computed (SAT only bounds it), so box-box pairs never report a
 *   distance number — no approximate value dressed up as real.
 * - Segment/capsule vs box, segment vs segment: intersection AND
 *   distance are exact (closed-form seg-seg; convex/concave 1-D search
 *   to 1e-9 m for seg-box, far below any real dimension here).
 * - Zero-radius segments (robot arm links — the twin has no real link
 *   thickness, its linewidths are display pixels): a segment PASSING
 *   THROUGH a solid box is detected robustly; exact surface-grazing of
 *   a zero-thickness pair is measure-zero and not claimed. Exact
 *   distances are always reported for these pairs instead.
 */

export type ObbPrim = {
  kind: "obb";
  center: Vec3;
  /** Half-extents along the three local axes. A zero entry is a real degenerate (planar) shape, e.g. the twin's zero-thickness panel quads. */
  half: Vec3;
  /** Local axis unit vectors in twin space. Axis-aligned shapes pass IDENTITY_AXES. */
  axes: [Vec3, Vec3, Vec3];
};

export type SegPrim = {
  kind: "seg";
  a: Vec3;
  b: Vec3;
  /** 0 = true segment (arm links, pins). >0 = capsule (rollers — flat-vs-round end caps differ only inside the roller frame, noted where built). */
  r: number;
};

export type Prim = ObbPrim | SegPrim;

export const IDENTITY_AXES: [Vec3, Vec3, Vec3] = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

// ── Vector helpers ──

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + t * (b[0] - a[0]),
  a[1] + t * (b[1] - a[1]),
  a[2] + t * (b[2] - a[2]),
];

/** Rotation about the twin-space Y axis (the only rotation the scene really has: tilt leaf, carried panel). Maps local +x to (cos a, 0, sin a)·(-1 on x?) — callers pass explicit axis vectors, this is just a convenience for the common u/n pair. */
export function yRotAxes(uDir: Vec3, nDir: Vec3): [Vec3, Vec3, Vec3] {
  return [uDir, [0, 1, 0], nDir];
}

// ── Result shape ──

export type PrimContact = {
  intersecting: boolean;
  /** Meters. If intersecting: exact penetration depth. If separated: exact distance for segment-involving pairs, undefined for box-box (SAT can't give a real one). */
  metric?: number;
};

// ── OBB-OBB: SAT over the 15 canonical axes ──

/** Strict-interior tolerance: overlaps at or below this are boundary touches (adjacent geometry sharing a face/edge by construction), not interior penetration. 1e-9 m is far below any real dimension in the scene — geometric classification, not a tunable threshold. */
const TOUCH_EPS = 1e-9;

function obbProjection(o: ObbPrim, axis: Vec3): { c: number; r: number } {
  return {
    c: dot(o.center, axis),
    r:
      Math.abs(dot(o.axes[0], axis)) * o.half[0] +
      Math.abs(dot(o.axes[1], axis)) * o.half[1] +
      Math.abs(dot(o.axes[2], axis)) * o.half[2],
  };
}

function obbObb(a: ObbPrim, b: ObbPrim): PrimContact {
  const axes: Vec3[] = [...a.axes, ...b.axes];
  for (const ax of a.axes) {
    for (const bx of b.axes) {
      const c = cross(ax, bx);
      const l = len(c);
      if (l > 1e-9) axes.push([c[0] / l, c[1] / l, c[2] / l]);
    }
  }
  let minOverlap = Infinity;
  for (const axis of axes) {
    const pa = obbProjection(a, axis);
    const pb = obbProjection(b, axis);
    // Radius-form overlap: exit distance along this axis. Correct for
    // degenerate (zero-extent) shapes too, where the interval form
    // (min(max)-max(min)) wrongly reports 0 for a plane inside a box.
    const overlap = pa.r + pb.r - Math.abs(pa.c - pb.c);
    // Strict interior test: an exact shared boundary (overlap == 0 on
    // some axis) is touching adjacency, not a collision.
    if (overlap <= TOUCH_EPS) return { intersecting: false };
    if (overlap < minOverlap) minOverlap = overlap;
  }
  return { intersecting: true, metric: minOverlap };
}

// ── Segment/capsule vs OBB ──

/** Transform a world point into the OBB's local frame. */
function toLocal(o: ObbPrim, p: Vec3): Vec3 {
  const d = sub(p, o.center);
  return [dot(d, o.axes[0]), dot(d, o.axes[1]), dot(d, o.axes[2])];
}

/** Distance from a local-frame point to the (origin-centered) box surface; 0 if inside. Convex in the point. */
function outsideDist(p: Vec3, h: Vec3): number {
  const dx = Math.max(Math.abs(p[0]) - h[0], 0);
  const dy = Math.max(Math.abs(p[1]) - h[1], 0);
  const dz = Math.max(Math.abs(p[2]) - h[2], 0);
  return Math.hypot(dx, dy, dz);
}

/** Depth of a local-frame point inside the box (min face clearance); negative if outside. Concave (min of affine functions). */
function insideDepth(p: Vec3, h: Vec3): number {
  return Math.min(h[0] - Math.abs(p[0]), h[1] - Math.abs(p[1]), h[2] - Math.abs(p[2]));
}

/** Slab test: does the local-frame segment pass through the box volume? Returns the [t0,t1] overlap inside, or null. Robust for degenerate (zero-extent) slabs only as sign crossings — exact grazing is measure-zero, per the module contract. */
function segBoxOverlap(a: Vec3, b: Vec3, h: Vec3): [number, number] | null {
  let t0 = 0;
  let t1 = 1;
  for (let i = 0; i < 3; i++) {
    const d = b[i] - a[i];
    if (Math.abs(d) < 1e-12) {
      if (Math.abs(a[i]) > h[i]) return null;
    } else {
      let lo = (-h[i] - a[i]) / d;
      let hi = (h[i] - a[i]) / d;
      if (lo > hi) [lo, hi] = [hi, lo];
      t0 = Math.max(t0, lo);
      t1 = Math.min(t1, hi);
      if (t0 > t1) return null;
    }
  }
  return [t0, t1];
}

/** 1-D ternary search over t in [lo,hi]. `f` must be unimodal (convex when minimizing=false? — callers: minimize convex outsideDist, maximize concave insideDepth). */
function search1d(f: (t: number) => number, lo: number, hi: number, maximize: boolean): number {
  for (let i = 0; i < 80; i++) {
    const m1 = lo + (hi - lo) / 3;
    const m2 = hi - (hi - lo) / 3;
    const better = maximize ? f(m1) > f(m2) : f(m1) < f(m2);
    if (better) hi = m2;
    else lo = m1;
  }
  return f((lo + hi) / 2);
}

function segObb(s: SegPrim, o: ObbPrim): PrimContact {
  const la = toLocal(o, s.a);
  const lb = toLocal(o, s.b);

  // Degenerate (planar) box — the twin's real zero-thickness surfaces
  // (table tops, panels). "Interior depth" of a plane is meaningless, so
  // the real metric is the segment's maximum excursion PAST the surface
  // while inside the surface's footprint: e.g. "arm passes 62 mm below
  // the table surface." Only single-degenerate shapes exist in the scene.
  const degenerateAxis = o.half.findIndex((h) => h < 1e-12);
  if (degenerateAxis >= 0 && s.r === 0) {
    // Footprint window: slab intersection over the non-degenerate axes.
    let t0 = 0;
    let t1 = 1;
    for (let i = 0; i < 3; i++) {
      if (i === degenerateAxis) continue;
      const d = lb[i] - la[i];
      if (Math.abs(d) < 1e-12) {
        if (Math.abs(la[i]) > o.half[i]) {
          t0 = 1;
          t1 = 0;
        }
      } else {
        let lo = (-o.half[i] - la[i]) / d;
        let hi = (o.half[i] - la[i]) / d;
        if (lo > hi) [lo, hi] = [hi, lo];
        t0 = Math.max(t0, lo);
        t1 = Math.min(t1, hi);
      }
    }
    if (t0 <= t1) {
      const k = degenerateAxis;
      const pk0 = la[k] + t0 * (lb[k] - la[k]);
      const pk1 = la[k] + t1 * (lb[k] - la[k]);
      // Sign change within the footprint = the segment really crosses
      // the surface (robust); same-side stays a distance measurement.
      if ((pk0 < -TOUCH_EPS && pk1 > TOUCH_EPS) || (pk0 > TOUCH_EPS && pk1 < -TOUCH_EPS)) {
        return { intersecting: true, metric: Math.max(Math.abs(pk0), Math.abs(pk1)) };
      }
    }
    const d = search1d((t) => outsideDist(lerp(la, lb, t), o.half), 0, 1, false);
    return { intersecting: false, metric: d };
  }

  const overlap = segBoxOverlap(la, lb, o.half);
  if (overlap) {
    // Deepest interior point along the inside interval (concave → exact).
    const depth = search1d((t) => insideDepth(lerp(la, lb, t), o.half), overlap[0], overlap[1], true);
    if (depth > TOUCH_EPS || s.r > 0) {
      return { intersecting: true, metric: Math.max(depth, 0) + s.r };
    }
    return { intersecting: false, metric: 0 };
  }
  // Exact separation (convex → exact).
  const d = search1d((t) => outsideDist(lerp(la, lb, t), o.half), 0, 1, false);
  if (d < s.r) return { intersecting: true, metric: s.r - d };
  return { intersecting: false, metric: d - s.r };
}

// ── Segment vs segment (closed form, Ericson Real-Time Collision Detection §5.1.9) ──

export function segSegDistance(p1: Vec3, q1: Vec3, p2: Vec3, q2: Vec3): number {
  const d1 = sub(q1, p1);
  const d2 = sub(q2, p2);
  const r = sub(p1, p2);
  const a = dot(d1, d1);
  const e = dot(d2, d2);
  const f = dot(d2, r);
  let s: number;
  let t: number;
  if (a <= 1e-12 && e <= 1e-12) {
    s = 0;
    t = 0;
  } else if (a <= 1e-12) {
    s = 0;
    t = Math.min(Math.max(f / e, 0), 1);
  } else {
    const c = dot(d1, r);
    if (e <= 1e-12) {
      t = 0;
      s = Math.min(Math.max(-c / a, 0), 1);
    } else {
      const b = dot(d1, d2);
      const denom = a * e - b * b;
      s = denom > 1e-12 ? Math.min(Math.max((b * f - c * e) / denom, 0), 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = Math.min(Math.max(-c / a, 0), 1);
      } else if (t > 1) {
        t = 1;
        s = Math.min(Math.max((b - c) / a, 0), 1);
      }
    }
  }
  const c1 = lerp(p1, q1, s);
  const c2 = lerp(p2, q2, t);
  return len(sub(c1, c2));
}

function segSeg(s1: SegPrim, s2: SegPrim): PrimContact {
  const d = segSegDistance(s1.a, s1.b, s2.a, s2.b);
  const rsum = s1.r + s2.r;
  if (d < rsum) return { intersecting: true, metric: rsum - d };
  return { intersecting: false, metric: d - rsum };
}

// ── Dispatch ──

export function testPrims(a: Prim, b: Prim): PrimContact {
  if (a.kind === "obb" && b.kind === "obb") return obbObb(a, b);
  if (a.kind === "seg" && b.kind === "obb") return segObb(a, b);
  if (a.kind === "obb" && b.kind === "seg") return segObb(b, a);
  return segSeg(a as SegPrim, b as SegPrim);
}

// ── Broad phase: world AABB per body ──

export type Aabb = { min: Vec3; max: Vec3 };

export function primAabb(p: Prim): Aabb {
  if (p.kind === "seg") {
    return {
      min: [Math.min(p.a[0], p.b[0]) - p.r, Math.min(p.a[1], p.b[1]) - p.r, Math.min(p.a[2], p.b[2]) - p.r],
      max: [Math.max(p.a[0], p.b[0]) + p.r, Math.max(p.a[1], p.b[1]) + p.r, Math.max(p.a[2], p.b[2]) + p.r],
    };
  }
  const ext: Vec3 = [0, 1, 2].map(
    (i) =>
      Math.abs(p.axes[0][i]) * p.half[0] + Math.abs(p.axes[1][i]) * p.half[1] + Math.abs(p.axes[2][i]) * p.half[2]
  ) as unknown as Vec3;
  return {
    min: [p.center[0] - ext[0], p.center[1] - ext[1], p.center[2] - ext[2]],
    max: [p.center[0] + ext[0], p.center[1] + ext[1], p.center[2] + ext[2]],
  };
}

export function mergeAabbs(boxes: Aabb[]): Aabb {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const b of boxes) {
    for (let i = 0; i < 3; i++) {
      if (b.min[i] < min[i]) min[i] = b.min[i];
      if (b.max[i] > max[i]) max[i] = b.max[i];
    }
  }
  return { min, max };
}

export function aabbsOverlap(a: Aabb, b: Aabb, margin: number): boolean {
  for (let i = 0; i < 3; i++) {
    if (a.min[i] > b.max[i] + margin || b.min[i] > a.max[i] + margin) return false;
  }
  return true;
}

// ── Body-level test ──

export type BodyPairResult = {
  intersecting: boolean;
  /** Exact max penetration depth over intersecting primitive pairs (m). */
  maxPenetration: number;
  /** Exact min separation over segment-involving primitive pairs only (m); undefined when every checked pair was box-box. */
  minDistance?: number;
};

export function testBodies(aPrims: Prim[], bPrims: Prim[]): BodyPairResult {
  let intersecting = false;
  let maxPenetration = 0;
  let minDistance: number | undefined;
  for (const pa of aPrims) {
    for (const pb of bPrims) {
      const r = testPrims(pa, pb);
      if (r.intersecting) {
        intersecting = true;
        if ((r.metric ?? 0) > maxPenetration) maxPenetration = r.metric ?? 0;
      } else if (r.metric !== undefined) {
        if (minDistance === undefined || r.metric < minDistance) minDistance = r.metric;
      }
    }
  }
  return { intersecting, maxPenetration, minDistance };
}

// ── Dev-only known-answer self-check (tree-shaken from prod builds) ──

if (import.meta.env.DEV) {
  const box = (cx: number, cy: number, cz: number, h: Vec3): ObbPrim => ({
    kind: "obb",
    center: [cx, cy, cz],
    half: h,
    axes: IDENTITY_AXES,
  });
  const near = (x: number | undefined, want: number) => x !== undefined && Math.abs(x - want) < 1e-6;

  const checks: [string, boolean][] = [];
  // 1. Unit boxes overlapping by 0.3 along x → penetration exactly 0.3.
  const c1 = obbObb(box(0, 0, 0, [1, 1, 1]), box(1.7, 0, 0, [1, 1, 1]));
  checks.push(["obb overlap 0.3", c1.intersecting && near(c1.metric, 0.3)]);
  // 2. Segment passing through a unit box center → depth exactly 1.
  const c2 = segObb({ kind: "seg", a: [-2, 0, 0], b: [2, 0, 0], r: 0 }, box(0, 0, 0, [1, 1, 1]));
  checks.push(["seg through box depth 1", c2.intersecting && near(c2.metric, 1)]);
  // 3. Segment 0.4 above the box top → separation exactly 0.4.
  const c3 = segObb({ kind: "seg", a: [-2, 0, 1.4], b: [2, 0, 1.4], r: 0 }, box(0, 0, 0, [1, 1, 1]));
  checks.push(["seg above box dist 0.4", !c3.intersecting && near(c3.metric, 0.4)]);
  // 4. Parallel unit-offset segments in y and z → distance exactly sqrt(2).
  const d4 = segSegDistance([0, 0, 0], [1, 0, 0], [0, 1, 1], [1, 1, 1]);
  checks.push(["seg-seg sqrt2", Math.abs(d4 - Math.SQRT2) < 1e-9]);
  // 5. 45°-y-rotated unit box at x=2.2 vs axis unit box: corner truly reaches into the axis box.
  const s = Math.SQRT1_2;
  const rot: ObbPrim = {
    kind: "obb",
    center: [2.2, 0, 0],
    half: [1, 1, 1],
    axes: [
      [s, 0, s],
      [0, 1, 0],
      [-s, 0, s],
    ],
  };
  checks.push(["rotated obb corner hit", obbObb(box(0, 0, 0, [1, 1, 1]), rot).intersecting]);
  // 6. Exact shared boundary (faces flush at x=1) → touching, NOT a collision.
  const c6 = obbObb(box(0, 0, 0, [1, 1, 1]), box(2, 0, 0, [1, 1, 1]));
  checks.push(["flush faces are touch not collision", !c6.intersecting]);
  // 7. Zero-thickness plane cutting through a box interior → real penetration (0.6 to nearest y face).
  const c7 = obbObb(box(0, 0, 0, [1, 1, 1]), box(0, 0.4, 0, [2, 0, 2]));
  checks.push(["plane through box penetrates 0.6", c7.intersecting && near(c7.metric, 0.6)]);
  // 8. Segment crossing a zero-thickness plane → excursion metric (goes 0.5 past the surface).
  const c8 = segObb({ kind: "seg", a: [0, 0, 0.5], b: [0, 0, -0.5], r: 0 }, box(0, 0, 0, [2, 2, 0]));
  checks.push(["seg crosses plane excursion 0.5", c8.intersecting && near(c8.metric, 0.5)]);

  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length > 0) {
    console.error("[collisionEngine] SELF-CHECK FAILED:", failed.map(([name]) => name).join(", "));
  }
}
