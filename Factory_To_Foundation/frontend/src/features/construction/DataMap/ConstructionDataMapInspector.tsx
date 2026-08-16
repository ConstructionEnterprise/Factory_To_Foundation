import { DetailRow, PanelCard, StatusBadge, type StatusTone } from "@/framework/ui";

import type { ConstructionDispatchSummary } from "./constructionDataMapApi";

const DISPATCH_STATUS_TONE: Record<string, StatusTone> = {
  staged: "neutral",
  in_transit: "warning",
  delivered: "positive",
};

type ConstructionDataMapInspectorProps = {
  dispatch: ConstructionDispatchSummary | null;
};

/** Real selected-dispatch detail for Construction Data Map (Phase 1.1, 2026-08-16 rollout). */
export default function ConstructionDataMapInspector({ dispatch }: ConstructionDataMapInspectorProps) {
  return (
    <PanelCard title="Dispatch Information" className="h-full" bodyClassName="flex-1 overflow-auto p-5">
      <div className="mt-4">
        <h2 className="text-xl font-bold" style={{ color: "var(--ff-text-primary)" }}>
          {dispatch?.vehicle?.identifier ?? dispatch?.truckIdentifier ?? "Nothing Selected"}
        </h2>
        <p className="mt-1 font-semibold" style={{ color: "var(--ff-accent)" }}>
          {dispatch ? "Dispatch" : "Select a dispatch"}
        </p>
      </div>

      <div className="mt-4">
        {dispatch ? (
          <StatusBadge label={dispatch.status} tone={DISPATCH_STATUS_TONE[dispatch.status] ?? "neutral"} />
        ) : (
          <StatusBadge label="—" tone="neutral" />
        )}
      </div>

      <div className="mt-5 space-y-0.5">
        <DetailRow label="Route" value={dispatch?.route ?? "--"} />
        <DetailRow label="Driver" value={dispatch?.driverName ?? "--"} />
        <DetailRow label="ETA" value={dispatch?.eta ? new Date(dispatch.eta).toLocaleString() : "--"} />
        <DetailRow label="Miles" value={dispatch?.miles !== null && dispatch?.miles !== undefined ? String(dispatch.miles) : "--"} />
        <DetailRow label="Vehicle Class" value={dispatch?.vehicle?.vehicleClass ?? "--"} />
        <DetailRow label="Dispatched" value={dispatch ? new Date(dispatch.dispatchedAt).toLocaleString() : "--"} />
      </div>
    </PanelCard>
  );
}
