import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { GizmoHelper, GizmoViewcube, Line, OrbitControls, PerspectiveCamera, Text } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import { DetailRow, Legend, PanelCard, useSystemReadiness } from "@/framework/ui";
import { useSelection } from "@/context/SelectionContext";
import { usePermission } from "@/context/AuthContext";
import { TWIN_BRIDGE_URL } from "@/lib/env";

import { translateManifest, type LiveFactoryNode, type FactoryStatus } from "../twinTranslator";
import { useTwinManifest } from "../useTwinManifest";
import { useTwinState, type TwinState, type TwinEstopReason } from "../useTwinState";
import { RobotArm } from "../RobotArm";
import { useTwinControl, type UseTwinControlResult } from "../useTwinControl";
import { dispatchOne } from "../twinExecute";
import { startCollisionMonitor, useCollisionSnapshot, type CollisionEvent } from "../collisionStore";
import { ROBOT_RAIL_Y, reachEnvelopeCenter } from "../collisionGeometry";
import {
  ATC,
  BRIDGE_BEAM,
  CE_COLOR,
  COL_H,
  FIXED,
  IK_ACCEPT_REACH,
  IK_INNER_REACH,
  MOD,
  PIVOT,
  RACK,
  RACK_TIERS,
  RACK_UPRIGHT_OFFSETS,
  RAIL,
  ROLLER,
  RUNWAY,
  TILT,
  toThree,
  type Vec3,
} from "../twinGeometryConstants";

/**
 * A fixed initial camera framing, staged in three.js space directly (not
 * routed through `toThree` — this is a UI viewing decision, not real twin
 * data). Target [18, 2, 0] sits at the real scene's real X-center (the
 * runway/rail/gantry cluster spans real x 1-36) and a middling height.
 * `Bounds`/`useBounds()`'s declarative `fit` and imperative
 * `refresh().fit()` were both tried live here first and confirmed to
 * never actually reposition the camera (it stayed pinned at R3F's raw
 * default [0,0,5]) — almost certainly `OrbitControls` (mounted with its
 * own default target [0,0,0]) fighting it every frame, the same class of
 * bug already hit and fixed in Manufacturing's plan-view work. This
 * sidesteps it entirely with the same manual ref-based technique
 * Manufacturing's `InitialPerspectiveCamera` used, plus explicitly
 * passing `OrbitControls` a non-default `target` — Manufacturing's own
 * content happened to already be centered near the origin, which is why
 * that pattern didn't also need an explicit target there.
 */
const SCENE_TARGET: [number, number, number] = [18, 2, 0];
const CAMERA_EYE: [number, number, number] = [18, 26, 30];

function InitialCamera() {
  const camRef = useRef<THREE.PerspectiveCamera>(null);
  useLayoutEffect(() => {
    camRef.current?.position.set(...CAMERA_EYE);
    camRef.current?.lookAt(...SCENE_TARGET);
  }, []);
  return <PerspectiveCamera ref={camRef} makeDefault fov={50} near={0.5} far={200} />;
}

/**
 * Real 3D digital-twin viewport for Factory — replaces the old abstract
 * 2D FactoryCanvas/FactoryNode block representation entirely (no toggle
 * back; the 2D blocks were never the real thing). Every shape, dimension,
 * and live transform here is a direct port of the twin's own reference
 * viewport (`Construction_Enterprises/Chappell_Robotics/
 * pyvista_render.py` + the real geometry methods on `CE_Integrated_
 * Cell_V3_0-6.py`'s subsystem classes), confirmed by reading that source
 * directly during the Step 0 investigation — not approximated or
 * redesigned. See `../twinGeometryConstants.ts` for the real named
 * dimension constants this file builds from.
 *
 * Same bespoke react-three-fiber pattern already proven in Manufacturing's
 * GeometryViewport (Canvas + OrbitControls + click-to-select driving
 * SelectionContext) — reused, not reinvented.
 */

// Real status colors — the exact hex values behind --ff-status-positive/
// warning/critical/neutral in index.css. Three.js material/line colors
// need literal values, not CSS custom properties, so these are pinned
// here rather than read at render time (same approach GeometryViewport.tsx
// already uses for its dimension-line colors).
const STATUS_COLOR: Record<FactoryStatus, string> = {
  running: "#5f9668",
  idle: "#b98a3f",
  down: "#b0574c",
  unknown: "#8b93a1",
};

const ACCENT = "#d9631e";

// ── Small geometry helpers, mirroring pyvista_render.py's pv_box/pv_quad/pv_sphere ──

