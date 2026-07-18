import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { Bounds, Line, OrbitControls, PerspectiveCamera, Text, useBounds, useGLTF } from "@react-three/drei";
import * as THREE from "three";

import { PanelCard } from "@/framework/ui";
import { useSelection } from "@/context/SelectionContext";
import type { ManufacturingPayload } from "@/context/SelectionContext";

import {
  GARDEN_LOFTS_GLB_URL,
  useGardenLoftsTree,
  type ManufacturingUnit,
  type PlanDimensions,
  type ProjectSpec,
} from "../gardenLoftsModel";

type ViewMode = "3d" | "plan";

function unitToPayload(unit: ManufacturingUnit): ManufacturingPayload {
  return {
    kind: "unit",
    name: `${unit.typeLabel} — ${unit.subtypeCode}${unit.orientation ? ` (${unit.orientation})` : ""}`,
    objectName: unit.objectName,
    level: unit.level,
    typeLabel: unit.typeLabel,
    subtypeCode: unit.subtypeCode,
    squareFootage: unit.squareFootage,
    flag: unit.flag,
  };
}

function buildingPayload(projectSpec: ProjectSpec | undefined): ManufacturingPayload {
  return {
    kind: "building",
    name: projectSpec?.project_name ?? "Garden Lofts",
    projectSpec,
  };
}

/** Selected-object outline — a real Box3 computed each time the selection changes, not a shader trick. */
function SelectionOutline({ target }: { target: THREE.Object3D | undefined }) {
  const box = useMemo(() => {
    if (!target) return undefined;
    const b = new THREE.Box3().setFromObject(target);
    if (b.isEmpty()) return undefined;
    return b;
  }, [target]);

  if (!box) return null;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const geometry = new THREE.BoxGeometry(size.x || 0.1, size.y || 0.1, size.z || 0.1);
  const edges = new THREE.EdgesGeometry(geometry);

  return (
    <lineSegments position={center} geometry={edges}>
      <lineBasicMaterial color="#d9631e" linewidth={2} />
    </lineSegments>
  );
}

/**
 * Real per-unit isolation — frames just the selected unit, not the whole
 * tower. Uses drei's official useBounds()/bounds.refresh(target).fit()
 * mechanism — the documented, supported pattern for exactly this "click
 * an object, isolate the camera to it" use case. Must render as a child
 * of <Bounds> to reach useBounds(). Renders no geometry itself, so it
 * doesn't add anything to Bounds' own watched-children bounding volume.
 * An earlier hand-rolled version (direct camera.position/controls.target
 * mutation) was tried and dropped: live debugging confirmed the camera
 * state itself was set correctly and stayed stable frame-to-frame, but
 * the rendered frame never visibly matched it — switching to the
 * first-party mechanism sidesteps whatever the actual disconnect was.
 */
function IsolationRig({ target }: { target: THREE.Object3D | undefined }) {
  const bounds = useBounds();

  useEffect(() => {
    if (!target) return;
    bounds.refresh(target).fit();
  }, [target, bounds]);

  return null;
}

/**
 * Real top-down orthographic camera, framed to the selected unit's
 * actual world-space bounding box (not the baked PLAN_DIMENSIONS.outline
 * points directly — those are in Blender's Z-up space; re-measuring the
 * loaded three.js Object3D sidesteps the axis-convention conversion
 * entirely and stays correct regardless of exporter axis choices).
 */
function PlanViewCamera({ target }: { target: THREE.Object3D }) {
  // Targeted selectors, not a bare useThree() destructure — the latter
  // subscribes to the WHOLE store and re-renders this component on every
  // frame (camera moves, clock ticks, ...). Confirmed live as the real
  // cause of plan mode rendering nothing: the effect's dependency on the
  // `size` object (a fresh reference nearly every render under a bare
  // subscription) meant the camera was being created and immediately
  // torn down again before a frame could ever paint it — not a camera
  // math bug at all, a re-render-storm bug. Depending on primitive
  // width/height instead of the object fixes it.
  const setState = useThree((s) => s.set);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);

  const box = useMemo(() => new THREE.Box3().setFromObject(target), [target]);

  useEffect(() => {
    const center = box.getCenter(new THREE.Vector3());
    const s = box.getSize(new THREE.Vector3());
    const margin = 2.2; // meters of real drawing space around the unit for dimension lines/labels
    let halfW = s.x / 2 + margin;
    let halfD = s.z / 2 + margin;
    const aspect = width / Math.max(1, height);
    if (halfW / halfD > aspect) {
      halfD = halfW / aspect;
    } else {
      halfW = halfD * aspect;
    }

    const cam = new THREE.OrthographicCamera(-halfW, halfW, halfD, -halfD, 0.1, 200);
    cam.position.set(center.x, center.y + 40, center.z);
    cam.up.set(0, 0, -1);
    cam.lookAt(center.x, center.y, center.z);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);

    setState({ camera: cam });
  }, [box, width, height, setState]);

  return null;
}

