import { Suspense, useMemo, useState } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

import { useSelection } from "@/context/SelectionContext";
import type { ManufacturingPayload } from "@/context/SelectionContext";
import { BrowseList, PanelCard, type BrowseListItem } from "@/framework/ui";

import {
  GARDEN_LOFTS_GLB_URL,
  useGardenLoftsTree,
  type ManufacturingLevel,
  type ManufacturingUnit,
  type ProjectSpec,
} from "../gardenLoftsModel";

const BUILDING_ID = "GardenLofts_Tower";
const M_TO_FT = 3.28084;

function unitTitle(unit: ManufacturingUnit): string {
  const base = `${unit.typeLabel} — ${unit.subtypeCode}`;
  return unit.orientation ? `${base} (${unit.orientation})` : base;
}

function feet(m: number): string {
  return `${(m * M_TO_FT).toFixed(1)}'`;
}

/** Real balcony-band depth, measured live from the matching source geometry object's bounding box — not a looked-up spec number, since none exists for this in the source data. Depth = the shorter horizontal footprint dimension (a balcony band is long along the facade, shallow in projection). Searches the full subtree (getObjectByName), not just root children — GL_BalconyBand_* objects are parented under GardenLofts_Tower, not siblings of it. */
function measureBalconyDepthM(scene: THREE.Object3D, level: number): number | undefined {
  const padded = String(level).padStart(2, "0");
  let match: THREE.Object3D | undefined;
  scene.traverse((obj) => {
    if (!match && obj.name.startsWith(`GL_BalconyBand_${padded}_`)) match = obj;
  });
  if (!match) return undefined;
  const box = new THREE.Box3().setFromObject(match);
  if (box.isEmpty()) return undefined;
  const size = box.getSize(new THREE.Vector3());
  return Math.min(size.x, size.z);
}

function ObjectsTree() {
  const { selected, setSelected } = useSelection();
  const { projectSpec, levels, unitsByObjectName } = useGardenLoftsTree();
  const activeId = selected?.feature === "manufacturing" ? selected.objectId : undefined;

  function toBrowseItems(levels: ManufacturingLevel[]): BrowseListItem[] {
    return [
      {
        id: BUILDING_ID,
        title: "Garden Lofts",
        children: levels.map((level) => ({
          id: `level-${level.level}`,
          title: `${level.title}${level.tierLabel.includes("Sky Garden") ? " 🌿" : ""}`,
          children: level.units.map((unit) => ({
            id: unit.objectName,
            title: unit.flag ? `${unitTitle(unit)} ⚠` : unitTitle(unit),
          })),
        })),
      },
    ];
  }

  return (
    <BrowseList
      items={toBrowseItems(levels)}
      activeId={activeId}
      onSelect={(id) => {
        if (id === BUILDING_ID) {
          setSelected({
            feature: "manufacturing",
            objectType: "Building",
            objectId: BUILDING_ID,
            payload: { kind: "building", name: "Garden Lofts", projectSpec },
          });
          return;
        }

        if (id.startsWith("level-")) {
          // Level rows are navigational (expand/collapse) — real per-level
          // tier data exists but doesn't need its own inspector view distinct
          // from the building/unit split the task asked for.
          return;
        }

        const unit = unitsByObjectName.get(id);
        if (!unit) return;
        const payload: ManufacturingPayload = {
          kind: "unit",
          name: unitTitle(unit),
          objectName: unit.objectName,
          level: unit.level,
          typeLabel: unit.typeLabel,
          subtypeCode: unit.subtypeCode,
          squareFootage: unit.squareFootage,
          flag: unit.flag,
        };
        setSelected({
          feature: "manufacturing",
          objectType: "Unit",
          objectId: unit.objectName,
          payload,
        });
      }}
    />
  );
}