function Box({ center, half, color }: { center: Vec3; half: Vec3; color: string }) {
  const [cx, cy, cz] = toThree(...center);
  const [hw, hd, hh] = half; // real twin-space half-extents: x, y(depth), z(height)
  return (
    <mesh position={[cx, cy, cz]}>
      <boxGeometry args={[2 * hw, 2 * hh, 2 * hd]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function quadGeometry(corners: [Vec3, Vec3, Vec3, Vec3]): THREE.BufferGeometry {
  const pts = corners.map((c) => toThree(...c));
  const positions = new Float32Array(12);
  pts.forEach((p, i) => positions.set(p, i * 3));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.computeVertexNormals();
  return geo;
}

function Quad({ corners, color }: { corners: [Vec3, Vec3, Vec3, Vec3]; color: string }) {
  const geo = useMemo(() => quadGeometry(corners), [JSON.stringify(corners)]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color={color} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Seg({ p0, p1, color, width = 2 }: { p0: Vec3; p1: Vec3; color: string; width?: number }) {
  return <Line points={[toThree(...p0), toThree(...p1)]} color={color} lineWidth={width} />;
}

// ── Bounds-based status outline — same Box3 technique Manufacturing's
// SelectionOutline uses, applied per-subsystem instead of per-selection.
// `depsKey` is the caller's own real live values joined into a string;
// the box only recomputes when those specific values change, not on every
// unrelated poll tick. ──

function StatusOutline({ box, color }: { box: THREE.Box3; color: string }) {
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const geometry = useMemo(() => {
    const g = new THREE.BoxGeometry(size.x || 0.05, size.y || 0.05, size.z || 0.05);
    return new THREE.EdgesGeometry(g);
  }, [size.x, size.y, size.z]);
  return (
    <lineSegments position={center} geometry={geometry}>
      <lineBasicMaterial color={color} linewidth={1.5} />
    </lineSegments>
  );
}

function SelectionHighlight({ box }: { box: THREE.Box3 }) {
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const geometry = useMemo(() => {
    const g = new THREE.BoxGeometry(size.x + 0.06, size.y + 0.06, size.z + 0.06);
    return new THREE.EdgesGeometry(g);
  }, [size.x, size.y, size.z]);
  return (
    <lineSegments position={center} geometry={geometry}>
      <lineBasicMaterial color={ACCENT} linewidth={2.5} />
    </lineSegments>
  );
}

type SetSelected = ReturnType<typeof useSelection>["setSelected"];

/**
 * Wraps one real manifest-backed subsystem's geometry: click-to-select
 * (resolving to its real manifest id, same SelectionContext shape
 * FactoryBrowse already uses) plus a real-status-colored bounding
 * outline, always visible — the 3D equivalent of the old FactoryNode's
 * colored left-edge strip, so status stays legible at a glance in 3D
 * without overriding the twin's own real per-part material colors.
 */
function SubsystemGroup({
  manifestId,
  liveNodes,
  setSelected,
  selectedId,
  depsKey,
  colliding = false,
  children,
}: {
  manifestId: string;
  liveNodes: LiveFactoryNode[];
  setSelected: SetSelected;
  selectedId: string | undefined;
  depsKey: string;
  /** True when the collision monitor sees this subsystem in a real intersection right now — outline goes critical-red, overriding the status color. */
  colliding?: boolean;
  children: ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [box, setBox] = useState<THREE.Box3 | null>(null);

  useLayoutEffect(() => {
    if (!groupRef.current) return;
    const b = new THREE.Box3().setFromObject(groupRef.current);
    if (!b.isEmpty()) setBox(b);
    // depsKey intentionally the only real dependency — recompute only when
    // this subsystem's own real live values change, not on unrelated ticks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey]);

  const live = liveNodes.find((n) => n.node.id === manifestId);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!live) return;
    setSelected({
      feature: "factory",
      objectType: live.node.subtitle,
      objectId: manifestId,
      payload: live.payload,
    });
  };

  return (
    <group ref={groupRef} onClick={handleClick}>
      {children}
      {box && (
        <StatusOutline box={box} color={colliding ? STATUS_COLOR.down : STATUS_COLOR[live?.node.status ?? "unknown"]} />
      )}
      {box && selectedId === manifestId && <SelectionHighlight box={box} />}
    </group>
  );
}

/**
 * Real reach envelope for one robot — an exact spherical shell derived
 * ONLY from the twin's own ik() acceptance constraints (wrist within
 * [|A2-A3|, MAX_REACH*0.99] of the shoulder; no per-joint limits exist
 * anywhere in the twin, verified 1a). Centered on the robot's LIVE base,
 * so it slides with real rail travel. See reachEnvelopeCenter().
 */
function ReachEnvelope({ name, state }: { name: string; state: TwinState }) {
  const robot = state.robots[name as keyof TwinState["robots"]];
  const center = reachEnvelopeCenter(robot.rail_x, ROBOT_RAIL_Y[name]);
  const pos = toThree(...center);
  return (
    <>
      <mesh position={pos}>
        <sphereGeometry args={[IK_ACCEPT_REACH, 48, 32]} />
        <meshStandardMaterial color="#4a7ab5" transparent opacity={0.07} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={pos}>
        <sphereGeometry args={[IK_ACCEPT_REACH, 24, 16]} />
        <meshBasicMaterial color="#4a7ab5" wireframe transparent opacity={0.18} depthWrite={false} />
      </mesh>
      <mesh position={pos}>
        <sphereGeometry args={[IK_INNER_REACH, 24, 16]} />
        <meshStandardMaterial color="#b98a3f" transparent opacity={0.25} depthWrite={false} />
      </mesh>
    </>
  );
}

// ── Static, non-interactive scene dressing — real positions from the real
// constants, but not manifest-backed identities, so not clickable/status-
// colored (there is no "roller_frame"/"fixture_table" entry in
// cell_manifest.json — only the 13 real subsystems are). ──

function Floor() {
  return (
    <mesh position={toThree(18, 0, 0)} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[40, 14]} />
      <meshStandardMaterial color="#EFEFEF" transparent opacity={0.4} side={THREE.DoubleSide} />
    </mesh>
  );
}

// Real twin-space X/Y/Z reference triad — built from the same toThree()
// mapping as everything else here, so "X"/"Y"/"Z" label the twin's own
// axes (the ones RACK_X/RACK_Y/rail_x etc. are defined in), not three.js's
// internal Y-up convention. Toggled via the header's "Axes" button.
const AXES_LENGTH = 5;
const AXES_COLOR = { x: "#d64545", y: "#4caf50", z: "#3a6fd8" };

function AxesTriad() {
  const origin: Vec3 = [0, 0, 0];
  const xEnd: Vec3 = [AXES_LENGTH, 0, 0];
  const yEnd: Vec3 = [0, AXES_LENGTH, 0];
  const zEnd: Vec3 = [0, 0, AXES_LENGTH];
  return (
    <group>
      <Seg p0={origin} p1={xEnd} color={AXES_COLOR.x} width={3} />
      <Seg p0={origin} p1={yEnd} color={AXES_COLOR.y} width={3} />
      <Seg p0={origin} p1={zEnd} color={AXES_COLOR.z} width={3} />
      <Text position={toThree(...xEnd)} fontSize={0.5} color={AXES_COLOR.x}>X</Text>
      <Text position={toThree(...yEnd)} fontSize={0.5} color={AXES_COLOR.y}>Y</Text>
      <Text position={toThree(...zEnd)} fontSize={0.5} color={AXES_COLOR.z}>Z</Text>
    </group>
  );
}

function RunwayRails() {
  return (
    <>
      <Seg p0={[RUNWAY.X_MIN, RUNWAY.Y_NEG, 0.06]} p1={[RUNWAY.X_MAX, RUNWAY.Y_NEG, 0.06]} color="#555555" width={4} />
      <Seg p0={[RUNWAY.X_MIN, RUNWAY.Y_POS, 0.06]} p1={[RUNWAY.X_MAX, RUNWAY.Y_POS, 0.06]} color="#555555" width={4} />
    </>
  );
}

function FixtureTable() {
  const cx = FIXED.CX, cy = FIXED.CY, hw = FIXED.W / 2, hd = FIXED.D / 2, z = FIXED.Z;
  const corners: Vec3[] = [
    [cx - hw, cy - hd, z], [cx + hw, cy - hd, z], [cx + hw, cy + hd, z], [cx - hw, cy + hd, z],
  ];
  return (
    <>
      <mesh position={toThree(cx, cy, z)} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2 * hw, 2 * hd]} />
        <meshStandardMaterial color="#2A4A2A" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <Seg key={i} p0={corners[i]} p1={corners[(i + 1) % 4]} color={CE_COLOR.gold} width={1.8} />
      ))}
    </>
  );
}

