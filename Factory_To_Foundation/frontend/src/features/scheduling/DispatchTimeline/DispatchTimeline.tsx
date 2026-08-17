import { useEffect, useState } from "react";

import { useSelection } from "@/context/SelectionContext";
import { useNavigate } from "react-router-dom";

import { Legend, PanelCard } from "@/framework/ui";
import { computeGlobalAxis, computeTimelineRow } from "@/lib/eventTimeline";

import {
  listDispatches,
  listTrucks,
  listDrivers,
  listCustodyEvents,
  type LogisticsDispatch,
  type LogisticsTruck,
  type LogisticsDriver,
  type LogisticsCustodyEvent,
} from "@/features/logistics/logisticsOperationsApi";
import { constructionProjects } from "@/features/construction/constructionData";

type LogisticsStatus = "staged" | "in_transit" | "delivered";

const STATUS_COLOR: Record<LogisticsStatus, string> = {
  staged: "var(--ff-status-neutral)",
  in_transit: "var(--ff-status-warning)",
  delivered: "var(--ff-status-positive)",
};

const STATUS_ORDER: LogisticsStatus[] = ["staged", "in_transit", "delivered"];

function truckLabel(trucks: LogisticsTruck[], id: string): string {
  return trucks.find((t) => t.id === id)?.identifier ?? "Unknown truck";
}
function driverLabel(drivers: LogisticsDriver[], id: string): string {
  return drivers.find((d) => d.id === id)?.name ?? "Unknown driver";
}
function projectLabel(id: string): string {
  return constructionProjects.find((p) => p.id === id)?.title ?? id;
}

type Row = {
  dispatch: LogisticsDispatch;
  leadMs: number;
  segments: { status: LogisticsStatus; durationMs: number }[];
  trailMs: number;
};

/**
 * Phase 2 interoperability, iteration 1 (2026-08-17): Dispatch remains
 * fully authoritative in Logistics/Transportation -- this is a real
 * READ-TIME PROJECTION, not a copy. Every field comes from the same
 * `logisticsOperationsApi.ts` calls LogisticsBrowse itself uses; zero new
 * backend routes, zero persisted rows of Scheduling's own. Reuses the
 * exact same lead/segments/trail math Construction's Timeliner uses for
 * ModuleSequenceEvent (see lib/eventTimeline.ts) -- LogisticsCustodyEvent
 * is structurally identical ({changedAt, fromStatus, toStatus}), proven
 * generic by this being its second real consumer, not a parallel
 * reimplementation.
 *
 * Deliberately NOT rendered inside the Interactive Gantt Timeline
 * (ScheduleGantt) -- that component implies drag-to-edit ownership of
 * ScheduleTask's own planned dates, which would be dishonest for data
 * Scheduling doesn't own or control. A read-only Timeliner-style strip is
 * the accurate shape for projected, non-owned data.
 */
