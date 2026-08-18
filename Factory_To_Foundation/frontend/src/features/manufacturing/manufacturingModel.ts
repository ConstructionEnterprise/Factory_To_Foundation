import { useMemo, useSyncExternalStore } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { Object3D } from "three";

import { BACKEND_URL } from "@/lib/env";

/**
 * The one place that knows how to read whatever real geometry and real
 * metadata the currently-loaded model actually contains — agnostic to
 * source format or project. Walks the real exported node graph exactly
 * as authored: no hardcoded naming pattern, no assumption about
 * hierarchy depth, no assumption that a "building"/"unit"/"level"
 * concept exists at all. A flat file with ten objects and a
 * deeply-nested file with thousands both walk through this identical
 * code path.
 *
 * GeometryViewport, ManufacturingBrowse, and ManufacturingInspector all
 * call `useManufacturingTree()` (drei caches `useGLTF` by URL, so this
 * is one parse) so all three panels resolve the same real node identity
 * (`Object3D.name`) instead of maintaining a second lookup table.
 *
 * Reads through generic glTF `extras` (-> `userData` after three.js's
 * GLTFLoader parses them) only — nothing Blender-specific here, so a
 * future IFC-sourced glb populating the same `userData` shape works
 * unchanged. The one Blender-specific step (the actual .blend -> glTF
 * conversion) lives entirely in `blender-bridge/`, a sibling service
 * outside this repo — see pages/manufacturing/ManufacturingPage.tsx for the upload flow.
 */
/**
 * The committed local default — Manufacturing's original ingested model,
 * shipped with the app and always available even with the backend down.
 * No longer the *only* real model source: Phase 3's portability rewrite
 * moved blender-bridge's upload target to S3 (it used to overwrite this
 * exact file in place — see git history — which only worked because
 * blender-bridge and the Vite dev server happened to share a filesystem,
 * not true once blender-bridge runs as its own container).
 */
export const MANUFACTURING_MODEL_LOCAL_DEFAULT = "/models/manufacturing-model.glb";

/**
 * Real source of truth for "which model should be showing right now":
 * checks the backend's /manufacturing-model/download-url route, which
 * itself checks S3 for real existence before ever handing back a
 * presigned URL (see backend/src/routes/manufacturingModel.ts) — so a
 * fresh environment, or a page reload after the presigned URL from a
 * prior session has since expired, both correctly re-resolve to whatever
 * is really there right now instead of trusting stale in-memory state.
 * Falls back to the local default on a `null` url (nothing real uploaded
 * yet) or a network failure (backend unreachable) — never a fabricated
 * error state, matching Factory's own "Twin Offline" honesty convention.
 */
let modelUrl: string = MANUFACTURING_MODEL_LOCAL_DEFAULT;
const modelUrlListeners = new Set<() => void>();

function subscribeToModelUrl(listener: () => void) {
  modelUrlListeners.add(listener);
  return () => {
    modelUrlListeners.delete(listener);
  };
}

function getModelUrlSnapshot() {
  return modelUrl;
}

async function refreshModelUrl(): Promise<void> {
  try {
    const res = await fetch(`${BACKEND_URL}/manufacturing-model/download-url`);
    const body: { url: string | null } = await res.json();
    modelUrl = body.url ?? MANUFACTURING_MODEL_LOCAL_DEFAULT;
  } catch {
    modelUrl = MANUFACTURING_MODEL_LOCAL_DEFAULT;
  }
  modelUrlListeners.forEach((listener) => listener());
}

// Real check on module load — not assumed from whatever this session
// happens to remember, since a page reload starts with no memory of a
// prior upload at all.
void refreshModelUrl();

export function useManufacturingModelUrl(): string {
  return useSyncExternalStore(subscribeToModelUrl, getModelUrlSnapshot);
}

/** Called right after a real, verified-successful blender-bridge upload — re-checks S3 for the real new object instead of just assuming the upload that just succeeded is what a presigned URL will resolve to. */
export function bumpManufacturingModelVersion() {
  void refreshModelUrl();
}

export type GenericExtras = Record<string, string | number | boolean>;

export type ManufacturingNode = {
  /** The real object/collection name from the source file — the one identity shared with the 3D scene, Browse, and the Inspector. */
  id: string;
  name: string;
  /** Whatever real custom-property data this node's own source object/collection carries — never a search for expected field names. Empty when the source has none for this node; that's real too, not an error state. */
  extras: GenericExtras;
  /** True when the real Object3D backing this node is itself a mesh (has its own geometry) — false for a pure organizational node (a Collection, an empty parent transform) that only groups other nodes. Geometric fact, not a name/category guess — see `shouldFabricate()`. */
  hasGeometry: boolean;
  children: ManufacturingNode[];
};

export type ManufacturingTree = {
  /** Real top-level children of the loaded scene — however many there really are, whatever they're really called. */
  roots: ManufacturingNode[];
  /** Real node-id -> node lookup, for click-to-select and sheet lookups. */
  nodesById: Map<string, ManufacturingNode>;
};

