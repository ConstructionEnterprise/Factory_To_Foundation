import { Suspense } from "react";
import { useGLTF } from "@react-three/drei";

import { useSelection } from "@/context/SelectionContext";
import { DetailRow, PanelCard } from "@/framework/ui";

import { measureNode, metersLabel, useManufacturingModelUrl } from "../manufacturingModel";

function humanizeKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Real bounding-box dimensions, always shown — derivable from the loaded
 * geometry regardless of source format, unlike anything in `extras`.
 * Undefined only for a node with no real geometry anywhere in its
 * subtree (a bare organizational grouping with no mesh descendants).
 */
function DimensionsRow({ objectName }: { objectName: string }) {
  const { scene } = useGLTF(useManufacturingModelUrl());
  const size = measureNode(scene, objectName);

  if (!size) {
    return <DetailRow label="Bounding Box" value="No geometry on this node" />;
  }

  return (
    <>
      <DetailRow label="Width (X)" value={metersLabel(size.x)} />
      <DetailRow label="Height (Y)" value={metersLabel(size.y)} />
      <DetailRow label="Depth (Z)" value={metersLabel(size.z)} />
    </>
  );
}

/**
 * Whatever real custom-property data this node's source object/collection
 * actually carries — a plain key-value list, never a search for expected
 * field names. Genuinely different files populate genuinely different
 * keys (confirmed: Garden Lofts' units carry `level`/`unit_type`; Modern
 * Heritage's wall frames carry `stud_spacing`/`door_clear_height` —
 * neither schema is assumed here).
 */
function ExtrasList({ extras }: { extras: Record<string, unknown> }) {
  const entries = Object.entries(extras);
  if (entries.length === 0) {
    return (
      <p className="mt-4 text-xs" style={{ color: "var(--ff-text-muted)" }}>
        No additional metadata on this element in the source file.
      </p>
    );
  }

  return (
    <div className="mt-5 space-y-0.5">
      {entries.map(([key, value]) => (
        <DetailRow key={key} label={humanizeKey(key)} value={String(value)} />
      ))}
    </div>
  );
}

/**
 * Fully generic — shows whatever real node is selected, from whatever
 * model is currently loaded. No assumption a "unit" vs "building"
 * distinction exists, no per-project field list. Real bounding-box
 * dimensions are always shown (derivable from geometry alone); real
 * extras are shown as a generic key-value list, whatever keys the
 * source file actually populated for this specific node.
 */
export default function ManufacturingInspector() {
  const { selected } = useSelection();
  const sel = selected?.feature === "manufacturing" ? selected : undefined;

  return (
    <PanelCard title="Selected Geometry" className="h-[560px]" bodyClassName="flex-1 overflow-auto p-5">
      {!sel && (
        <div className="mt-6 text-center text-sm text-gray-400">
          <p>Nothing selected.</p>
          <p className="mt-1">Click an element in the viewport or Browse tree.</p>
        </div>
      )}

      {sel && (
        <>
          <div className="mt-4">
            <h2 className="text-xl font-bold" style={{ color: "var(--ff-text-primary)" }}>
              {sel.payload.name}
            </h2>
            <p className="mt-1 font-semibold" style={{ color: "var(--ff-accent)" }}>
              {sel.objectType}
            </p>
          </div>

          <Suspense fallback={<p className="mt-5 text-xs" style={{ color: "var(--ff-text-muted)" }}>Measuring…</p>}>
            <div className="mt-5 space-y-0.5">
              <DimensionsRow objectName={sel.objectId} />
            </div>
          </Suspense>

          <ExtrasList extras={sel.payload.extras} />
        </>
      )}
    </PanelCard>
  );
}