function ModuleJigWalls({ placedWalls }: { placedWalls: string[] }) {
  const cx = MOD.CX, cy = MOD.CY, s = MOD.S;
  const cols = ["#C8A068", "#C09050", "#B87840", "#B06030"];
  return (
    <>
      {placedWalls.map((name, i) => {
        const color = cols[i % 4];
        const [xo, yo, hwP, hdP] =
          name.includes("PANEL_1") || i === 0
            ? [-s, 0, s, 0.1]
            : i === 1
              ? [s, 0, s, 0.1]
              : i === 2
                ? [0, -s, 0.1, s]
                : [0, s, 0.1, s];
        const corners: [Vec3, Vec3, Vec3, Vec3] = [
          [cx + xo - hwP, cy + yo - hdP, 0.1], [cx + xo + hwP, cy + yo - hdP, 0.1],
          [cx + xo + hwP, cy + yo + hdP, 0.1], [cx + xo - hwP, cy + yo + hdP, 0.1],
        ];
        return <Quad key={name} corners={corners} color={color} />;
      })}
    </>
  );
}

// ── Real manifest-backed subsystems ──

function GantryGeometry({ state }: { state: TwinState["gantry"] }) {
  const { bridge_x: bx, trolley_y: ty, hook_z: hz } = state;
  const y0 = RUNWAY.Y_NEG, y1 = RUNWAY.Y_POS, bz = BRIDGE_BEAM.Z, bw = 0.15;
  const beamCorners: [Vec3, Vec3, Vec3, Vec3] = [
    [bx - bw, y0, bz], [bx + bw, y0, bz], [bx + bw, y1, bz], [bx - bw, y1, bz],
  ];
  return (
    <>
      <Box center={[bx, RUNWAY.Y_NEG, COL_H / 2]} half={[0.2, 0.25, COL_H / 2]} color={CE_COLOR.column} />
      <Box center={[bx, RUNWAY.Y_POS, COL_H / 2]} half={[0.2, 0.25, COL_H / 2]} color={CE_COLOR.column} />
      <Quad corners={beamCorners} color={CE_COLOR.gold} />
      <Box center={[bx, ty, BRIDGE_BEAM.Z - 0.45 / 2 - 0.05]} half={[0.27, 0.35, 0.22]} color={CE_COLOR.hoist} />
      <Box center={[bx, ty, hz]} half={[0.12, 0.1, 0.12]} color={CE_COLOR.gold} />
    </>
  );
}

const PANEL_VISIBLE_STATES = new Set(["RECEIVING", "TRANSFER_FORWARD", "DELIVERED"]);

