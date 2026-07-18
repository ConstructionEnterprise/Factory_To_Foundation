import { useSelection } from "@/context/SelectionContext";
import type { Selection } from "@/context/SelectionContext";
import { DetailRow, PanelCard, PreviewBox } from "@/framework/ui";

import type { ProjectSpec } from "../gardenLoftsModel";

type ManufacturingSelection = Extract<Selection, { feature: "manufacturing" }>;

function UnitDetails({ sel }: { sel: ManufacturingSelection }) {
  const unit = sel.payload.kind === "unit" ? sel.payload : undefined;
  if (!unit) return null;

  return (
    <>
      <div className="mt-4">
        <h2 className="text-xl font-bold" style={{ color: "var(--ff-text-primary)" }}>
          {unit.typeLabel} — {unit.subtypeCode}
        </h2>
        <p className="mt-1 font-semibold" style={{ color: "var(--ff-accent)" }}>
          Level {unit.level}
        </p>
      </div>

      {unit.flag && (
        <div
          className="mt-4 rounded-[0.2rem] p-3 text-xs"
          style={{ background: "var(--ff-status-warning)", color: "white" }}
        >
          {unit.flag}
        </div>
      )}

      <div className="mt-5 space-y-0.5">
        <DetailRow label="Unit Type" value={unit.typeLabel} />
        <DetailRow label="Subtype" value={unit.subtypeCode} />
        <DetailRow label="Square Footage" value={unit.squareFootage ? `${unit.squareFootage.toLocaleString()} SF` : "--"} />
        <DetailRow label="Level" value={String(unit.level)} />
        <DetailRow label="Object Name" value={unit.objectName} />
      </div>
    </>
  );
}

function BuildingDetails({ sel }: { sel: ManufacturingSelection }) {
  const building = sel.payload.kind === "building" ? sel.payload : undefined;
  const spec = building?.projectSpec as ProjectSpec | undefined;
  if (!building) return null;

  if (!spec) {
    return (
      <div className="mt-4 text-sm text-gray-400">
        PROJECT_SPEC metadata not found on the loaded asset.
      </div>
    );
  }

  const unitMixRows = Object.entries(spec.unit_mix).map(([key, v]) => (
    <DetailRow
      key={key}
      label={key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
      value={`${v.count} (${v.pct}) — avg ${v.avg_size_sf} SF`}
    />
  ));

  return (
    <>
      <div className="mt-4">
        <h2 className="text-xl font-bold" style={{ color: "var(--ff-text-primary)" }}>
          {spec.project_name}
        </h2>
        <p className="mt-1 font-semibold" style={{ color: "var(--ff-accent)" }}>
          Building — Shop Drawing Data
        </p>
      </div>

      {spec.known_data_issue && (
        <div
          className="mt-4 rounded-[0.2rem] p-3 text-xs"
          style={{ background: "var(--ff-status-warning)", color: "white" }}
        >
          {spec.known_data_issue}
        </div>
      )}

      <div className="mt-5 space-y-0.5">
        <DetailRow label="Location" value={spec.location} />
        <DetailRow label="Construction Type" value={spec.construction_type} />
        <DetailRow label="Structural System" value={spec.structural_system} />
        <DetailRow label="Stories" value={String(spec.stories)} />
        <DetailRow
          label="Envelope (L x D x H)"
          value={`${spec.building_envelope.length_m}m x ${spec.building_envelope.depth_m}m x ${spec.building_envelope.architectural_height_m}m`}
        />
        <DetailRow label="Gross Floor Area" value={`${spec.gross_floor_area_m2.toLocaleString()} m²`} />
        <DetailRow label="Footprint" value={`${spec.footprint_m2.toLocaleString()} m²`} />
        <DetailRow label="Typical Floor Plate" value={`${spec.typical_floor_plate_m2.toLocaleString()} m²`} />
        <DetailRow label="Units Total" value={String(spec.units_total)} />
        <DetailRow label="Parking" value={spec.parking} />
        <DetailRow label="Module / Structural Grid" value={`${spec.module_grid.bay_x_m}m x ${spec.module_grid.bay_y_m}m bays`} />
      </div>

      <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ff-text-muted)" }}>
        Unit Mix
      </h3>
      <div className="mt-2 space-y-0.5">{unitMixRows}</div>
    </>
  );
}

/**
 * Real per-unit data, or real building-level PROJECT_SPEC data — which
 * one renders is driven entirely by `payload.kind`, set at selection
 * time by GeometryViewport/ManufacturingBrowse. This is genuinely the
 * building's "shop drawing" view, distinct from any single unit's detail.
 */
export default function ManufacturingInspector() {
  const { selected } = useSelection();
  const sel = selected?.feature === "manufacturing" ? selected : undefined;

  return (
    <PanelCard title="Selected Geometry" className="h-[560px]" bodyClassName="flex-1 overflow-auto p-5">
      <PreviewBox />

      {!sel && (
        <div className="mt-6 text-center text-sm text-gray-400">
          <p>Nothing selected.</p>
          <p className="mt-1">Click a unit in the viewport or Browse tree, or select the building root.</p>
        </div>
      )}

      {sel?.payload.kind === "unit" && <UnitDetails sel={sel} />}
      {sel?.payload.kind === "building" && <BuildingDetails sel={sel} />}
    </PanelCard>
  );
}
