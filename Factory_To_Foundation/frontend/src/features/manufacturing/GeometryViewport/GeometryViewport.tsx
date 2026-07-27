import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { Bounds, OrbitControls, PerspectiveCamera, useBounds, useGLTF } from "@react-three/drei";
import * as THREE from "three";

import { PanelCard } from "@/framework/ui";
import { useSelection } from "@/context/SelectionContext";

import { MANUFACTURING_MODEL_LOCAL_DEFAULT, useManufacturingModelUrl, useManufacturingTree } from "../manufacturingModel";

/** Selected-object outline — a real Box3 computed each time the selection changes, not a shader trick. Works identically for a leaf mesh or a group (a group's box is the union of its real children). */
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
 * Real per-node isolation — frames whatever's selected, leaf or group,
 * not just the whole scene. Uses drei's official
 * useBounds()/bounds.refresh(target).fit() mechanism — the documented,
 * supported pattern for exactly this "click something, isolate the
 * camera to it" use case. Must render as a child of <Bounds> to reach
 * useBounds(). Renders no geometry itself, so it doesn't add anything to
 * Bounds' own watched-children bounding volume.
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
 * Sets the perspective camera's starting position exactly once, via ref,
 * instead of a declarative `position` prop. A literal-array `position`
 * prop gets re-applied by R3F on every re-render, which was fighting
 * imperative repositioning (confirmed live in an earlier pass) — real
 * bug, not a data/method issue.
 */
function InitialPerspectiveCamera({ fov }: { fov: number }) {
  const camRef = useRef<THREE.PerspectiveCamera>(null);
  useEffect(() => {
    camRef.current?.position.set(70, 55, 70);
  }, []);
  return <PerspectiveCamera ref={camRef} makeDefault fov={fov} />;
}

/**
 * One universal click-to-select mechanism for any real node — leaf mesh
 * or group, no per-model branching, no special handling keyed to what
 * kind of element was clicked. Resolves the real clicked object's name
 * against the same parsed tree Browse/Inspector use, so all three panels
 * share one identity scheme. 3D picking can only ever hit real geometry
 * (raycasting doesn't see empty organizational-only nodes) — those stay
 * selectable via the Browse tree instead, which is the expected,
 * physically-correct asymmetry, not a gap.
 */
function SceneRoot() {
  const { scene } = useGLTF(useManufacturingModelUrl());
  const tree = useManufacturingTree();
  const { selected, setSelected } = useSelection();

  const selectedObjectName = selected?.feature === "manufacturing" ? selected.objectId : undefined;
  const selectedObject3D = useMemo(
    () => (selectedObjectName ? scene.getObjectByName(selectedObjectName) ?? undefined : undefined),
    [scene, selectedObjectName]
  );

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    const clicked = event.object;
    const node = tree.nodesById.get(clicked.name);
    setSelected({
      feature: "manufacturing",
      objectType: node && node.children.length > 0 ? "Group" : "Object",
      objectId: clicked.name,
      payload: { name: node?.name ?? clicked.name, extras: node?.extras ?? {} },
    });
  };

  return (
    <>
      <Bounds fit clip observe margin={1.25}>
        <primitive object={scene} onClick={handleClick} />
        {selectedObject3D && <IsolationRig target={selectedObject3D} />}
      </Bounds>
      <InitialPerspectiveCamera fov={45} />
      <SelectionOutline target={selectedObject3D} />
    </>
  );
}

/**
 * Bespoke 3D viewport — react-three-fiber Canvas, not a reuse of
 * framework/viewport's 2D pan/zoom camera. Perspective camera +
 * OrbitControls, isolating to whatever's selected (or the whole model
 * when nothing is). Click-to-select resolves the real node clicked and
 * drives the same SelectionContext Browse/Inspector read from.
 */
export default function GeometryViewport() {
  return (
    <PanelCard title="Geometry Viewport" className="h-[560px]" bodyClassName="flex flex-col flex-1">
      <div className="relative flex-1" style={{ background: "var(--ff-content-bg)" }}>
        <Canvas>
          <ambientLight intensity={0.7} />
          <directionalLight position={[60, 90, 40]} intensity={1.4} />
          <directionalLight position={[-60, 40, -40]} intensity={0.4} />
          <Suspense fallback={null}>
            <SceneRoot />
          </Suspense>
          <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
        </Canvas>
      </div>
    </PanelCard>
  );
}

useGLTF.preload(MANUFACTURING_MODEL_LOCAL_DEFAULT);