function RollerGeometry({ state }: { state: TwinState["roller"] }) {
  const cx = ROLLER.CX, cy = ROLLER.CY, hw = ROLLER.W / 2, hd = ROLLER.D / 2;
  const bz = ROLLER.Z - 0.32, tz = ROLLER.Z;
  const rollerXs = Array.from({ length: ROLLER.COUNT }, (_, i) => cx - hw + 0.2 + (i * (2 * hw - 0.4)) / (ROLLER.COUNT - 1));

  const px = state.panel_x;
  const ptz = tz + ROLLER.R * 2 + 0.01;
  const hwP = 3.0, hdP = 1.65;
  const panelCorners: [Vec3, Vec3, Vec3, Vec3] = [
    [px - hwP, cy - hdP, ptz], [px + hwP, cy - hdP, ptz], [px + hwP, cy + hdP, ptz], [px - hwP, cy + hdP, ptz],
  ];
  const visible = PANEL_VISIBLE_STATES.has(state.state);

  return (
    <>
      {/* Frame top rails */}
      <Quad corners={[[cx - hw, -hd, tz], [cx + hw, -hd, tz], [cx + hw, -hd + 0.12, tz], [cx - hw, -hd + 0.12, tz]]} color={CE_COLOR.base} />
      <Quad corners={[[cx - hw, hd - 0.12, tz], [cx + hw, hd - 0.12, tz], [cx + hw, hd, tz], [cx - hw, hd, tz]]} color={CE_COLOR.base} />
      {/* Frame side skirts */}
      <Quad corners={[[cx - hw, -hd, bz], [cx + hw, -hd, bz], [cx + hw, -hd, tz], [cx - hw, -hd, tz]]} color="#282828" />
      <Quad corners={[[cx - hw, hd, bz], [cx + hw, hd, bz], [cx + hw, hd, tz], [cx - hw, hd, tz]]} color="#282828" />
      {/* Rollers */}
      {rollerXs.map((rx, i) => {
        const [x, y, z] = toThree(rx, cy, tz + ROLLER.R);
        return (
          <mesh key={i} position={[x, y, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[ROLLER.R, ROLLER.R, 2 * hd - 0.24, 12]} />
            <meshStandardMaterial color="#AAAAAA" />
          </mesh>
        );
      })}
      {/* Live panel */}
      {visible && <Quad corners={panelCorners} color={CE_COLOR.panelT} />}
    </>
  );
}

function TiltGeometry({ state }: { state: TwinState["tilt"] }) {
  const ang = (state.angle_deg * Math.PI) / 180;
  const hw = TILT.D / 2;
  const lp = (u: number, dv: number): Vec3 => [PIVOT.X - u * Math.cos(ang), TILT.CY + dv, PIVOT.Z + u * Math.sin(ang)];
  const c0 = lp(0, -hw), c1 = lp(0, hw), c2 = lp(TILT.W, hw), c3 = lp(TILT.W, -hw);
  const off = (pt: Vec3): Vec3 => [pt[0] - TILT.THICK * Math.sin(ang), pt[1], pt[2] - TILT.THICK * Math.cos(ang)];
  const b0 = off(c0), b1 = off(c1), b2 = off(c2), b3 = off(c3);

  // Static base (real position, part of the "tilt" subsystem's real body).
  const bxRear = PIVOT.X, bxFront = PIVOT.X - TILT.BASE_W, by = TILT.D / 2, bz = TILT.BASE_H;

  // Hydraulics: foot -> mid -> real cyl_tip(y_off) rod tip.
  const cylBaseX = PIVOT.X - 1.8;
  const hyd = [-0.55, 0.55].map((yOff) => {
    const foot: Vec3 = [cylBaseX, TILT.CY + yOff, 0.3];
    const u = TILT.BASE_W * 0.55;
    const rodTip: Vec3 = [PIVOT.X - u * Math.cos(ang), TILT.CY + yOff, PIVOT.Z + u * Math.sin(ang) - TILT.THICK * 0.5];
    const mid: Vec3 = [
      foot[0] + 0.55 * (rodTip[0] - foot[0]),
      foot[1] + 0.55 * (rodTip[1] - foot[1]),
      foot[2] + 0.55 * (rodTip[2] - foot[2]),
    ];
    return { foot, mid, rodTip };
  });

  // Pins: real pin_pos(u_off, v_off).
  const pinExtended = state.pin_extended;
  const pins = [
    [-2.5, -1.1], [-2.5, 1.1], [2.5, -1.1], [2.5, 1.1],
  ].map(([uOff, vOff]) => {
    const u = TILT.W / 2 - uOff;
    const wx = PIVOT.X - u * Math.cos(ang), wz = PIVOT.Z + u * Math.sin(ang);
    const ph = pinExtended ? 0.28 : 0.08;
    const base: Vec3 = [wx, TILT.CY + vOff, wz];
    const tip: Vec3 = [wx + ph * Math.sin(ang), TILT.CY + vOff, wz + ph * Math.cos(ang)];
    return { base, tip };
  });

  // Lift panel — visibility/position condition duplicated from
  // pyvista_render.py's render_tilt, which itself duplicates it from the
  // matplotlib twin's inline draw_tilt_table check (that file's own
  // comment already flags this as "keep in sync manually" — this is now
  // a THIRD copy of the same real logic: the twin's inline matplotlib
  // check, pyvista_render.py's ported copy, and this one. If the twin's
  // lift-panel visibility/position condition ever changes, all three need
  // updating together; there's no shared method to read this from.
  const liftVisible = state.state !== "CRANE_PICKUP" && state.angle_deg > 0.1;
  // hw_p is computed in the real source too (TILT_W/2 - 0.2) but never
  // actually used there either — the real lp() calls below use the
  // literal 0.2/TILT.W-0.2 offsets directly. Ported faithfully, not
  // "fixed" by wiring in a variable the source itself doesn't use.
  const hdP = TILT.D / 2 - 0.15, lift = 0.06;
  const liftLp = (u: number, dv: number): Vec3 => [
    PIVOT.X - u * Math.cos(ang) - lift * Math.sin(ang),
    TILT.CY + dv,
    PIVOT.Z + u * Math.sin(ang) + lift * Math.cos(ang),
  ];
  const liftCorners: [Vec3, Vec3, Vec3, Vec3] = [
    liftLp(0.2, -hdP), liftLp(0.2, hdP), liftLp(TILT.W - 0.2, hdP), liftLp(TILT.W - 0.2, -hdP),
  ];

  return (
    <>
      {/* Static base */}
      <Quad corners={[[bxFront, -by, bz], [bxRear, -by, bz], [bxRear, by, bz], [bxFront, by, bz]]} color={CE_COLOR.base} />
      <Quad corners={[[bxFront, -by, 0], [bxRear, -by, 0], [bxRear, -by, bz], [bxFront, -by, bz]]} color="#282828" />
      <Quad corners={[[bxFront, by, 0], [bxRear, by, 0], [bxRear, by, bz], [bxFront, by, bz]]} color="#282828" />

      {/* Real leaf (top + bottom + 4 side faces from the real trig) */}
      <Quad corners={[c0, c1, c2, c3]} color={CE_COLOR.leaf} />
      <Quad corners={[b0, b1, b2, b3]} color="#282828" />
      <Quad corners={[c0, c3, b3, b0]} color="#303030" />
      <Quad corners={[c1, c2, b2, b1]} color="#303030" />
      <Quad corners={[c0, c1, b1, b0]} color="#2A2A2A" />
      <Quad corners={[c3, c2, b2, b3]} color="#252525" />

      {/* Hydraulics */}
      {hyd.map((h, i) => (
        <group key={i}>
          <Seg p0={h.foot} p1={h.mid} color={CE_COLOR.hydB} width={7} />
          <Seg p0={h.mid} p1={h.rodTip} color={CE_COLOR.hydR} width={4} />
        </group>
      ))}

      {/* Locking pins */}
      {pins.map((p, i) => (
        <Seg key={i} p0={p.base} p1={p.tip} color={CE_COLOR.gold} width={3.5} />
      ))}

      {/* Lifted wall panel */}
      {liftVisible && <Quad corners={liftCorners} color={CE_COLOR.panelC} />}
    </>
  );
}

const CR6_RAILS: { manifestId: string; y: number }[] = [
  { manifestId: "rail_A", y: RAIL.A_Y },
  { manifestId: "rail_B", y: RAIL.B_Y },
];

function Cr6RailGeometry({ railY }: { railY: number }) {
  const rw = 0.11, rb = 0.15, rz0 = 0.06, rz1 = rz0 + 0.14;
  return (
    <>
      <Quad
        corners={[[RAIL.X_MIN, railY - rb, rz0], [RAIL.X_MAX, railY - rb, rz0], [RAIL.X_MAX, railY + rb, rz0], [RAIL.X_MIN, railY + rb, rz0]]}
        color="#1C1C1C"
      />
      <Quad
        corners={[[RAIL.X_MIN, railY - rw, rz1], [RAIL.X_MAX, railY - rw, rz1], [RAIL.X_MAX, railY + rw, rz1], [RAIL.X_MIN, railY + rw, rz1]]}
        color="#1C1C1C"
      />
    </>
  );
}

const ATC_RACKS: { manifestId: string; cx: number; ry: number }[] = (["A", "B"] as const).flatMap((railName) => {
  const railY = railName === "A" ? RAIL.A_Y : RAIL.B_Y;
  const side = railName === "A" ? -1 : 1;
  return ([
    { key: "near", cx: ATC.NEAR_X },
    { key: "far", cx: ATC.FAR_X },
  ] as const).map(({ key, cx }) => ({
    manifestId: `atc_${railName}_${key}`,
    cx,
    // Kept in sync with collisionGeometry.ts's identical formula -- was
    // 0.15, moved to 0.21 to fix a real 30mm robot-base/ATC-rack overlap
    // (see that file's comment for the derivation).
    ry: railY + side * (0.21 + 0.37),
  }));
});

// Material rack (v13, redesigned 2026-08-03) — ONE unified structural
// frame (slender uprights at each zone boundary + a continuous top rail,
// replacing the original per-zone full-width posts that read as a solid
// divider wall between bays) plus three separate per-zone arm pairs that
// stay the real, distinct inventory compartments — reads as one piece of
// equipment with three compartments, not three separate rack units.
// Same zoneX/frame math as collisionGeometry.ts's staticBodies() rack
// section — kept in sync deliberately, same convention as ATC_RACKS above.
const MATERIAL_RACK_ZONES = RACK_TIERS.map(({ key, color }, i) => ({
  manifestId: `rack_${key}`,
  zoneX: RACK.X + (i - 1) * RACK.ZONE_SPACING,
  color,
}));

const RACK_FRAME_HALF_X = (RACK_TIERS.length * RACK.ZONE_SPACING) / 2;

function MaterialRackFrameGeometry() {
  return (
    <>
      {RACK_UPRIGHT_OFFSETS.map((offset) => (
        <Box
          key={offset}
          center={[RACK.X + offset, RACK.Y, RACK.HEIGHT / 2]}
          half={[RACK.UPRIGHT_HALF, RACK.UPRIGHT_HALF, RACK.HEIGHT / 2]}
          color="#3A3A3A"
        />
      ))}
      <Box
        center={[RACK.X, RACK.Y, RACK.HEIGHT]}
        half={[RACK_FRAME_HALF_X, RACK.UPRIGHT_HALF, RACK.TOP_RAIL_HALF_Z]}
        color="#3A3A3A"
      />
    </>
  );
}

function MaterialRackZoneGeometry({ zoneX, color }: { zoneX: number; color: string }) {
  return (
    <>
      {([-1, 1] as const).map((side) => (
        <Box
          key={side}
          center={[zoneX, side * (RACK.ARM_PROJECTION / 2), RACK.SHELF_Z]}
          half={[RACK.ZONE_HALF_X, RACK.ARM_PROJECTION / 2, RACK.ARM_HALF_THICK]}
          color={color}
        />
      ))}
    </>
  );
}

// Real per-robot rail_y lives in collisionGeometry's ROBOT_RAIL_Y
// (imported above) — one copy shared by rendering, collision checking, and
// the reach envelope so they can't drift apart. The arm itself renders via
// the shared RobotArm component, the exact same renderer Robotics' isolated
// viewport uses, so the two tabs can never disagree about the same live q.
function RobotGeometry({ name, robot }: { name: string; robot: TwinState["robots"]["A1"] }) {
  return <RobotArm q={robot.q} railX={robot.rail_x} railY={ROBOT_RAIL_Y[name]} toolIdx={robot.tool_idx} />;
}

// ── Scene root ──

function FactoryScene({ liveNodes, state, selectedId, setSelected, collidingIds, reachRobot, showAxes }: {
  liveNodes: LiveFactoryNode[];
  state: TwinState | null;
  selectedId: string | undefined;
  setSelected: SetSelected;
  /** Subsystem ids the collision monitor currently sees intersecting. */
  collidingIds: Set<string>;
  /** Robot name (A1/A2/B1/B2) whose real reach envelope should render, or null. */
  reachRobot: string | null;
  /** Whether the real twin-space X/Y/Z reference triad is visible. */
  showAxes: boolean;
}) {
  const handleMiss = () => {
    // Clicking empty space / non-manifest scene dressing (floor, rails,
    // fixture table) doesn't clear the selection — matches Manufacturing's
    // "click a non-unit part falls back to building root" spirit closely
    // enough, but Factory has no equivalent "root" concept, so a miss is
    // simply a no-op here.
  };

  return (
    <group onClick={handleMiss}>
      {showAxes && <AxesTriad />}
      <Floor />
      <RunwayRails />
      <FixtureTable />
      <MaterialRackFrameGeometry />
      {state && <ModuleJigWalls placedWalls={state.placed_walls} />}

      {CR6_RAILS.map((r) => (
        <SubsystemGroup
          key={r.manifestId}
          manifestId={r.manifestId}
          liveNodes={liveNodes}
          setSelected={setSelected}
          selectedId={selectedId}
          depsKey="static"
          colliding={collidingIds.has(r.manifestId)}
        >
          <Cr6RailGeometry railY={r.y} />
        </SubsystemGroup>
      ))}

      {ATC_RACKS.map((a) => (
        <SubsystemGroup
          key={a.manifestId}
          manifestId={a.manifestId}
          liveNodes={liveNodes}
          setSelected={setSelected}
          selectedId={selectedId}
          depsKey="static"
          colliding={collidingIds.has(a.manifestId)}
        >
          <Box center={[a.cx, a.ry, 0.4]} half={[0.55, 0.37, 0.4]} color="#1A1A1A" />
        </SubsystemGroup>
      ))}

      {MATERIAL_RACK_ZONES.map((z) => (
        <SubsystemGroup
          key={z.manifestId}
          manifestId={z.manifestId}
          liveNodes={liveNodes}
          setSelected={setSelected}
          selectedId={selectedId}
          depsKey="static"
          colliding={collidingIds.has(z.manifestId)}
        >
          <MaterialRackZoneGeometry zoneX={z.zoneX} color={z.color} />
        </SubsystemGroup>
      ))}

      {state && (
        <SubsystemGroup
          manifestId="gantry"
          liveNodes={liveNodes}
          setSelected={setSelected}
          selectedId={selectedId}
          depsKey={`${state.gantry.bridge_x},${state.gantry.trolley_y},${state.gantry.hook_z}`}
          colliding={collidingIds.has("gantry")}
        >
          <GantryGeometry state={state.gantry} />
        </SubsystemGroup>
      )}

      {state && (
        <SubsystemGroup
          manifestId="roller"
          liveNodes={liveNodes}
          setSelected={setSelected}
          selectedId={selectedId}
          depsKey={`${state.roller.panel_x},${state.roller.state}`}
          colliding={collidingIds.has("roller")}
        >
          <RollerGeometry state={state.roller} />
        </SubsystemGroup>
      )}

      {state && (
        <SubsystemGroup
          manifestId="tilt"
          liveNodes={liveNodes}
          setSelected={setSelected}
          selectedId={selectedId}
          depsKey={`${state.tilt.angle_deg},${state.tilt.pin_extended},${state.tilt.state}`}
          colliding={collidingIds.has("tilt")}
        >
          <TiltGeometry state={state.tilt} />
        </SubsystemGroup>
      )}

      {state &&
        (Object.keys(state.robots) as (keyof TwinState["robots"])[]).map((name) => {
          const robot = state.robots[name];
          return (
            <SubsystemGroup
              key={name}
              manifestId={`robots.${name}`}
              liveNodes={liveNodes}
              setSelected={setSelected}
              selectedId={selectedId}
              depsKey={`${robot.rail_x},${robot.q.join(",")},${robot.state},${robot.tool_idx}`}
              colliding={collidingIds.has(`robots.${name}`)}
            >
              <RobotGeometry name={name} robot={robot} />
            </SubsystemGroup>
          );
        })}

      {state && reachRobot && <ReachEnvelope name={reachRobot} state={state} />}
    </group>
  );
}

/**
 * Simulation run/pause control -- deliberately NOT twin-control/start/stop.
 * Twin *service* lifecycle (the driver process existing at all) is
 * infrastructure: it's brought up by twin-bridge's own auto-start-on-boot
 * and kept up by its auto-restart-with-backoff, invisible to the operator.
 * What this button actually controls is the simulation's run/pause state
 * (the real `pause`/`resume` commands, same mechanism Robotics' own
 * PauseToggle already uses) -- clicking "Stop Simulation" must not take
 * the twin offline, it pauses it. Twin Bridge Offline / Twin Starting are
 * shown as distinct, non-actionable states rather than folded into the
 * same button, since there's no operator action that fixes either one.
 */
function RunSimulationButton({
  twinControl,
  paused,
  manuallyMoved,
}: {
  twinControl: UseTwinControlResult;
  paused: boolean | undefined;
  manuallyMoved: boolean | undefined;
}) {
  const { bridgeReachable, control } = twinControl;
  const runPermission = usePermission("factory", "execute");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!bridgeReachable) {
    return (
      <span
        className="rounded-full px-2.5 py-0.5 text-xs font-medium"
        style={{ background: "var(--ff-chrome-bg)", color: "var(--ff-text-muted)" }}
        title={`twin-bridge not reachable at ${TWIN_BRIDGE_URL} — start it with: node twin-bridge/server.mjs`}
      >
        Twin Bridge Offline
      </span>
    );
  }

  const running = control?.status === "running";
  if (!running) {
    return (
      <span
        className="rounded-full px-2.5 py-0.5 text-xs font-medium"
        style={{ background: "var(--ff-chrome-bg)", color: "var(--ff-text-muted)" }}
        title="Bridge is up but the driver process isn't yet -- auto-start/auto-restart brings it up automatically, no action needed here"
      >
        Twin Starting…
      </span>
    );
  }

  // Real, twin-tracked (state._manually_moved), not an FF guess: a robot
  // jogged from a non-parked state keeps that state label afterward, and
  // the jog's own safety check only validates the final target pose, not
  // the path -- so automatic operation must not silently resume from an
  // unvalidated pose. Only "reset" (full cell reconstruction, real robots
  // genuinely PARKED_AT_ATC again) clears it, same as this file's own
  // _robot_manual_gate() comment documents.
  const invalid = manuallyMoved === true;

  async function handleToggle() {
    if (paused === undefined || invalid) return;
    setPending(true);
    setError(null);
    const result = paused ? await dispatchOne("resume", {}) : await dispatchOne("pause", { target: "all" });
    if (!result.ok) setError(result.reason ?? "pause/resume failed");
    setPending(false);
  }

  async function handleReset() {
    setPending(true);
    setError(null);
    const result = await dispatchOne("reset", {});
    if (!result.ok) setError(result.reason ?? "reset failed");
    setPending(false);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleToggle}
        disabled={pending || paused === undefined || invalid || !runPermission.allowed}
        className="rounded-[0.2rem] px-3.5 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        style={{ background: invalid ? "var(--ff-status-warning)" : !paused ? "var(--ff-status-critical)" : "var(--ff-status-positive)" }}
        title={
          runPermission.reason ??
          (invalid
            ? "A robot was manually jogged — reset the simulation before it can resume"
            : paused
              ? "Resume the simulation"
              : "Pause the simulation — the twin stays online")
        }
      >
        {invalid
          ? "Simulation Invalid"
          : pending
            ? "…"
            : paused === undefined
              ? "Simulation: --"
              : paused
                ? "Resume Simulation"
                : "Stop Simulation"}
      </button>
      <button
        type="button"
        onClick={handleReset}
        disabled={pending || !runPermission.allowed}
        className="rounded-[0.2rem] px-3.5 py-1.5 text-sm font-medium disabled:opacity-50"
        style={
          invalid
            ? { background: "var(--ff-status-critical)", color: "white" }
            : { border: "1px solid var(--ff-panel-border)", color: "var(--ff-text-primary)" }
        }
        title="Discard the current run and start fresh — robots return to PARKED_AT_ATC, frame/walls/cycles all reset"
      >
        Reset Simulation
      </button>
      <span className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
        {control?.bridgeOwned === false ? "external process" : `pid ${control?.pid}`} · frame {control?.frame ?? "—"}
      </span>
      {error && (
        <span className="text-xs font-medium" style={{ color: "var(--ff-status-critical)" }}>
          {error}
        </span>
      )}
    </div>
  );
}

