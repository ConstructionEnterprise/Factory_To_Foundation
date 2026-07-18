import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import type { Object3D } from "three";

/**
 * The one place that knows how to read the ingested Garden Lofts asset.
 * GeometryViewport, ManufacturingBrowse, and ManufacturingInspector all
 * call `useGardenLoftsTree()` (drei caches `useGLTF` by URL, so this is
 * one parse, not three) so all three panels resolve the same object
 * identity — `Object3D.name`, the real name baked into the source
 * geometry — instead of maintaining a second lookup table that could
 * drift from what's actually in the file.
 *
 * Deliberately reads through generic glTF `extras` (-> `userData` after
 * three.js's GLTFLoader parses them), not anything Blender-specific —
 * an IFC-sourced glb that populated the same `userData` shape would work
 * here unchanged.
 */
export const GARDEN_LOFTS_GLB_URL = "/models/garden-lofts-exterior.glb";

export type UnitTypeCode = "STUDIO" | "1BR" | "2BR" | "3BR";

const UNIT_TYPE_LABELS: Record<UnitTypeCode, string> = {
  STUDIO: "Studio",
  "1BR": "1 Bedroom",
  "2BR": "2 Bedroom",
  "3BR": "3 Bedroom",
};

// Confirmed per-subtype square footage table (Sheet 1). Independent of
// the building-level UNIT_PROGRAM averages carried in PROJECT_SPEC —
// that's an aggregate program number, this is the specific subtype.
const SUBTYPE_SQFT: Record<string, number> = {
  S1: 410,
  S2: 420,
  A1: 640,
  A2: 650,
  B1: 1020,
  B2: 1050,
  C1: 1550,
};

export type ProjectSpec = {
  project_name: string;
  location: string;
  construction_type: string;
  structural_system: string;
  stories: number;
  buildings: number;
  building_envelope: {
    length_m: number;
    depth_m: number;
    structural_height_m: number;
    architectural_height_m: number;
  };
  gross_floor_area_m2: number;
  footprint_m2: number;
  typical_floor_plate_m2: number;
  units_total: number;
  unit_mix: Record<string, { count: number; avg_size_sf: number; pct: string }>;
  module_grid: {
    system: string;
    bay_x_m: number;
    bay_y_m: number;
    insertion_axis: string;
    stack_direction: string;
    reference_level: string;
    note: string;
  };
  parking: string;
  sustainable_features: string;
  source: string;
  known_data_issue: string;
};

export type LevelTierLabels = Record<string, string>;

export type PlanBoundingElement = {
  /** Real adjacent wall/partition object name — from investigate-adjacency Step 0's confirmed method, never fabricated. */
  id: string;
  side: "west" | "east";
  /** Real gap distance (meters) between the unit's edge and this wall's face — 0 when touching. */
  distance_m: number;
};

/**
 * Real, computed per-unit plan geometry — baked as a Blender custom
 * property (see FF_Frontend_OS_Handoff §6.8) and carried through the
 * glTF export the same way PROJECT_SPEC is. East/West party walls
 * resolve cleanly via real adjacency (gap <=0.05m, overlap >=85% of
 * depth); confirmed in Step 0 that no North/South wall object exists
 * for any tested unit at all — `overallDepth_m` (the unit's own real
 * Y-extent) is that dimension, not a second wall reference. Units
 * where nothing resolved within tolerance (real corner-unit ambiguity,
 * not a bug) list the side(s) in `unresolvedSides` rather than getting
 * a forced/fabricated `boundingElements` entry.
 */
export type PlanDimensions = {
  /** Real 2D world XY footprint corners (closed rectangle), from the unit's own bounding box. */
  outline: [number, number][];
  overallWidth_m: number;
  overallDepth_m: number;
  boundingElements: PlanBoundingElement[];
  unresolvedSides: string[];
};

