import { useEffect, useState } from "react";

import { useSelection } from "@/context/SelectionContext";
import { DetailRow, PanelCard, StatusBadge, type StatusTone } from "@/framework/ui";

import LogisticsDocuments from "../LogisticsDocuments";
import { listCustodyEvents, type LogisticsCustodyEvent } from "../logisticsOperationsApi";

/** Real vocabulary — matches the backend's own LogisticsStatus enum exactly (staged/in_transit/delivered), not the old fixture's hyphenated in-transit/staged/delivered strings. */
const STATUS_LABEL: Record<string, string> = {
  staged: "Staged",
  in_transit: "In Transit",
  delivered: "Delivered",
};
const STATUS_TONE: Record<string, StatusTone> = {
  staged: "neutral",
  in_transit: "warning",
  delivered: "positive",
};

/**
 * Real, read-only chain-of-custody readback (Phase 7's audit trail) for a
 * selected real dispatch — advancing status still only happens through
 * LogisticsDispatchTracker's own control, this just shows the same real
 * history inline wherever a dispatch is actually selected, since that's
 * more discoverable than requiring the separate provisional modal just to
 * see what already happened to it.
 */
function CustodyTrail({ dispatchId }: { dispatchId: string }) {
  const [events, setEvents] = useState<LogisticsCustodyEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEvents(null);
    setError(null);
    listCustodyEvents(dispatchId)
      .then(setEvents)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [dispatchId]);

  return (
    <div className="mt-6 border-t pt-4" style={{ borderColor: "var(--ff-panel-border)" }}>
      <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ff-text-secondary)" }}>
        Chain of Custody
      </h3>
      {error && (
        <p className="mt-2 text-[0.65rem]" style={{ color: "var(--ff-status-critical)" }}>
          {error}
        </p>
      )}
      {events === null && !error && (
        <p className="mt-2 text-[0.65rem]" style={{ color: "var(--ff-text-muted)" }}>
          Loading…
        </p>
      )}
      {events?.length === 0 && (
        <p className="mt-2 text-[0.65rem]" style={{ color: "var(--ff-text-muted)" }}>
          No custody events recorded — this dispatch predates the real audit trail (Phase 7), not a fabricated gap.
        </p>
      )}
      {events && events.length > 0 && (
        <div className="mt-2 space-y-1">
          {events.map((e) => (
            <p key={e.id} className="text-[0.7rem]" style={{ color: "var(--ff-text-secondary)" }}>
              {e.fromStatus ? `${STATUS_LABEL[e.fromStatus] ?? e.fromStatus} → ` : "Created — "}
              {STATUS_LABEL[e.toStatus] ?? e.toStatus}
              <span style={{ color: "var(--ff-text-muted)" }}> · {new Date(e.changedAt).toLocaleString()}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Real per-kind Inspector (Phase 8) — replaces the old fixture-uniform
 * name/status/location/destination/loadInfo shape with the real fields
 * each real Logistics model actually has, branching on
 * `selected.payload.kind`. No fabricated "Load Information" row anymore —
 * that was a fixture-only concept with no real backing field on any of
 * Material/Module/Dispatch.
 */
export default function LogisticsInspector() {
  const { selected } = useSelection();
  const sel = selected?.feature === "logistics" ? selected : undefined;

  const title = sel
    ? sel.payload.kind === "dispatch"
      ? `${sel.payload.truckIdentifier} → ${sel.payload.destinationTitle}`
      : sel.payload.name
    : "Nothing Selected";

  return (
    <PanelCard title="Selected Asset" className="h-full" bodyClassName="flex-1 overflow-auto p-5">
      <div className="mt-4">
        <h2 className="text-xl font-bold" style={{ color: "var(--ff-text-primary)" }}>
          {title}
        </h2>
        <p className="mt-1 font-semibold" style={{ color: "var(--ff-accent)" }}>
          {sel?.objectType ?? "Select an asset"}
        </p>
      </div>

      {!sel && (
        <p className="mt-6 text-sm" style={{ color: "var(--ff-text-muted)" }}>
          Click a real material, module, or dispatch in Browse Logistics.
        </p>
      )}

      {sel?.payload.kind === "material" && (
        <div className="mt-5 space-y-0.5">
          <DetailRow label="Quantity" value={sel.payload.quantity !== null ? String(sel.payload.quantity) : "--"} />
          <DetailRow label="Location" value={sel.payload.location ?? "--"} />
        </div>
      )}

      {sel?.payload.kind === "module" && (
        <div className="mt-5 space-y-0.5">
          <DetailRow label="Location" value={sel.payload.location ?? "--"} />
          <DetailRow label="Assigned Dispatch" value={sel.payload.dispatchLabel ?? "Unassigned — staged in the Yard"} />
          {sel.payload.dispatchStatus && (
            <DetailRow label="Dispatch Status" value={STATUS_LABEL[sel.payload.dispatchStatus] ?? sel.payload.dispatchStatus} />
          )}
        </div>
      )}

      {sel?.payload.kind === "dispatch" && (
        <>
          <div className="mt-4">
            <StatusBadge label={STATUS_LABEL[sel.payload.status] ?? sel.payload.status} tone={STATUS_TONE[sel.payload.status] ?? "neutral"} />
          </div>
          <div className="mt-5 space-y-0.5">
            <DetailRow label="Truck" value={sel.payload.truckIdentifier} />
            <DetailRow label="Driver" value={sel.payload.driverName} />
            <DetailRow label="Destination" value={sel.payload.destinationTitle} />
            <DetailRow label="ETA" value={sel.payload.eta ? new Date(sel.payload.eta).toLocaleString() : "--"} />
            <DetailRow label="Route" value={sel.payload.route ?? "--"} />
            <DetailRow label="Traffic" value={sel.payload.traffic ?? "--"} />
            <DetailRow label="Dispatched" value={new Date(sel.payload.dispatchedAt).toLocaleString()} />
            <DetailRow label="Business Purpose" value={sel.payload.businessPurpose ?? "--"} />
            <DetailRow label="Odometer Start" value={sel.payload.odometerStart !== null ? String(sel.payload.odometerStart) : "--"} />
            <DetailRow label="Odometer End" value={sel.payload.odometerEnd !== null ? String(sel.payload.odometerEnd) : "--"} />
            <DetailRow
              label="Miles (derived)"
              value={sel.payload.miles !== null ? `${sel.payload.miles} mi` : "-- (record both odometer readings)"}
            />
            <DetailRow
              label="Tax Report"
              value={sel.payload.taxReportedAt ? `Included — ${new Date(sel.payload.taxReportedAt).toLocaleDateString()}` : "Not yet included"}
            />
          </div>
          <CustodyTrail dispatchId={sel.objectId.split(":")[1]} />
          <LogisticsDocuments dispatchId={sel.objectId.split(":")[1]} />
        </>
      )}
    </PanelCard>
  );
}