const DIM_COLOR = "#2b2b2b";
const DIM_MUTED = "#9a9a9a";

/** One real CAD-style dimension: extension lines out to a witness line, the dimension line itself with end ticks, and a text label showing the real measured value. All points passed in are already real world-space points. */
function DimensionLine({
  p1,
  p2,
  offsetDir,
  offsetDist,
  label,
  drawY,
}: {
  p1: THREE.Vector3;
  p2: THREE.Vector3;
  offsetDir: THREE.Vector3;
  offsetDist: number;
  label: string;
  drawY: number;
}) {
  const offset = offsetDir.clone().normalize().multiplyScalar(offsetDist);
  const d1 = new THREE.Vector3(p1.x + offset.x, drawY, p1.z + offset.z);
  const d2 = new THREE.Vector3(p2.x + offset.x, drawY, p2.z + offset.z);
  const mid = d1.clone().add(d2).multiplyScalar(0.5);

  const along = d2.clone().sub(d1).normalize();
  const tick = 0.18;
  const perp = new THREE.Vector3(-along.z, 0, along.x).multiplyScalar(tick);
  // Text reading direction must follow the dimension line's own orientation
  // (not always world-X) — a fixed reading direction meant a vertical
  // (west/east-edge) label's wide text always overreached its own offset
  // lane and overlapped its horizontal-edge neighbor regardless of spacing;
  // confirmed live. yaw is applied as the group child's local-Z rotation,
  // which composes with the parent's flat-lay rotation as a true world-Y
  // (vertical-axis) yaw — see derivation in the plan-view task notes.
  const yaw = Math.atan2(-along.z, along.x);

  return (
    <group>
      <Line points={[[p1.x, drawY, p1.z], [d1.x, d1.y, d1.z]]} color={DIM_MUTED} lineWidth={1} />
      <Line points={[[p2.x, drawY, p2.z], [d2.x, d2.y, d2.z]]} color={DIM_MUTED} lineWidth={1} />
      <Line points={[[d1.x, d1.y, d1.z], [d2.x, d2.y, d2.z]]} color={DIM_COLOR} lineWidth={1.5} />
      <Line
        points={[
          [d1.x - perp.x, d1.y, d1.z - perp.z],
          [d1.x + perp.x, d1.y, d1.z + perp.z],
        ]}
        color={DIM_COLOR}
        lineWidth={1.5}
      />
      <Line
        points={[
          [d2.x - perp.x, d2.y, d2.z - perp.z],
          [d2.x + perp.x, d2.y, d2.z + perp.z],
        ]}
        color={DIM_COLOR}
        lineWidth={1.5}
      />
      <group position={[mid.x, drawY + 0.02, mid.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <Text
          rotation={[0, 0, yaw]}
          fontSize={0.32}
          color={DIM_COLOR}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.015}
          outlineColor="white"
        >
          {label}
        </Text>
      </group>
    </group>
  );
}

function metersLabel(m: number): string {
  const ft = m * 3.28084;
  return `${m.toFixed(2)} m (${ft.toFixed(1)}')`;
}

/** Real dimension overlay, built entirely from the selected unit's live Box3 (position/geometry) crossed with its baked PLAN_DIMENSIONS (real scalar measurements) — never a placeholder line. */
function DimensionOverlay({ target, plan }: { target: THREE.Object3D; plan: PlanDimensions }) {
  const box = useMemo(() => new THREE.Box3().setFromObject(target), [target]);
  const drawY = box.max.y + 0.05;

  const corners = {
    sw: new THREE.Vector3(box.min.x, drawY, box.max.z),
    se: new THREE.Vector3(box.max.x, drawY, box.max.z),
    nw: new THREE.Vector3(box.min.x, drawY, box.min.z),
    ne: new THREE.Vector3(box.max.x, drawY, box.min.z),
  };

  const elements: React.ReactNode[] = [];

  // Overall width — always real, from the unit's own outline, drawn along the south edge.
  elements.push(
    <DimensionLine
      key="width"
      p1={corners.sw}
      p2={corners.se}
      offsetDir={new THREE.Vector3(0, 0, 1)}
      offsetDist={0.9}
      drawY={drawY}
      label={metersLabel(plan.overallWidth_m)}
    />
  );

  // Overall depth — always real, drawn along the west edge, pulled further
  // out than the party-wall dimensions below so their labels don't overlap
  // (both live on the west/east edges; width has no such neighbor since
  // boundingElements never occur on north/south per Step 0's findings).
  elements.push(
    <DimensionLine
      key="depth"
      p1={corners.nw}
      p2={corners.sw}
      offsetDir={new THREE.Vector3(-1, 0, 0)}
      offsetDist={1.7}
      drawY={drawY}
      label={metersLabel(plan.overallDepth_m)}
    />
  );

  // Real confirmed party-wall distances (only ever present for sides that
  // resolved in Step 0's investigation — never fabricated for the rest).
  for (const be of plan.boundingElements) {
    const isWest = be.side === "west";
    const p1 = isWest ? corners.nw : corners.ne;
    const p2 = isWest ? corners.sw : corners.se;
    const dir = new THREE.Vector3(isWest ? -1 : 1, 0, 0);
    elements.push(
      <DimensionLine
        key={`be-${be.id}`}
        p1={p1}
        p2={p2}
        offsetDir={dir}
        offsetDist={0.3}
        drawY={drawY}
        label={be.distance_m <= 0.005 ? "0.00 m (touching)" : metersLabel(be.distance_m)}
      />
    );
  }

  // Honest note for sides where Step 0 found no confirmed adjacent wall — never a fabricated dimension.
  for (const side of plan.unresolvedSides) {
    const isWest = side === "west";
    const mid = isWest
      ? corners.nw.clone().add(corners.sw).multiplyScalar(0.5)
      : corners.ne.clone().add(corners.se).multiplyScalar(0.5);
    const dir = new THREE.Vector3(isWest ? -1 : 1, 0, 0).multiplyScalar(0.6);
    elements.push(
      <Text
        key={`unresolved-${side}`}
        position={[mid.x + dir.x, drawY + 0.02, mid.z]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.26}
        color={DIM_MUTED}
        anchorX="center"
        anchorY="middle"
        maxWidth={1.6}
        textAlign="center"
      >
        {`No confirmed\nadjacent wall (${side})`}
      </Text>
    );
  }

  return <group>{elements}</group>;
}

/**
 * Sets the perspective camera's starting position exactly once, via ref,
 * instead of a declarative `position` prop. A literal-array `position`
 * prop gets re-applied by R3F on every re-render, which was fighting
 * imperative repositioning (confirmed live) — real bug, not a data/method
 * issue.
 */
function InitialPerspectiveCamera({ makeDefault, fov }: { makeDefault: boolean; fov: number }) {
  const camRef = useRef<THREE.PerspectiveCamera>(null);
  useEffect(() => {
    camRef.current?.position.set(70, 55, 70);
  }, []);
  return <PerspectiveCamera ref={camRef} makeDefault={makeDefault} fov={fov} />;
}

/**
 * Everything that lives inside the Canvas. The two view modes mount
 * genuinely different subtrees rather than toggling visibility on a
 * shared one — real per-mode camera ownership (Bounds only exists in
 * "3d" mode, the orthographic camera only exists in "plan" mode), no
 * shared-state fighting between them. `scene.getObjectByName()` is
 * called directly on the cached glTF scene object (stable across
 * renders/mounts) rather than through a ref into the render tree, so
 * object identity resolution doesn't depend on what's currently mounted.
 */
function SceneRoot({ viewMode }: { viewMode: ViewMode }) {
  const { scene } = useGLTF(GARDEN_LOFTS_GLB_URL);
  const { projectSpec, unitsByObjectName } = useGardenLoftsTree();
  const { selected, setSelected } = useSelection();

  const selectedObjectName = selected?.feature === "manufacturing" ? selected.objectId : undefined;
  const selectedObject3D = useMemo(
    () => (selectedObjectName ? scene.getObjectByName(selectedObjectName) ?? undefined : undefined),
    [scene, selectedObjectName]
  );

  const selectedUnit =
    selected?.feature === "manufacturing" && selected.payload.kind === "unit"
      ? unitsByObjectName.get(selected.payload.objectName)
      : undefined;

  const planModeClone = useMemo(() => {
    if (viewMode !== "plan" || !selectedObject3D) return undefined;
    const clone = selectedObject3D.clone(true);
    // The unit plate is a near-zero-thickness mesh (0.05m) — its face
    // normal only points one way, and a straight-down orthographic camera
    // can land on the culled back face (confirmed live: the isometric 3D
    // view renders it fine at an angle, but plan view showed nothing
    // despite provably-correct camera state). DoubleSide is the correct,
    // safe fix for an architectural plan view regardless of which way the
    // real normal happens to point.
    clone.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const mat = obj.material;
      if (Array.isArray(mat)) {
        obj.material = mat.map((m) => {
          const cloned = m.clone();
          cloned.side = THREE.DoubleSide;
          return cloned;
        });
      } else if (mat) {
        const cloned = mat.clone();
        cloned.side = THREE.DoubleSide;
        obj.material = cloned;
      }
    });
    return clone;
  }, [viewMode, selectedObject3D]);

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    const clicked = event.object;
    const unit = unitsByObjectName.get(clicked.name);

    if (unit) {
      setSelected({
        feature: "manufacturing",
        objectType: "Unit",
        objectId: unit.objectName,
        payload: unitToPayload(unit),
      });
      return;
    }

    // Any non-unit part of the tower (columns, curtain wall, core, site)
    // falls back to the building root — same identity Browse's root row uses.
    setSelected({
      feature: "manufacturing",
      objectType: "Building",
      objectId: "GardenLofts_Tower",
      payload: buildingPayload(projectSpec),
    });
  };

  return (
    <>
      {viewMode === "3d" && (
        <Bounds fit clip observe margin={1.25}>
          <primitive object={scene} onClick={handleClick} />
          {selectedUnit && <IsolationRig target={selectedObject3D} />}
        </Bounds>
      )}
      {viewMode === "3d" && <InitialPerspectiveCamera makeDefault fov={45} />}
      {viewMode === "3d" && <SelectionOutline target={selectedObject3D} />}

      {viewMode === "plan" && selectedObject3D && planModeClone && selectedUnit?.planDimensions && (
        <>
          <primitive object={planModeClone} />
          <DimensionOverlay target={selectedObject3D} plan={selectedUnit.planDimensions} />
          <PlanViewCamera target={selectedObject3D} />
        </>
      )}
    </>
  );
}