// blender-bridge's convert_to_gltf.py stamps every real object/collection's
// own real name into this reserved key before export, because three.js's
// GLTFLoader sanitizes `Object3D.name` on load (spaces -> underscores, for
// animation-target-path safety) — confirmed live: "Walls — literal 2D
// trace" loaded as "Walls_—_literal_2D_trace". That would otherwise
// silently violate "a node's label is its real name, whatever that name
// is." This key is infrastructure this pipeline adds, not real source
// file content, so it's read out separately below and excluded from the
// generic extras shown to the user (displaying it as a metadata row
// would just duplicate the name already shown as the heading).
const SOURCE_NAME_KEY = "__source_name";

function cleanExtras(userData: Record<string, unknown>): GenericExtras {
  const out: GenericExtras = {};
  for (const [key, value] of Object.entries(userData)) {
    if (key === SOURCE_NAME_KEY) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    }
    // Non-primitive extras (nested objects/arrays) aren't shown here —
    // this feeds a flat generic key-value display, never a structural
    // guess about what a nested shape means.
  }
  return out;
}

function walk(obj: Object3D, nodesById: Map<string, ManufacturingNode>): ManufacturingNode {
  const userData = obj.userData as Record<string, unknown>;
  const realName = typeof userData[SOURCE_NAME_KEY] === "string" ? (userData[SOURCE_NAME_KEY] as string) : obj.name;
  const node: ManufacturingNode = {
    // `id` stays the three.js-sanitized name — the identity `scene.getObjectByName()`
    // and 3D click events resolve against — while `name` is the real, unsanitized one for display.
    id: obj.name,
    name: realName || "(unnamed)",
    extras: cleanExtras(userData),
    hasGeometry: (obj as THREE.Mesh).isMesh === true,
    children: obj.children.map((child) => walk(child, nodesById)),
  };
  nodesById.set(node.id, node);
  return node;
}

/**
 * A "shop drawing" is a drawing of one real fabricatable physical
 * element — not of an organizational grouping. True only for a node
 * that is itself a real mesh (has its own geometry), false for a pure
 * container node (a Collection, an empty parent transform) that only
 * groups other nodes, even if that group's own union bounding box is
 * perfectly measurable (see `measureNode`). Purely geometric — no name
 * or category read anywhere in this check, so it applies identically
 * regardless of source file or naming convention.
 */
export function shouldFabricate(node: ManufacturingNode): boolean {
  return node.hasGeometry;
}

export function useManufacturingTree(): ManufacturingTree {
  const { scene } = useGLTF(useManufacturingModelUrl());

  return useMemo(() => {
    const nodesById = new Map<string, ManufacturingNode>();
    const roots = scene.children.map((child) => walk(child, nodesById));
    return { roots, nodesById };
  }, [scene]);
}

/**
 * Real bounding-box size for any node, leaf or group — a group's box is
 * the union of its real children's geometry, so this needs no per-type
 * branching. Always derivable from the loaded geometry regardless of
 * source, unlike anything read from `extras`. Returns undefined only
 * when the node truly has no geometry anywhere in its subtree (an empty
 * organizational node with no mesh descendants).
 */
export function measureNode(scene: Object3D, id: string): THREE.Vector3 | undefined {
  const obj = scene.getObjectByName(id);
  if (!obj) return undefined;
  const box = new THREE.Box3().setFromObject(obj);
  if (box.isEmpty()) return undefined;
  return box.getSize(new THREE.Vector3());
}

export function metersLabel(m: number): string {
  const ft = m * 3.28084;
  return `${m.toFixed(2)} m (${ft.toFixed(1)}')`;
}

export type OverlappingFeature = {
  id: string;
  name: string;
  /** Real world-space center of the overlapping feature's own bounding box, meters. */
  position: { x: number; y: number; z: number };
};

/**
 * Real feature breakdown: other real leaf meshes anywhere in the loaded
 * model whose real world-space bounding box actually intersects the
 * target's — e.g. a door/window opening frame that isn't a child of the
 * wall it's cut into, but really does spatially overlap it. Pure Box3
 * intersection, no name-pattern matching, so it works identically on any
 * uploaded file: a featureless element (a plain roof panel) honestly
 * returns an empty list, not a fabricated one.
 *
 * Excludes the target itself, its own real descendants (a leaf mesh's own
 * sub-meshes would trivially "overlap" it), and its own real ancestors
 * (whose box trivially contains it) — everything else in the tree is a
 * real candidate. Sorted by real position along the target's own longest
 * axis for a stable, physically left-to-right order — a deterministic
 * real choice, not a fabricated ranking.
 */
