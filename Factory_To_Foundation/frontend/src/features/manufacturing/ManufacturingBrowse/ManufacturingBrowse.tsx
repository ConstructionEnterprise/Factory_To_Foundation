import { Suspense, useEffect, useMemo, useState } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

import { useSelection } from "@/context/SelectionContext";
import { useManufacturingOutput } from "@/context/ManufacturingOutputContext";
import { useTwinManifest } from "@/features/factory/useTwinManifest";
import { BrowseList, PanelCard, type BrowseListItem } from "@/framework/ui";

import { generateInstructionSet } from "../instructionGeneration";
import {
  buildElementSpec,
  findOverlappingFeatures,
  measureNode,
  metersLabel,
  orientationForNode,
  shouldFabricate,
  useManufacturingModelUrl,
  useManufacturingTree,
  type CameraOrientation,
  type ManufacturingNode,
  type ManufacturingTree,
} from "../manufacturingModel";

/**
 * Mirrors the tree's own real shape exactly — a node's row title is its
 * real name, whatever that name is; a node's children become the row's
 * children, however many levels deep that really goes. No assumption a
 * "building"/"level"/"unit" concept exists.
 */
function toBrowseItems(nodes: ManufacturingNode[]): BrowseListItem[] {
  return nodes.map((node) => ({
    id: node.id,
    title: node.name,
    children: node.children.length > 0 ? toBrowseItems(node.children) : undefined,
  }));
}

function ObjectsTree() {
  const { selected, setSelected } = useSelection();
  const tree = useManufacturingTree();
  const activeId = selected?.feature === "manufacturing" ? selected.objectId : undefined;

  return (
    <BrowseList
      items={toBrowseItems(tree.roots)}
      activeId={activeId}
      onSelect={(id) => {
        const node = tree.nodesById.get(id);
        if (!node) return;
        setSelected({
          feature: "manufacturing",
          objectType: node.children.length > 0 ? "Group" : "Object",
          objectId: node.id,
          payload: { name: node.name, extras: node.extras },
        });
      }}
    />
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-xs" style={{ borderBottom: "1px solid var(--ff-content-bg)" }}>
      <dt style={{ color: "var(--ff-text-muted)" }}>{label}</dt>
      <dd className="text-right font-medium" style={{ color: "var(--ff-text-primary)" }}>{value}</dd>
    </div>
  );
}

function humanizeKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type ProjectedEdges = {
  /** Real projected 2D line segments — one pair of endpoints per real mesh triangle edge, in the plane's own real units (meters). */
  segments: [number, number, number, number][];
  bounds: { minU: number; maxU: number; minV: number; maxV: number };
};

/**
 * Real orthographic projection computed directly from the target's own
 * live mesh vertex data — re-measured/re-derived fresh each call (never
 * baked/precomputed coordinates), the same principle the removed Garden
 * Lofts plan-view work proved out. No WebGL/camera involved: every real
 * triangle edge in the target's subtree is transformed by its real
 * world matrix, then projected onto whichever two axes aren't the
 * orientation's dominant view axis (see `orientationForNode`) — a
 * genuine 2D projection of the real 3D geometry, drawn as SVG lines, the
 * conventional "shop drawing" line-drawing form rather than a shaded
 * render.
 */
function computeProjectedEdges(target: THREE.Object3D, orientation: CameraOrientation): ProjectedEdges {
  const uAxis: "x" | "y" | "z" = Math.abs(orientation.direction.y) > 0.5 ? "x" : Math.abs(orientation.direction.x) > 0.5 ? "z" : "x";
  const vAxis: "x" | "y" | "z" = Math.abs(orientation.direction.y) > 0.5 ? "z" : Math.abs(orientation.direction.x) > 0.5 ? "y" : "y";

  const segments: [number, number, number, number][] = [];
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;

  target.updateWorldMatrix(true, false);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();

  function project(v: THREE.Vector3): [number, number] {
    const u = v[uAxis];
    const vv = v[vAxis];
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (vv < minV) minV = vv;
    if (vv > maxV) maxV = vv;
    return [u, vv];
  }

  target.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const geom = obj.geometry;
    const pos = geom.attributes.position;
    if (!pos) return;
    const index = geom.index;
    const triCount = index ? index.count / 3 : pos.count / 3;
    for (let i = 0; i < triCount; i++) {
      const i0 = index ? index.getX(i * 3) : i * 3;
      const i1 = index ? index.getX(i * 3 + 1) : i * 3 + 1;
      const i2 = index ? index.getX(i * 3 + 2) : i * 3 + 2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(obj.matrixWorld);
      b.fromBufferAttribute(pos, i1).applyMatrix4(obj.matrixWorld);
      c.fromBufferAttribute(pos, i2).applyMatrix4(obj.matrixWorld);
      const [au, av] = project(a);
      const [bu, bv] = project(b);
      const [cu, cv] = project(c);
      segments.push([au, av, bu, bv], [bu, bv, cu, cv], [cu, cv, au, av]);
    }
  });

  return { segments, bounds: { minU, maxU, minV, maxV } };
}