/**
 * Shared open/close/positioning mechanics for every Viewport Ribbon
 * disclosure control (Current State, Collisions) — factored out once a
 * second consumer genuinely needed the exact same behavior, not
 * speculatively. Popover content is meant to be portaled to
 * document.body by the caller (see ViewportPopoverPanel below):
 * this viewport lives inside a react-resizable-panels Panel
 * (FactoryWorkspace.tsx), which clips overflowing descendants for its
 * own resize/collapse behavior — a plain nested `position: absolute`
 * popover (DropdownMenu's own pattern, fine for CommandRibbon since
 * that one sits outside any resizable panel) gets its lower half
 * silently clipped in this container. Confirmed live before switching
 * approaches, not assumed.
 */
function useViewportPopover() {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function toggle() {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setAnchor({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen((v) => !v);
  }

  return { open, anchor, triggerRef, popoverRef, toggle };
}

function ViewportPopoverPanel({
  popoverRef,
  anchor,
  width = "16rem",
  children,
}: {
  popoverRef: React.RefObject<HTMLDivElement | null>;
  anchor: { top: number; right: number };
  width?: string;
  children: ReactNode;
}) {
  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-30 max-h-[70vh] max-w-[calc(100vw-2rem)] overflow-y-auto p-3"
      style={{
        top: anchor.top,
        right: anchor.right,
        width,
        background: "var(--ff-panel-bg)",
        border: "var(--ff-border-width) solid var(--ff-panel-border)",
        borderRadius: "var(--ff-radius)",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
      }}
    >
      {children}
    </div>,
    document.body
  );
}

/**
 * The Viewport Ribbon's own diagnostic control — backed by GET
 * /system/ready (useSystemReadiness, framework/ui), the same
 * authoritative composition AppLayout's own SystemReadinessBanner
 * already uses. Replaces the old useTwinState().connected-driven "Live
 * Twin Data"/"Twin Offline" badge outright, rather than wrapping it:
 * that signal was demonstrated live to go stale (stuck reporting live
 * twin data for minutes after /system/ready correctly flagged the twin
 * as stalled — same underlying poll loop `state` below still uses for
 * everything else in this file, disclosed, not silently trusted here).
 * Frame/PID still come from useTwinControl, a separate, not-implicated
 * poll loop — unchanged from how RunSimulationButton already reads them.
 *
 * The static color legend (what Running/Idle/Down/No Live Data mean on
 * the 3D scene's own per-robot status dots) lives in this same popover
 * now — visualization semantics, not diagnostic state, so it doesn't
 * belong in the summary pill, but still needs a home now that the old
 * always-visible legend row is gone from the ribbon itself.
 */
function CurrentStateControl({ pid, frame }: { pid: number | null | undefined; frame: number | null | undefined }) {
  const readiness = useSystemReadiness();
  const { open, anchor, triggerRef, popoverRef, toggle } = useViewportPopover();

  const twinStateLabel = readiness.twin.paused
    ? "Paused (Ready)"
    : readiness.twin.stateAdvancing
      ? "Advancing"
      : "Stalled";

  return (
    <div className="ml-auto">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="rounded-full px-2.5 py-0.5 text-xs font-medium"
        style={
          readiness.ready
            ? { background: "var(--ff-status-positive)", color: "white" }
            : { background: "var(--ff-status-critical)", color: "white" }
        }
      >
        Current State — {readiness.ready ? "Ready" : "Not Ready"}
      </button>
      {open && anchor && (
        <ViewportPopoverPanel popoverRef={popoverRef} anchor={anchor}>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ff-text-muted)" }}>
            Current State
          </div>
          <DetailRow label="System" value={readiness.ready ? "Ready" : "Not Ready"} />
          <DetailRow label="Twin Bridge" value={readiness.twin.bridgeReachable ? "Connected" : "Unreachable"} />
          <DetailRow label="Twin Driver" value={readiness.twin.driverAlive ? "Alive" : "Not running"} />
          <DetailRow label="Twin State" value={twinStateLabel} />
          <DetailRow label="Frame" value={frame != null ? String(frame) : "—"} />
          <DetailRow label="PID" value={pid != null ? String(pid) : "—"} />
          {!readiness.ready && readiness.reasons.length > 0 && (
            <div className="mt-1 text-xs font-medium" style={{ color: "var(--ff-status-critical)" }}>
              {readiness.reasons.join("; ")}
            </div>
          )}
          <div className="my-2" style={{ borderTop: "var(--ff-border-width) solid var(--ff-panel-border)" }} />
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ff-text-muted)" }}>
            Viewport Legend
          </div>
          <div className="flex flex-col gap-1.5">
            <Legend color="var(--ff-status-positive)" label="Running" />
            <Legend color="var(--ff-status-warning)" label="Idle" />
            <Legend color="var(--ff-status-critical)" label="Down" />
            <Legend color="var(--ff-text-muted)" label="No Live Data" />
          </div>
        </ViewportPopoverPanel>
      )}
    </div>
  );
}