function ShopDrawingSheet({
  unit,
  projectSpec,
  onBack,
}: {
  unit: ManufacturingUnit;
  projectSpec: ProjectSpec | undefined;
  onBack: () => void;
}) {
  const { scene } = useGLTF(GARDEN_LOFTS_GLB_URL);
  const balconyDepthM = useMemo(() => measureBalconyDepthM(scene, unit.level), [scene, unit.level]);

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
        {unitTitle(unit)}
      </h3>
      <p className="mt-0.5 text-xs" style={{ color: "var(--ff-text-muted)" }}>
        Structured spec sheet — real data only, not a rendered dimensioned CAD drawing.
      </p>

      {unit.flag && (
        <div
          className="mt-3 rounded-[0.2rem] p-2 text-xs"
          style={{ background: "var(--ff-status-warning)", color: "white" }}
        >
          {unit.flag}
        </div>
      )}

      <dl className="mt-3 space-y-1.5">
        <Row label="Unit Type" value={unit.typeLabel} />
        <Row label="Subtype" value={unit.subtypeCode} />
        <Row label="Level" value={String(unit.level)} />
        <Row label="Square Footage" value={unit.squareFootage ? `${unit.squareFootage.toLocaleString()} SF` : "--"} />
        <Row label="Object Name" value={unit.objectName} />
        {projectSpec && (
          <Row
            label="Structural Grid"
            value={`${feet(projectSpec.module_grid.bay_x_m)} × ${feet(projectSpec.module_grid.bay_y_m)} (${projectSpec.module_grid.bay_x_m}m × ${projectSpec.module_grid.bay_y_m}m)`}
          />
        )}
        <Row
          label="Balcony Depth"
          value={balconyDepthM !== undefined ? `${feet(balconyDepthM)} (${balconyDepthM.toFixed(2)}m, measured from source geometry)` : "No balcony band geometry found at this level"}
        />
        <Row label="Corridor Width" value="Not present as a named object in the source geometry — not confirmed" />
        {projectSpec && (
          <>
            <Row label="Construction Type" value={projectSpec.construction_type} />
            <Row label="Parking" value={projectSpec.parking} />
          </>
        )}
      </dl>
    </div>
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

function ShopDrawingsTree() {
  const { projectSpec, levels, unitsByObjectName } = useGardenLoftsTree();
  const { setSelected } = useSelection();
  const [openSheetId, setOpenSheetId] = useState<string | null>(null);

  if (openSheetId) {
    const unit = levels.flatMap((l) => l.units).find((u) => u.objectName === openSheetId);
    if (unit) {
      return <ShopDrawingSheet unit={unit} projectSpec={projectSpec} onBack={() => setOpenSheetId(null)} />;
    }
  }

  const items: BrowseListItem[] = [
    {
      id: BUILDING_ID,
      title: "Garden Lofts — Sheets",
      children: levels.map((level) => ({
        id: `sheet-level-${level.level}`,
        title: level.title,
        children: level.units.map((unit) => ({
          id: unit.objectName,
          title: unit.flag ? `Sheet — ${unitTitle(unit)} ⚠` : `Sheet — ${unitTitle(unit)}`,
        })),
      })),
    },
  ];

  return (
    <BrowseList
      items={items}
      onSelect={(id) => {
        if (id === BUILDING_ID || id.startsWith("sheet-level-")) return;
        setOpenSheetId(id);

        // Also drive the real global selection (Inspector + GeometryViewport
        // both react to this) with preferredView: "plan" set — opening a
        // sheet is the one real trigger for defaulting the viewport into
        // plan-view mode, per the plan-view task.
        const unit = unitsByObjectName.get(id);
        if (!unit) return;
        const payload: ManufacturingPayload = {
          kind: "unit",
          name: unitTitle(unit),
          objectName: unit.objectName,
          level: unit.level,
          typeLabel: unit.typeLabel,
          subtypeCode: unit.subtypeCode,
          squareFootage: unit.squareFootage,
          flag: unit.flag,
          preferredView: "plan",
        };
        setSelected({
          feature: "manufacturing",
          objectType: "Unit",
          objectId: unit.objectName,
          payload,
        });
      }}
    />
  );
}

/**
 * Real Building -> Level -> Unit tree, parsed from the actual ingested
 * geometry's object names/extras (see gardenLoftsModel.ts) — no
 * fabricated entries. Dwelling units (Studio/1BR/2BR/3BR) are the only
 * per-level children shown; the real structural/circulation objects
 * (core walls, partitions, columns, balcony bands, sky garden/garden
 * soil) also exist in the source file but are left out of this tree for
 * now to keep it a usable unit list — a scoping choice, not missing data.
 *
 * A second mode, "Shop Drawings" (toggled via the PanelCard header), shows
 * one structured spec-sheet per unit — the sheet detail itself is a
 * self-contained master/detail view local to this panel (per the task's
 * framing of shop drawings as living inside Browse), but opening a sheet
 * also drives the real global SelectionContext with `preferredView:
 * "plan"` set, so GeometryViewport/Inspector both react — one identity
 * scheme, not two parallel selection mechanisms.
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
    <PanelCard title="Browse Geometry" toolbar={toggle} className="h-[560px]">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-sm text-gray-400">Loading geometry…</div>
        }
      >
        {mode === "objects" ? <ObjectsTree /> : <ShopDrawingsTree />}
      </Suspense>
    </PanelCard>
  );
}