export default function DispatchTimeline() {
  const [dispatches, setDispatches] = useState<LogisticsDispatch[] | null>(null);
  const [trucks, setTrucks] = useState<LogisticsTruck[]>([]);
  const [drivers, setDrivers] = useState<LogisticsDriver[]>([]);
  const [eventsByDispatch, setEventsByDispatch] = useState<Record<string, LogisticsCustodyEvent[]>>({});
  const [error, setError] = useState<string | null>(null);

  const { selected, setSelected } = useSelection();
  const navigate = useNavigate();
  const activeId = selected?.feature === "logistics" ? selected.objectId : undefined;

  useEffect(() => {
    Promise.all([listDispatches(), listTrucks(), listDrivers()])
      .then(([d, t, dr]) => {
        setDispatches(d);
        setTrucks(t);
        setDrivers(dr);
        return Promise.all(d.map((dispatch) => listCustodyEvents(dispatch.id).then((events) => [dispatch.id, events] as const)));
      })
      .then((pairs) => pairs && setEventsByDispatch(Object.fromEntries(pairs)))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load real Logistics dispatch data"));
  }, []);

  function handleSelect(dispatch: LogisticsDispatch) {
    setSelected({
      feature: "logistics",
      objectType: "Dispatch",
      objectId: `dispatch:${dispatch.id}`,
      payload: {
        kind: "dispatch",
        truckIdentifier: truckLabel(trucks, dispatch.truckId),
        driverName: driverLabel(drivers, dispatch.driverId),
        destinationTitle: projectLabel(dispatch.destinationProjectId),
        status: dispatch.status,
        route: dispatch.route,
        traffic: dispatch.traffic,
        eta: dispatch.eta,
        odometerStart: dispatch.odometerStart,
        odometerEnd: dispatch.odometerEnd,
        miles: dispatch.miles,
        businessPurpose: dispatch.businessPurpose,
        taxReportedAt: dispatch.taxReportedAt,
        dispatchedAt: dispatch.dispatchedAt,
      },
    });
    navigate("/logistics");
  }

  if (error) {
    return (
      <PanelCard title="Logistics Dispatches" className="h-full" bodyClassName="p-5">
        <p className="text-xs" style={{ color: "var(--ff-status-critical)" }}>{error}</p>
      </PanelCard>
    );
  }

  if (!dispatches) {
    return (
      <PanelCard title="Logistics Dispatches" className="h-full" bodyClassName="p-5">
        <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>Loading real dispatches…</p>
      </PanelCard>
    );
  }

  const allEvents = Object.values(eventsByDispatch).flat();
  if (allEvents.length === 0) {
    return (
      <PanelCard title="Logistics Dispatches" className="h-full" bodyClassName="p-5">
        <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
          No real dispatch custody events yet — this panel is a live read-only projection of Logistics' own real data, nothing owned here.
        </p>
      </PanelCard>
    );
  }

  const { globalMin, globalMax, span } = computeGlobalAxis(allEvents);

  const rows: Row[] = dispatches
    .map((dispatch) => {
      const events = eventsByDispatch[dispatch.id] ?? [];
      const computed = computeTimelineRow(events as { changedAt: string; toStatus: LogisticsStatus }[], globalMin, globalMax, dispatch.status === "delivered");
      if (!computed) return null;
      return { dispatch, ...computed };
    })
    .filter((row): row is Row => row !== null);

  return (
    <PanelCard
      title="Logistics Dispatches"
      className="h-full"
      bodyClassName="p-5 overflow-auto"
      toolbar={<span className="text-[0.65rem]" style={{ color: "var(--ff-text-muted)" }}>Read-only projection — authoritative in Logistics</span>}
    >
      <div className="mb-3 flex gap-4">
        {STATUS_ORDER.map((s) => (
          <Legend key={s} color={STATUS_COLOR[s]} label={s.replace(/_/g, " ")} />
        ))}
      </div>
      <div className="mb-2 flex justify-between text-xs" style={{ color: "var(--ff-text-muted)" }}>
        <span>{new Date(globalMin).toLocaleDateString()}</span>
        <span>{new Date(globalMax).toLocaleDateString()}</span>
      </div>
      <div className="space-y-2">
        {rows.map(({ dispatch, leadMs, segments, trailMs }) => (
          <div key={dispatch.id} className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleSelect(dispatch)}
              className="w-40 shrink-0 truncate text-left text-xs"
              style={{
                color: "var(--ff-text-secondary)",
                outline: `dispatch:${dispatch.id}` === activeId ? "2px solid var(--ff-accent)" : undefined,
                outlineOffset: `dispatch:${dispatch.id}` === activeId ? "-2px" : undefined,
              }}
              title={`${truckLabel(trucks, dispatch.truckId)} → ${projectLabel(dispatch.destinationProjectId)} — click to view the authoritative Dispatch in Logistics`}
            >
              {truckLabel(trucks, dispatch.truckId)} → {projectLabel(dispatch.destinationProjectId)}
            </button>
            <div
              className="flex h-4 flex-1 cursor-pointer overflow-hidden rounded"
              style={{ background: "var(--ff-content-bg)" }}
              onClick={() => handleSelect(dispatch)}
            >
              {leadMs > 0 && <div style={{ flexGrow: leadMs / span }} />}
              {segments.map((seg, i) => (
                <div
                  key={i}
                  style={{ flexGrow: seg.durationMs / span, background: STATUS_COLOR[seg.status] }}
                  title={`${seg.status.replace(/_/g, " ")} — ${Math.round(seg.durationMs / 3_600_000)}h`}
                />
              ))}
              {trailMs > 0 && <div style={{ flexGrow: trailMs / span }} />}
            </div>
          </div>
        ))}
      </div>
    </PanelCard>
  );
}
