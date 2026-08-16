import { useEffect, useState } from "react";

import { constructionProjects } from "@/features/construction/constructionData";
import { useSelection } from "@/context/SelectionContext";
import { PanelCard, StatusBadge, type StatusTone } from "@/framework/ui";

import { fetchVehicleDetail, type VehicleDispatchSummary } from "./fleetApi";

const STATUS_TONE: Record<string, StatusTone> = {
  staged: "neutral",
  in_transit: "warning",
  delivered: "positive",
};

function projectLabel(id: string): string {
  return constructionProjects.find((p) => p.id === id)?.title ?? id;
}

/**
 * Fleet's center workspace panel -- a real dispatch-history table for the
 * selected vehicle (LogisticsDispatch.vehicleId, Phase 3.3). No spatial map:
 * unlike Assets (real x/y layout, assetsData.ts) or Genealogy (real
 * client-computed tier layout), Fleet has no real position data to plot --
 * `Vehicle.location` is honest free text ("Yard B"), not coordinates, so a
 * map here would fabricate placement rather than show anything real.
 */
export default function FleetWorkspace() {
  const { selected } = useSelection();
  const sel = selected?.feature === "fleet" ? selected : undefined;

  const [dispatches, setDispatches] = useState<VehicleDispatchSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sel) {
      setDispatches([]);
      return;
    }
    setLoading(true);
    setError(null);
    fetchVehicleDetail(sel.objectId)
      .then((detail) => setDispatches(detail.dispatches))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [sel?.objectId]);

  return (
    <PanelCard title="Dispatch History" className="h-full" bodyClassName="flex-1 overflow-auto p-5">
      {!sel && <p style={{ color: "var(--ff-text-muted)" }}>Select a vehicle to see its real dispatch history.</p>}
      {sel && loading && <p style={{ color: "var(--ff-text-muted)" }}>Loading…</p>}
      {sel && error && <p style={{ color: "var(--ff-status-negative, #b91c1c)" }}>{error}</p>}
      {sel && !loading && !error && dispatches.length === 0 && (
        <p style={{ color: "var(--ff-text-muted)" }}>{sel.payload.name} has no real dispatch history yet.</p>
      )}
      {sel && !loading && !error && dispatches.length > 0 && (
        <div className="space-y-2">
          {dispatches.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between rounded-lg px-3 py-2"
              style={{ border: "1px solid var(--ff-content-bg)" }}
            >
              <div>
                <div className="font-semibold" style={{ color: "var(--ff-text-primary)" }}>
                  {sel.payload.name} → {projectLabel(d.destinationProjectId)}
                </div>
                <div className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
                  {d.route ?? "No route recorded"} · Dispatched {new Date(d.dispatchedAt).toLocaleDateString()}
                  {d.miles !== null ? ` · ${d.miles} mi` : ""}
                </div>
              </div>
              <StatusBadge label={d.status} tone={STATUS_TONE[d.status] ?? "neutral"} />
            </div>
          ))}
        </div>
      )}
    </PanelCard>
  );
}