/**
 * One collision record's real, non-fabricated fields — deliberately the
 * same vocabulary Reports' CollisionReportCard already uses
 * (Subsystems/Frames/Duration/Max Penetration/Status), not a second
 * presentation invented for this control. No "Location"/"Severity" rows:
 * collisionEngine.ts's testBodies()/testPrims() never compute or retain
 * a contact-point coordinate or a severity classification — only an
 * intersection boolean and a penetration/separation depth. Showing
 * fields that don't exist would be fabrication, not diagnosis.
 */
function CollisionRecordRow({ event }: { event: CollisionEvent }) {
  return (
    <div className="py-2" style={{ borderTop: "var(--ff-border-width) solid var(--ff-panel-border)" }}>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: "var(--ff-text-primary)" }}>
          {event.a} × {event.b}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[0.65rem] font-medium"
          style={
            event.persistent
              ? { background: "var(--ff-status-critical)", color: "white" }
              : { background: "var(--ff-status-warning)", color: "white" }
          }
        >
          {event.persistent ? "Persistent" : "Transient"}
        </span>
      </div>
      <DetailRow label="Frames" value={`${event.startFrame}–${event.endFrame}`} />
      <DetailRow label="Duration" value={`${event.endFrame - event.startFrame} ticks (${event.samples} observed)`} />
      <DetailRow label="Max Penetration" value={`${(event.maxPenetration * 1000).toFixed(1)} mm`} />
    </div>
  );
}

