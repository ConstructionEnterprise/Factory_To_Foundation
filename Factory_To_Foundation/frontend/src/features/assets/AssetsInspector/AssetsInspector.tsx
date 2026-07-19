import { useSelection } from "@/context/SelectionContext";
import { DetailRow, PanelCard, StatusBadge, type StatusTone } from "@/framework/ui";

import { formatAssetStatus } from "../assetsData";

const STATUS_TONE: Record<string, StatusTone> = {
  active: "positive",
  maintenance: "warning",
  retired: "neutral",
};

export default function AssetsInspector() {
  const { selected } = useSelection();
  const sel = selected?.feature === "assets" ? selected : undefined;

  return (
    <PanelCard title="Asset Information" className="h-[560px]" bodyClassName="flex-1 overflow-auto p-5">
      <div className="mt-4">
        <h2 className="text-xl font-bold" style={{ color: "var(--ff-text-primary)" }}>{sel?.payload.name ?? "Nothing Selected"}</h2>
        <p className="mt-1 font-semibold" style={{ color: "var(--ff-accent)" }}>{sel?.objectType ?? "Select an asset"}</p>
      </div>

      <div className="mt-4">
        {sel ? (
          <StatusBadge label={formatAssetStatus(sel.payload.status)} tone={STATUS_TONE[sel.payload.status]} />
        ) : (
          <StatusBadge label="—" tone="neutral" />
        )}
      </div>

      <div className="mt-5 space-y-0.5">
        <DetailRow label="Category" value={sel?.payload.category ?? "--"} />
        <DetailRow label="Last Service" value={sel?.payload.lastService ?? "--"} />
      </div>
    </PanelCard>
  );
}
