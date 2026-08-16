import { useSelection } from "@/context/SelectionContext";
import { DetailRow, PanelCard, StatusBadge, type StatusTone } from "@/framework/ui";

const STATUS_TONE: Record<string, StatusTone> = {
  active: "positive",
  maintenance: "warning",
  retired: "neutral",
};

const CLASS_LABEL: Record<string, string> = {
  truck: "Truck",
  autonomous_dolly: "Autonomous Dolly",
  trailer: "Trailer",
  forklift: "Forklift",
};

export default function FleetInspector() {
  const { selected } = useSelection();
  const sel = selected?.feature === "fleet" ? selected : undefined;

  return (
    <PanelCard title="Vehicle Information" className="h-full" bodyClassName="flex-1 overflow-auto p-5">
      <div className="mt-4">
        <h2 className="text-xl font-bold" style={{ color: "var(--ff-text-primary)" }}>{sel?.payload.name ?? "Nothing Selected"}</h2>
        <p className="mt-1 font-semibold" style={{ color: "var(--ff-accent)" }}>{sel?.objectType ?? "Select a vehicle"}</p>
      </div>

      <div className="mt-4">
        {sel ? (
          <StatusBadge label={sel.payload.status} tone={STATUS_TONE[sel.payload.status]} />
        ) : (
          <StatusBadge label="—" tone="neutral" />
        )}
      </div>

      <div className="mt-5 space-y-0.5">
        <DetailRow label="Class" value={sel ? (CLASS_LABEL[sel.payload.vehicleClass] ?? sel.payload.vehicleClass) : "--"} />
        <DetailRow label="Location" value={sel?.payload.location ?? "--"} />
        <DetailRow label="Linked Truck" value={sel?.payload.logisticsTruckIdentifier ?? "--"} />
      </div>
    </PanelCard>
  );
}