export function findOverlappingFeatures(
  scene: Object3D,
  nodesById: Map<string, ManufacturingNode>,
  targetId: string
): OverlappingFeature[] {
  const targetObj = scene.getObjectByName(targetId);
  if (!targetObj) return [];
  const targetBox = new THREE.Box3().setFromObject(targetObj);
  if (targetBox.isEmpty()) return [];

  const size = targetBox.getSize(new THREE.Vector3());
  const axis: "x" | "y" | "z" = size.x >= size.y && size.x >= size.z ? "x" : size.y >= size.z ? "y" : "z";

  const excluded = new Set<string>();
  targetObj.traverse((o) => {
    if (o.name) excluded.add(o.name);
  });
  for (let p = targetObj.parent; p; p = p.parent) {
    if (p.name) excluded.add(p.name);
  }

  const matches: OverlappingFeature[] = [];
  for (const node of nodesById.values()) {
    if (!node.hasGeometry || excluded.has(node.id)) continue;
    const obj = scene.getObjectByName(node.id);
    if (!obj) continue;
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty() || !box.intersectsBox(targetBox)) continue;
    const center = box.getCenter(new THREE.Vector3());
    matches.push({ id: node.id, name: node.name, position: { x: center.x, y: center.y, z: center.z } });
  }

  matches.sort((a, b) => a.position[axis] - b.position[axis]);
  return matches;
}

/**
 * Packages one fabricatable element's real shop-drawing data (the exact
 * values its sheet displays: measured bounding box, thinnest-axis
 * orientation, verbatim extras, real spatially-overlapping features) for
 * instruction generation — see ElementSpec in ManufacturingOutputContext.
 * Generic by construction: live-geometry measurements + verbatim
 * pass-through only, no name or key-pattern reads, so every uploaded file
 * takes this identical path.
 */
export function buildElementSpec(
  scene: Object3D,
  node: ManufacturingNode,
  nodesById: Map<string, ManufacturingNode>
): import("@/context/ManufacturingOutputContext").ElementSpec {
  const size = measureNode(scene, node.id);
  const obj = scene.getObjectByName(node.id);
  let orientationKind: "plan" | "elevation" | undefined;
  if (obj) {
    const box = new THREE.Box3().setFromObject(obj);
    if (!box.isEmpty()) orientationKind = orientationForNode(box).kind;
  }
  return {
    name: node.name,
    dims: size ? { x: size.x, y: size.y, z: size.z } : undefined,
    orientationKind,
    extras: node.extras,
    overlappingFeatures: findOverlappingFeatures(scene, nodesById, node.id),
  };
}

export type CameraOrientation = {
  kind: "plan" | "elevation";
  /** Real unit vector the camera sits along, offset outward from the target's center — the camera looks back toward center along the reverse of this vector. */
  direction: THREE.Vector3;
  /** Real world-space up vector for the camera in this orientation. */
  up: THREE.Vector3;
};

/**
 * Orient a shop-drawing camera along a node's own thinnest real
 * bounding-box axis — one geometric rule, no category or name read
 * anywhere. A vertically-thin box (floor/ceiling/joist/roof-shaped)
 * produces a plan-style view (camera above, looking straight down); a
 * horizontally-thin box (wall-shaped, thin along X or Z) produces an
 * elevation-style view (camera to the side, looking straight at the
 * thin face). This is the same rule for every node, regardless of
 * source file — it produces the standard elevation-for-walls/plan-for-
 * horizontal-elements convention automatically, from real measured
 * geometry, never from reading a name or category.
 *
 * Verified against real measured geometry in both fixtures before this
 * was written (not assumed): real wall objects in Garden Lofts and
 * Modern Heritage all had their thinnest real axis horizontal (X in
 * some cases, Z in others — both confirmed); real floor/ceiling/joist/
 * roof objects (including a real 4/12-pitched roof rafter system) all
 * had their thinnest real axis vertical. Zero exceptions found across
 * 6 real sampled objects.
 *
 * Known limitation, deliberately not handled: an element modeled at an
 * angle not aligned to world X/Y/Z (not axis-aligned to its own natural
 * faces) still produces *a* real view — three real axis lengths always
 * exist, so this never errors or crashes on it — but that view may not
 * land on a genuinely useful elevation or plan the way it would for a
 * normally axis-aligned element. No fallback/correction logic for this
 * today; not detected, not attempted.
 */
export function orientationForNode(box: THREE.Box3): CameraOrientation {
  const size = box.getSize(new THREE.Vector3());
  const dims: { axis: "x" | "y" | "z"; value: number }[] = [
    { axis: "x", value: size.x },
    { axis: "y", value: size.y },
    { axis: "z", value: size.z },
  ];
  const thinnest = dims.reduce((a, b) => (b.value < a.value ? b : a));

  if (thinnest.axis === "y") {
    return { kind: "plan", direction: new THREE.Vector3(0, 1, 0), up: new THREE.Vector3(0, 0, -1) };
  }

  const direction = thinnest.axis === "x" ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
  return { kind: "elevation", direction, up: new THREE.Vector3(0, 1, 0) };
}

useGLTF.preload(MANUFACTURING_MODEL_LOCAL_DEFAULT);
