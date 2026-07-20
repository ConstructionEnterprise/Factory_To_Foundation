import { useMemo, useSyncExternalStore } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { Object3D } from "three";

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
 * outside this repo — see ManufacturingToolbar for the upload flow.
 */
export const MANUFACTURING_MODEL_URL = "/models/manufacturing-model.glb";

/**
 * Replace semantics: a successful upload overwrites the file at
 * MANUFACTURING_MODEL_URL in place (see ManufacturingToolbar/blender-bridge),
 * but `useGLTF` caches by URL string, so the three panels reading the old
 * URL would otherwise keep serving their already-parsed scene forever.
 * `bumpManufacturingModelVersion()` appends a cache-busting query string
 * and notifies every subscriber via `useSyncExternalStore`, so a fresh
 * upload actually reaches the viewport/Browse/Inspector without a full
 * page reload.
 */
let modelVersion = 0;
const modelVersionListeners = new Set<() => void>();

function subscribeToModelVersion(listener: () => void) {
  modelVersionListeners.add(listener);
  return () => {
    modelVersionListeners.delete(listener);
  };
}

function getModelVersionSnapshot() {
  return modelVersion;
}

export function useManufacturingModelUrl(): string {
  const version = useSyncExternalStore(subscribeToModelVersion, getModelVersionSnapshot);
  return version === 0 ? MANUFACTURING_MODEL_URL : `${MANUFACTURING_MODEL_URL}?v=${version}`;
}

export function bumpManufacturingModelVersion() {
  modelVersion += 1;
  modelVersionListeners.forEach((listener) => listener());
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

useGLTF.preload(MANUFACTURING_MODEL_URL);
