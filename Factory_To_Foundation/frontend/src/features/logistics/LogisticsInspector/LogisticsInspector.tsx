import { useSelection } from "@/context/SelectionContext";
import { DetailRow, PanelCard, StatusBadge, type StatusTone } from "@/framework/ui";

import { formatLogisticsStatus } from "../logisticsData";

const STATUS_TONE: Record<string, StatusTone> = {
  "in-transit": "warning",
  staged: "neutral",
  delivered: "positive",
};

export default function LogisticsInspector() {
  const { selected } = useSelection();
  const sel = selected?.feature === "logistics" ? selected : undefined;

  return (
    <PanelCard title="Selected Asset" className="h-[560px]" bodyClassName="flex-1 overflow-auto p-5">
      <div className="mt-4">
        <h2 className="text-xl font-bold" style={{ color: "var(--ff-text-primary)" }}>{sel?.payload.name ?? "Nothing Selected"}</h2>
        <p className="mt-1 font-semibold" style={{ color: "var(--ff-accent)" }}>{sel?.objectType ?? "Select an asset"}</p>
      </div>

      <div className="mt-4">
        {sel ? (
          <StatusBadge label={formatLogisticsStatus(sel.payload.status)} tone={STATUS_TONE[sel.payload.status]} />
        ) : (
          <StatusBadge label="—" tone="neutral" />
        )}
      </div>

      <div className="mt-5 space-y-0.5">
        <DetailRow label="Location" value={sel?.payload.location ?? "--"} />
        <DetailRow label="Destination" value={sel?.payload.destination ?? "--"} />
        <DetailRow label="Load Information" value={sel?.payload.loadInfo ?? "--"} />
      </div>
    </PanelCard>
  );
}