/**
 * Real orthographic projection of a node's own live mesh, auto-oriented
 * (plan vs. elevation) purely from its real measured geometry — see
 * `orientationForNode`. Deliberately no dimension lines to neighboring
 * elements ("7.5m to the next wall") — that requires a real geometric-
 * adjacency investigation per project (what the removed Garden Lofts
 * `PLAN_DIMENSIONS` did), out of scope here, not faked.
 */
function ShopDrawingProjection({ objectName }: { objectName: string }) {
  const { scene } = useGLTF(useManufacturingModelUrl());
  const target = scene.getObjectByName(objectName);

  const projected = useMemo(() => {
    if (!target) return undefined;
    const orientation = orientationForNode(new THREE.Box3().setFromObject(target));
    return { ...computeProjectedEdges(target, orientation), orientation };
  }, [target]);

  if (!target || !projected || projected.segments.length === 0) return null;

  const { segments, bounds, orientation } = projected;
  const width = Math.max(bounds.maxU - bounds.minU, 0.01);
  const height = Math.max(bounds.maxV - bounds.minV, 0.01);
  const margin = Math.max(width, height) * 0.1;
  const viewMinU = bounds.minU - margin;
  const viewMaxV = bounds.maxV + margin;
  const viewW = width + margin * 2;
  const viewH = height + margin * 2;
  const strokeWidth = Math.max(viewW, viewH) / 400;

  return (
    <div
      className="mb-3 h-56 w-full relative"
      style={{ background: "var(--ff-content-bg)", border: "1px solid var(--ff-panel-border)", borderRadius: "var(--ff-radius)" }}
    >
      <span
        className="absolute right-2 top-2 rounded-[0.15rem] px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide"
        style={{ background: "var(--ff-panel-bg)", border: "1px solid var(--ff-panel-border)", color: "var(--ff-text-muted)" }}
      >
        {orientation.kind === "plan" ? "Plan" : "Elevation"}
      </span>
      {/* SVG y grows downward; real V (world Y or Z) reads "up" — negating V here is the one correction, not a fabricated value. */}
      <svg viewBox={`${viewMinU} ${-viewMaxV} ${viewW} ${viewH}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        {segments.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={-y1} x2={x2} y2={-y2} stroke="var(--ff-text-primary)" strokeWidth={strokeWidth} />
        ))}
      </svg>
    </div>
  );
}

/**
 * One sheet per real fabricatable element — gated by `shouldFabricate()`
 * (a real leaf mesh, not a pure organizational group; see
 * manufacturingModel.ts), not "one per unit" or "one per module". Real
 * projection + real bounding-box dimensions always shown; real extras
 * shown generically, whatever keys this specific node happens to carry;
 * absence of extras is an honest, expected state, not an error.
 */
function ElementSheet({
  node,
  nodesById,
  onBack,
}: {
  node: ManufacturingNode;
  nodesById: Map<string, ManufacturingNode>;
  onBack: () => void;
}) {
  const { scene } = useGLTF(useManufacturingModelUrl());
  const { connected: manifestConnected, manifest } = useTwinManifest();
  const { setInstructionSet } = useManufacturingOutput();
  const [genStatus, setGenStatus] = useState<string | null>(null);
  const size = measureNode(scene, node.id);
  const extraEntries = Object.entries(node.extras);
  const overlappingFeatures = useMemo(
    () => findOverlappingFeatures(scene, nodesById, node.id),
    [scene, nodesById, node.id]
  );

  // Viewing a shop drawing IS the trigger: this element's real sheet data
  // feeds the same generator (and the same manifest-grounded targets) the
  // toolbar's "Generate Shop Drawings & Instructions" button uses — for
  // any uploaded file, no per-file branching anywhere in the path.
  useEffect(() => {
    if (!manifestConnected || !manifest || manifest.length === 0) {
      setGenStatus("Twin manifest not reachable — no instruction draft generated for this element.");
      return;
    }
    const result = generateInstructionSet(
      { sourceObjectId: node.id, elementSpec: buildElementSpec(scene, node, nodesById) },
      manifest
    );
    if (!result.ok) {
      setGenStatus(result.reason);
      return;
    }
    setInstructionSet(result.instructionSet);
    setGenStatus(
      `Instruction draft generated from this sheet's real data (${result.instructionSet.steps.length} steps) — view it in Reports or Factory's Instructions menu.`
    );
    // Regenerate only when the element (or manifest availability) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id, manifestConnected]);

  return (
    <div className="p-4 text-sm">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 text-xs font-medium"
        style={{ color: "var(--ff-accent)" }}
      >
        ← Back to sheets
      </button>

      <h3 className="text-base font-bold" style={{ color: "var(--ff-text-primary)" }}>
        {node.name}
      </h3>
      <p className="mt-0.5 text-xs" style={{ color: "var(--ff-text-muted)" }}>
        Structured spec sheet — real data only, not a rendered dimensioned CAD drawing.
      </p>
      {genStatus && (
        <p className="mt-1 text-xs font-medium" style={{ color: "var(--ff-accent)" }}>
          {genStatus}
        </p>
      )}

      {node.hasGeometry && <ShopDrawingProjection objectName={node.id} />}

      <dl className="mt-3 space-y-1.5">
        <Row label="Object Name" value={node.name} />
        {size ? (
          <>
            <Row label="Width (X)" value={metersLabel(size.x)} />
            <Row label="Height (Y)" value={metersLabel(size.y)} />
            <Row label="Depth (Z)" value={metersLabel(size.z)} />
          </>
        ) : (
          <Row label="Bounding Box" value="No geometry on this node — not confirmed" />
        )}
        {extraEntries.length > 0 ? (
          extraEntries.map(([key, value]) => <Row key={key} label={humanizeKey(key)} value={String(value)} />)
        ) : (
          <Row label="Metadata" value="None in the source file for this element — not confirmed" />
        )}
      </dl>

      <div className="mt-4">
        <h4 className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--ff-text-muted)" }}>
          Real Overlapping Features
        </h4>
        <p className="mt-0.5 text-[0.7rem]" style={{ color: "var(--ff-text-muted)" }}>
          Other real meshes elsewhere in the model whose bounding box actually intersects this element's — drives
          the per-feature framing steps below, not a fabricated count.
        </p>
        {overlappingFeatures.length > 0 ? (
          <ul className="mt-1.5 space-y-1">
            {overlappingFeatures.map((f) => (
              <li key={f.id} className="text-xs" style={{ color: "var(--ff-text-primary)" }}>
                <span className="font-medium">{f.name}</span>{" "}
                <span style={{ color: "var(--ff-text-muted)" }}>
                  ({f.position.x.toFixed(2)}, {f.position.y.toFixed(2)}, {f.position.z.toFixed(2)}) m
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs" style={{ color: "var(--ff-text-primary)" }}>
            None — no other real geometry overlaps this element's footprint.
          </p>
        )}
      </div>
    </div>
  );
}

function ShopDrawingsTree({ tree }: { tree: ManufacturingTree }) {
  const { setSelected } = useSelection();
  const [openSheetId, setOpenSheetId] = useState<string | null>(null);

  if (openSheetId) {
    const node = tree.nodesById.get(openSheetId);
    if (node) {
      return <ElementSheet node={node} nodesById={tree.nodesById} onBack={() => setOpenSheetId(null)} />;
    }
  }

  return (
    <BrowseList
      items={toBrowseItems(tree.roots)}
      onSelect={(id) => {
        const node = tree.nodesById.get(id);
        // Pure organizational nodes (no real geometry of their own) stay
        // navigational — BrowseList already toggles their expand/collapse
        // regardless of this handler; only a real fabricatable element
        // opens a sheet.
        if (!node || !shouldFabricate(node)) return;
        setOpenSheetId(id);

        // Also drives the real global selection (Inspector + GeometryViewport
        // both react) — one identity scheme, not two parallel mechanisms.
        setSelected({
          feature: "manufacturing",
          objectType: "Object",
          objectId: node.id,
          payload: { name: node.name, extras: node.extras },
        });
      }}
    />
  );
}

function ShopDrawingsTreeLoaded() {
  const tree = useManufacturingTree();
  return <ShopDrawingsTree tree={tree} />;
}

/**
 * Real tree, exactly as the currently-loaded model's own hierarchy is
 * authored — no fabricated grouping level, no naming-pattern assumption.
 * A deeply flat file (hundreds of same-level siblings) and a shallow one
 * both render through this identical path; see manufacturingModel.ts.
 *
 * A second mode, "Shop Drawings" (toggled via the PanelCard header), shows
 * the same real tree but clicking opens one structured spec-sheet per
 * node — self-contained master/detail local to this panel, also driving
 * the real global SelectionContext so the viewport/Inspector stay in sync.
 */
export default function ManufacturingBrowse() {
  const [mode, setMode] = useState<"objects" | "drawings">("objects");

  const toggle = (
    <div className="flex gap-1">
      {(["objects", "drawings"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => setMode(m)}
          className="rounded-[0.2rem] px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wide"
          style={{
            background: mode === m ? "var(--ff-accent)" : "transparent",
            color: mode === m ? "white" : "var(--ff-text-muted)",
          }}
        >
          {m === "objects" ? "Objects" : "Shop Drawings"}
        </button>
      ))}
    </div>
  );

  return (
    <PanelCard title="Browse Models" toolbar={toggle} className="h-full">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-sm text-gray-400">Loading geometry…</div>
        }
      >
        {mode === "objects" ? <ObjectsTree /> : <ShopDrawingsTreeLoaded />}
      </Suspense>
    </PanelCard>
  );
}
