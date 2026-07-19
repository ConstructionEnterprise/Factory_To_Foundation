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
    children: obj.children.map((child) => walk(child, nodesById)),
  };
  nodesById.set(node.id, node);
  return node;
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

useGLTF.preload(MANUFACTURING_MODEL_URL);