function ViewModeToggle({ mode, onChange, disabled }: { mode: ViewMode; onChange: (m: ViewMode) => void; disabled: boolean }) {
  return (
    <div className="absolute right-3 top-3 z-10 flex gap-1 rounded-[0.2rem] p-1" style={{ background: "var(--ff-panel-bg)", border: "1px solid var(--ff-panel-border)" }}>
      {(["3d", "plan"] as const).map((m) => (
        <button
          key={m}
          type="button"
          disabled={disabled && m === "plan"}
          onClick={() => onChange(m)}
          title={disabled && m === "plan" ? "Select a unit to view its plan drawing" : undefined}
          className="rounded-[0.15rem] px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wide disabled:opacity-40"
          style={{
            background: mode === m ? "var(--ff-accent)" : "transparent",
            color: mode === m ? "white" : "var(--ff-text-muted)",
          }}
        >
          {m === "3d" ? "3D" : "Plan"}
        </button>
      ))}
    </div>
  );
}

/**
 * Bespoke 3D viewport — react-three-fiber Canvas, not a reuse of
 * framework/viewport's 2D pan/zoom camera. Two real camera modes:
 * "3d" (perspective + OrbitControls, isolates to the selected unit when
 * one's selected, otherwise fits the whole tower — the fallback/inspect
 * mode) and "plan" (real top-down orthographic camera + a real CAD
 * dimension overlay, built from Step 0's confirmed adjacency data).
 * Opening a Shop Drawing sheet in Browse defaults into plan mode
 * (SelectionContext's `preferredView` field); the toggle always lets a
 * user flip back manually. Click-to-select resolves the real object name
 * clicked and drives the same SelectionContext Browse/Inspector read
 * from — one identity scheme, not a parallel lookup table.
 */