/**
 * The Viewport Ribbon's collision disclosure control — real records
 * behind the count, not a second readiness system. Deliberately scoped
 * to ONGOING events (matches what the collapsed count already claims);
 * the full session log, including resolved events, already has a real
 * home in Reports' Collision Report card — this isn't a second copy of
 * that log, just the live-right-now picture relevant to this viewport.
 *
 * The estop-reason banner below is the one place this control asserts
 * causality, and only when the twin's own real `_estop_reason` says so
 * (CE_Integrated_Cell_V3_0-6.py: `_estop_reason = {"source":
 * "auto_collision", "pair": [...], "penetration_mm": ..., ...}`, set
 * when a body pair's penetration streak reaches
 * PERSISTENT_COLLISION_TICKS — a real, twin-side threshold, a different
 * "persistent" than this frontend's own snapshot-based flag on
 * CollisionEvent). That's the twin's own authoritative self-report, not
 * an inference this UI is making — labeled as such, and only the named
 * pair is described as the cause; any other concurrently-observed
 * persistent contact is listed below it as merely observed, not implied
 * causal.
 */
/** Explicit type predicate, not inline narrowing — TwinEstopReason's disclosed catch-all member (`source: string`) is structurally compatible with the literal "auto_collision" check too, so plain narrowing can't tell the two apart and TS falls back to `unknown` field types. An explicit `is` predicate asserts the real shape once, here, rather than fighting that at every call site. */
function isAutoCollisionEstop(
  reason: TwinEstopReason | null | undefined
): reason is Extract<TwinEstopReason, { source: "auto_collision" }> {
  return reason?.source === "auto_collision" && "pair" in reason && "penetration_mm" in reason && "frame" in reason;
}

function CollisionsControl({ estopReason }: { estopReason: TwinEstopReason | null | undefined }) {
  const collision = useCollisionSnapshot();
  const { open, anchor, triggerRef, popoverRef, toggle } = useViewportPopover();

  if (!collision.monitoring) return null;

  const persistentEvents = collision.events.filter((e) => e.ongoing && e.persistent);
  const transientEvents = collision.events.filter((e) => e.ongoing && !e.persistent);
  const hasPersistent = persistentEvents.length > 0;
  const hasTransient = transientEvents.length > 0;

  const label =
    hasPersistent && hasTransient
      ? `⚠ Collisions — ${persistentEvents.length} Persistent · ${transientEvents.length} Transient`
      : hasPersistent
        ? `⚠ Collisions — ${persistentEvents.length} Persistent`
        : hasTransient
          ? `Collisions — ${transientEvents.length} Transient`
          : "Collisions";

  const collisionCausedEstop = isAutoCollisionEstop(estopReason) ? estopReason : null;

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="rounded-full px-2.5 py-0.5 text-xs font-medium"
        style={
          hasPersistent
            ? { background: "var(--ff-status-critical)", color: "white" }
            : hasTransient
              ? { background: "var(--ff-status-warning)", color: "white" }
              : { background: "var(--ff-chrome-bg)", color: "var(--ff-text-muted)" }
        }
      >
        {label}
      </button>
      {open && anchor && (
        <ViewportPopoverPanel popoverRef={popoverRef} anchor={anchor} width="18rem">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ff-text-muted)" }}>
            Collisions
          </div>

          {collisionCausedEstop && (
            <div
              className="mb-2 rounded-[0.2rem] p-2 text-xs"
              style={{ background: "var(--ff-status-critical)", color: "white" }}
            >
              <div className="font-semibold">Twin reports: estop caused by this collision</div>
              <div className="mt-0.5">
                {collisionCausedEstop.pair[0]} ↔ {collisionCausedEstop.pair[1]} ·{" "}
                {collisionCausedEstop.penetration_mm.toFixed(1)} mm · frame {collisionCausedEstop.frame}
              </div>
              <div className="mt-1 text-[0.65rem] opacity-90">
                The twin's own real _estop_reason, not inferred by this UI.
              </div>
            </div>
          )}

          {!hasPersistent && !hasTransient && (
            <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
              No collisions observed across {collision.checkedSnapshots} checked snapshot
              {collision.checkedSnapshots === 1 ? "" : "s"}.
            </p>
          )}

          {persistentEvents.map((event) => (
            <CollisionRecordRow key={event.id} event={event} />
          ))}
          {transientEvents.map((event) => (
            <CollisionRecordRow key={event.id} event={event} />
          ))}

          <p className="mt-2 text-[0.65rem]" style={{ color: "var(--ff-text-muted)" }}>
            Ongoing contacts only — the full session log (including resolved events) is in Reports' Collision
            Report.
          </p>
        </ViewportPopoverPanel>
      )}
    </div>
  );
}