export type ManufacturingUnit = {
  /** The real object name — the one identity shared with the 3D scene and Browse. */
  objectName: string;
  level: number;
  typeCode: UnitTypeCode;
  typeLabel: string;
  subtypeCode: string;
  orientation?: string;
  squareFootage?: number;
  /** Set when this unit's geometry contradicts the confirmed Sheet 1 unit-distribution rule. */
  flag?: string;
  /** Absent only if baking somehow didn't reach this object — never partially fabricated. */
  planDimensions?: PlanDimensions;
};

export type ManufacturingLevel = {
  level: number;
  title: string;
  tierLabel: string;
  units: ManufacturingUnit[];
};

export type ManufacturingTree = {
  projectSpec: ProjectSpec | undefined;
  levelTierLabels: LevelTierLabels;
  levels: ManufacturingLevel[];
  /** Real object-name -> unit lookup, for click-to-select in the 3D scene. */
  unitsByObjectName: Map<string, ManufacturingUnit>;
};

const UNIT_NAME_RE = /^GL_L(\d+)_(STUDIO|1BR|2BR|3BR)_([A-Z0-9]+)(?:_([A-Z]+))?$/;

function parseUnit(obj: Object3D): ManufacturingUnit | undefined {
  const extras = obj.userData as Record<string, unknown>;
  const nameMatch = UNIT_NAME_RE.exec(obj.name);
  if (!nameMatch && typeof extras.unit_type !== "string") return undefined;

  const level = typeof extras.level === "number" ? extras.level : nameMatch ? Number(nameMatch[1]) : undefined;
  const typeCode = (typeof extras.unit_type === "string" ? extras.unit_type : nameMatch?.[2]) as
    | UnitTypeCode
    | undefined;
  if (level === undefined || !typeCode || !(typeCode in UNIT_TYPE_LABELS)) return undefined;

  const unitLabel = typeof extras.unit_label === "string" ? extras.unit_label : undefined;
  const labelParts = (unitLabel ?? nameMatch?.slice(2).filter(Boolean).join("_") ?? "").split("_");
  const subtypeCode = labelParts[1] ?? nameMatch?.[3] ?? "";
  const orientation = labelParts[2] ?? nameMatch?.[4];

  const flag =
    typeCode === "3BR" && level >= 14
      ? "Contradicts confirmed unit distribution (Sheet 1): Levels 14–20 should have 0 corner 3BR units."
      : undefined;

  const planDimensions = extras.PLAN_DIMENSIONS as PlanDimensions | undefined;

  return {
    objectName: obj.name,
    level,
    typeCode,
    typeLabel: UNIT_TYPE_LABELS[typeCode],
    subtypeCode,
    orientation,
    squareFootage: SUBTYPE_SQFT[subtypeCode],
    flag,
    planDimensions,
  };
}

export function useGardenLoftsTree(): ManufacturingTree {
  const { scene } = useGLTF(GARDEN_LOFTS_GLB_URL);

  return useMemo(() => {
    const projectSpec = scene.userData.PROJECT_SPEC as ProjectSpec | undefined;
    const levelTierLabels = (scene.userData.LEVEL_TIER_LABELS as LevelTierLabels | undefined) ?? {};

    const levelMap = new Map<number, ManufacturingUnit[]>();
    const unitsByObjectName = new Map<string, ManufacturingUnit>();

    scene.traverse((obj) => {
      const unit = parseUnit(obj);
      if (!unit) return;
      unitsByObjectName.set(unit.objectName, unit);
      const bucket = levelMap.get(unit.level) ?? [];
      bucket.push(unit);
      levelMap.set(unit.level, bucket);
    });

    const levels: ManufacturingLevel[] = Array.from(levelMap.keys())
      .sort((a, b) => a - b)
      .map((level) => ({
        level,
        title: `Level ${level}`,
        tierLabel: levelTierLabels[String(level)] ?? "Residential",
        units: levelMap.get(level)!.sort((a, b) => a.objectName.localeCompare(b.objectName)),
      }));

    return { projectSpec, levelTierLabels, levels, unitsByObjectName };
  }, [scene]);
}

useGLTF.preload(GARDEN_LOFTS_GLB_URL);