export default function GeometryViewport() {
  const { selected } = useSelection();
  const [viewMode, setViewMode] = useState<ViewMode>("3d");
  const lastReactedId = useRef<string | undefined>(undefined);

  const selectedUnitPayload = selected?.feature === "manufacturing" && selected.payload.kind === "unit" ? selected.payload : undefined;

  useEffect(() => {
    const id = selected?.feature === "manufacturing" ? selected.objectId : undefined;
    if (id === lastReactedId.current) return;
    lastReactedId.current = id;

    if (selectedUnitPayload) {
      setViewMode(selectedUnitPayload.preferredView === "plan" ? "plan" : "3d");
    } else {
      setViewMode("3d");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  return (
    <PanelCard title="Geometry Viewport" className="h-[560px]" bodyClassName="flex flex-col flex-1">
      <div className="relative flex-1" style={{ background: "var(--ff-content-bg)" }}>
        <ViewModeToggle mode={viewMode} onChange={setViewMode} disabled={!selectedUnitPayload} />

        <Canvas>
          <ambientLight intensity={0.7} />
          <directionalLight position={[60, 90, 40]} intensity={1.4} />
          <directionalLight position={[-60, 40, -40]} intensity={0.4} />
          <Suspense fallback={null}>
            <SceneRoot viewMode={viewMode} />
          </Suspense>
          {viewMode === "3d" && <OrbitControls makeDefault enableDamping dampingFactor={0.08} />}
        </Canvas>
      </div>
    </PanelCard>
  );
}

useGLTF.preload(GARDEN_LOFTS_GLB_URL);