export default function FactoryGeometryViewport() {
  const { selected, setSelected } = useSelection();
  const { connected: manifestConnected, manifest } = useTwinManifest();
  const { state } = useTwinState();
  const collision = useCollisionSnapshot();
  const twinControl = useTwinControl();
  const [showReach, setShowReach] = useState(false);
  const [showAxes, setShowAxes] = useState(false);
  const [showGizmo, setShowGizmo] = useState(true);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  // The collision monitor runs on its own fast poll (every written twin
  // snapshot), independent of this component's 750ms display poll.
  useEffect(() => {
    startCollisionMonitor();
  }, []);

  // Manifest = Digital Twin membership. Live state = pose/status enrichment.
  // Loss of live connectivity must change confidence, not membership --
  // confirmed live this session that the twin's own manifest already has
  // no static/dynamic distinction (cell_manifest.json is 13 flat, equal
  // entries); the prior disappearing-on-disconnect behavior was purely an
  // FF rendering artifact, not anything CE's model implies.
  //
  // lastKnownStateRef caches the most recent REAL (non-null) state across
  // a disconnect -- deliberately local to this component, not inside
  // useTwinState.ts itself, so that hook's own null-on-disconnect
  // behavior (relied on elsewhere, e.g. RunSimulationButton/
  // CollisionsControl below, which must react to a genuine live
  // disconnect, not a cached one) stays completely untouched. Only
  // renderState -- fed to FactoryScene's 3D geometry, and nothing else --
  // falls back to the cache. If the twin has never once reported state
  // since this component mounted, the cache stays null and the affected
  // subsystems render nothing: there is no honest pose to draw yet, and
  // none is invented. liveNodes (below) is deliberately left on the raw
  // `state`, not renderState -- its own existing "unknown" fallback
  // (twinTranslator.ts's resolveLiveFields) is already the correct,
  // already-built way this codebase expresses "connection lost" per
  // subsystem, via SubsystemGroup's existing status-outline color, with
  // no new uncertainty UI invented here.
  const lastKnownStateRef = useRef<TwinState | null>(null);
  if (state) lastKnownStateRef.current = state;
  const renderState = state ?? lastKnownStateRef.current;

  const liveNodes: LiveFactoryNode[] = manifestConnected && manifest ? translateManifest(manifest, state) : [];
  const selectedId = selected?.feature === "factory" ? selected.objectId : undefined;

  const collidingIds = useMemo(() => new Set(collision.activeContactIds), [collision.activeContactIds]);
  const selectedRobot = selectedId?.startsWith("robots.") ? selectedId.split(".")[1] : null;
  const reachRobot = showReach && selectedRobot ? selectedRobot : null;

  return (
    <PanelCard title="Factory Digital Twin" className="h-full" bodyClassName="flex flex-col flex-1">
      {/*
        Viewport Ribbon — formally named now that this row has accumulated
        real controls beyond a simple title bar (simulation run/reset,
        camera aids, collision status, and now the Current State
        diagnostic). Distinct from the app-level Command Ribbon
        (Metrics | Filters | Instructions, FactoryToolbar) above this
        page — that one stays untouched; this one belongs to the Factory
        Digital Twin viewport specifically and travels with it.
      */}
      <div className="flex flex-wrap items-center gap-6 px-6 py-4 border-b border-gray-100">
        <RunSimulationButton twinControl={twinControl} paused={state?.paused} manuallyMoved={state?._manually_moved} />
        <CollisionsControl estopReason={state?._estop_reason} />
        <button
          type="button"
          onClick={() => setShowReach((v) => !v)}
          disabled={!selectedRobot}
          className="rounded-full px-2.5 py-0.5 text-xs font-medium disabled:opacity-40"
          style={
            reachRobot
              ? { background: "var(--ff-accent)", color: "white" }
              : { background: "var(--ff-chrome-bg)", color: "var(--ff-text-muted)" }
          }
          title={
            selectedRobot
              ? "Exact reach shell from the twin's real ik() acceptance (no per-joint limits exist in the twin)"
              : "Select a robot to view its real reach envelope"
          }
        >
          Reach Envelope{reachRobot ? ` — ${reachRobot}` : ""}
        </button>
        <button
          type="button"
          onClick={() => setShowAxes((v) => !v)}
          className="rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={
            showAxes
              ? { background: "var(--ff-accent)", color: "white" }
              : { background: "var(--ff-chrome-bg)", color: "var(--ff-text-muted)" }
          }
          title="Toggle a real X/Y/Z reference triad, in the twin's own coordinate system"
        >
          Axes
        </button>
        <button
          type="button"
          onClick={() => setShowGizmo((v) => !v)}
          className="rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={
            showGizmo
              ? { background: "var(--ff-accent)", color: "white" }
              : { background: "var(--ff-chrome-bg)", color: "var(--ff-text-muted)" }
          }
          title="Toggle the view cube (click a face/edge/corner to snap the camera to that view)"
        >
          View Cube
        </button>
        <CurrentStateControl pid={twinControl.control?.pid} frame={twinControl.control?.frame} />
      </div>

      <div className="relative flex-1" style={{ background: "var(--ff-content-bg)" }}>
        <Canvas>
          <ambientLight intensity={0.7} />
          <directionalLight position={[30, 40, 20]} intensity={1.3} />
          <directionalLight position={[-20, 20, -20]} intensity={0.4} />
          <FactoryScene
            liveNodes={liveNodes}
            state={renderState}
            selectedId={selectedId}
            setSelected={setSelected}
            collidingIds={collidingIds}
            reachRobot={reachRobot}
            showAxes={showAxes}
          />
          <InitialCamera />
          <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.08} target={SCENE_TARGET} />
          {showGizmo && (
            <GizmoHelper alignment="bottom-right" margin={[80, 80]} onUpdate={() => controlsRef.current?.update()}>
              <GizmoViewcube />
            </GizmoHelper>
          )}
        </Canvas>
        {reachRobot && (
          <p
            className="absolute bottom-2 left-3 rounded px-2 py-1 text-[0.65rem]"
            style={{ background: "var(--ff-chrome-bg)", color: "var(--ff-text-muted)" }}
          >
            Reach shell derived from the twin's real ik() acceptance: wrist {IK_INNER_REACH.toFixed(1)}–
            {IK_ACCEPT_REACH.toFixed(2)} m from shoulder, sliding with live rail position. The twin has no per-joint
            limits — this is its complete real reach constraint set.
          </p>
        )}
      </div>
    </PanelCard>
  );
}
