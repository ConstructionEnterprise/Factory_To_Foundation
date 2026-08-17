import { useSelection } from "@/context/SelectionContext";
import { DetailRow, PanelCard } from "@/framework/ui";

/** Real detail view, read-only -- same posture as AssetsInspector (no edit/delete route exists for LogisticsMaterial yet; not built speculatively here). */
export default function MaterialsInspector() {
  const { selected } = useSelection();
  const sel = selected?.feature === "materials" ? selected : undefined;

  return (
    <PanelCard title="Material Information" className="h-full" bodyClassName="flex-1 overflow-auto p-5">
      <div className="mt-4">
        <h2 className="text-xl font-bold" style={{ color: "var(--ff-text-primary)" }}>
          {sel?.payload.name ?? "Nothing Selected"}
        </h2>
        <p className="mt-1 font-semibold" style={{ color: "var(--ff-accent)" }}>
          {sel ? "Material" : "Select a material"}
        </p>
      </div>

      <div className="mt-5 space-y-0.5">
        <DetailRow label="On Hand" value={sel ? String(sel.payload.quantityOnHand) : "--"} />
        <DetailRow label="Reserved" value={sel ? String(sel.payload.quantityReserved) : "--"} />
        <DetailRow label="Available" value={sel ? String(sel.payload.quantityAvailable) : "--"} />
        <DetailRow label="Location" value={sel?.payload.location ?? "--"} />
      </div>
    </PanelCard>
  );
}
