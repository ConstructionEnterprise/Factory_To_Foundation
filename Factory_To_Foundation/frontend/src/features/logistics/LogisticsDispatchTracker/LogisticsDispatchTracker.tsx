import { useEffect, useState } from "react";

import { usePermission } from "@/context/AuthContext";
import { constructionProjects } from "@/features/construction/constructionData";

import {
  listCustodyEvents,
  listDispatches,
  listDrivers,
  listTrucks,
  pushDispatchToTaxReport,
  recordDispatchMileage,
  transitionDispatchStatus,
  type LogisticsCustodyEvent,
  type LogisticsDispatch,
  type LogisticsDriver,
  type LogisticsTruck,
} from "../logisticsOperationsApi";

type LogisticsDispatchTrackerProps = {
  onClose: () => void;
};

/** Matches the backend's own closed state machine exactly (logisticsDispatchService.ts's VALID_TRANSITIONS) — null means terminal, no further real transition exists. */
const NEXT_STATUS: Record<string, string | null> = {
  staged: "in_transit",
  in_transit: "delivered",
  delivered: null,
};
const STATUS_LABEL: Record<string, string> = {
  staged: "Staged",
  in_transit: "In Transit",
  delivered: "Delivered",
};

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Real chain-of-custody viewer + status-transition control (Phase 7).
 * Before this, LogisticsDispatch.status was a single mutable column with
 * no way to ever change it (no route existed) and no record of who moved a
 * real haul from staged -> in transit -> delivered, or when — not a real
 * audit trail. This lets a real user advance a real dispatch's status
 * (through the one real backend state machine, staged -> in_transit ->
 * delivered only) and shows the real, complete event history the backend
 * writes atomically alongside every transition.
 *
 * PROVISIONAL MOUNT POINT, same posture as LogisticsDispatchForm: rendered
 * as a modal from LogisticsToolbar/LogisticsPage, not a real panel of its
 * own — Phase 8's real Browse Logistics panel hasn't been built yet, and
 * this is understood to be superseded once it lands, not a permanent
 * second UI. Truck/Driver/destination labels are resolved client-side
 * against the same real lists the Dispatch-creation form already uses
 * (logisticsOperationsApi.ts, constructionData.ts's constructionProjects)
 * rather than a new backend DTO change, since nothing here needs it.
 */
export default function LogisticsDispatchTracker({ onClose }: LogisticsDispatchTrackerProps) {
  const updatePermission = usePermission("logistics", "update");

  const [dispatches, setDispatches] = useState<LogisticsDispatch[] | null>(null);
  const [trucks, setTrucks] = useState<LogisticsTruck[]>([]);
  const [drivers, setDrivers] = useState<LogisticsDriver[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [events, setEvents] = useState<LogisticsCustodyEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);

  const [odometerStartInput, setOdometerStartInput] = useState("");
  const [odometerEndInput, setOdometerEndInput] = useState("");
  const [businessPurposeInput, setBusinessPurposeInput] = useState("");
  const [savingMileage, setSavingMileage] = useState(false);
  const [mileageError, setMileageError] = useState<string | null>(null);

  const [pushingTaxReport, setPushingTaxReport] = useState(false);
  const [taxReportError, setTaxReportError] = useState<string | null>(null);

  function reloadDispatches() {
    Promise.all([listDispatches(), listTrucks(), listDrivers()])
      .then(([d, t, dr]) => {
        setDispatches(d);
        setTrucks(t);
        setDrivers(dr);
      })
      .catch((err) => setError(describeError(err)));
  }

  useEffect(reloadDispatches, []);

  useEffect(() => {
    if (!selectedId) {
      setEvents(null);
      return;
    }
    listCustodyEvents(selectedId)
      .then(setEvents)
      .catch((err) => setError(describeError(err)));
  }, [selectedId]);

  // Real, honest defaults — populate the mileage inputs from whatever this
  // dispatch's own row currently has (never blank-slates a real reading
  // someone already entered just because the tracker was reopened).
  useEffect(() => {
    const selectedDispatch = dispatches?.find((d) => d.id === selectedId) ?? null;
    setOdometerStartInput(selectedDispatch?.odometerStart != null ? String(selectedDispatch.odometerStart) : "");
    setOdometerEndInput(selectedDispatch?.odometerEnd != null ? String(selectedDispatch.odometerEnd) : "");
    setBusinessPurposeInput(selectedDispatch?.businessPurpose ?? "");
    setMileageError(null);
  }, [selectedId, dispatches]);

  const truckLabel = (id: string) => trucks.find((t) => t.id === id)?.identifier ?? id;
  const driverLabel = (id: string) => drivers.find((d) => d.id === id)?.name ?? id;
  const projectLabel = (id: string) => constructionProjects.find((p) => p.id === id)?.title ?? id;

  const selected = dispatches?.find((d) => d.id === selectedId) ?? null;
  const nextStatus = selected ? NEXT_STATUS[selected.status] : null;

  async function handleAdvance() {
    if (!selected || !nextStatus) return;
    setAdvancing(true);
    setError(null);
    try {
      await transitionDispatchStatus(selected.id, nextStatus);
      reloadDispatches();
      const refreshed = await listCustodyEvents(selected.id);
      setEvents(refreshed);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setAdvancing(false);
    }
  }

  /**
   * Real, server-validated save — only the fields the user actually typed
   * are sent, so leaving one blank never clobbers a value already recorded
   * (the backend merges against the existing row). `miles` itself is never
   * sent — it's always derived server-side from the real odometer readings.
   */
  async function handleSaveMileage() {
    if (!selected) return;
    setMileageError(null);

    const trimmedStart = odometerStartInput.trim();
    const trimmedEnd = odometerEndInput.trim();
    const trimmedPurpose = businessPurposeInput.trim();
    if (!trimmedStart && !trimmedEnd && !trimmedPurpose) {
      setMileageError("Enter a starting odometer, ending odometer, or business purpose to save.");
      return;
    }

    setSavingMileage(true);
    try {
      await recordDispatchMileage(selected.id, {
        odometerStart: trimmedStart ? Number(trimmedStart) : undefined,
        odometerEnd: trimmedEnd ? Number(trimmedEnd) : undefined,
        businessPurpose: trimmedPurpose || undefined,
      });
      reloadDispatches();
    } catch (err) {
      setMileageError(describeError(err));
    } finally {
      setSavingMileage(false);
    }
  }

  /**
   * Real, one-way push — the backend (pushToTaxReport()) is the actual
   * gate on delivered/complete-mileage/business-purpose; the client-side
   * `missingForTaxReport` list below exists purely to explain to the user
   * why the button is hidden, never to bypass a check the server also
   * makes.
   */
  async function handlePushToTaxReport() {
    if (!selected) return;
    setTaxReportError(null);
    setPushingTaxReport(true);
    try {
      await pushDispatchToTaxReport(selected.id);
      reloadDispatches();
    } catch (err) {
      setTaxReportError(describeError(err));
    } finally {
      setPushingTaxReport(false);
    }
  }

  const missingForTaxReport: string[] = [];
  if (selected && selected.status !== "delivered") missingForTaxReport.push("delivered status");
  if (selected && (selected.odometerStart === null || selected.odometerEnd === null || selected.miles === null)) {
    missingForTaxReport.push("both odometer readings");
  }
  if (selected && !selected.businessPurpose) missingForTaxReport.push("a business purpose");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-md p-6 shadow-xl"
        style={{ background: "var(--ff-content-bg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: "var(--ff-text-primary)" }}>
            Dispatch Tracking — Chain of Custody
          </h2>
          <button type="button" onClick={onClose} className="text-sm" style={{ color: "var(--ff-text-muted)" }}>
            ✕
          </button>
        </div>
        <p className="mb-4 text-[0.7rem]" style={{ color: "var(--ff-text-muted)" }}>
          Provisional entry point — real status transitions + a real audit trail. Superseded once the real Browse
          Logistics panel (Phase 8) lands.
        </p>

        {error && (
          <p className="mb-3 text-xs" style={{ color: "var(--ff-status-critical)" }}>
            {error}
          </p>
        )}

        <div className="flex gap-4">
          <div className="h-80 w-1/2 overflow-auto rounded border">
            {dispatches === null && (
              <p className="p-3 text-xs" style={{ color: "var(--ff-text-muted)" }}>
                Loading…
              </p>
            )}
            {dispatches?.length === 0 && (
              <p className="p-3 text-xs" style={{ color: "var(--ff-text-muted)" }}>
                No dispatches yet.
              </p>
            )}
            {dispatches?.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelectedId(d.id)}
                className="block w-full border-b px-3 py-2 text-left text-xs"
                style={{
                  background: selectedId === d.id ? "var(--ff-accent)" : "transparent",
                  color: selectedId === d.id ? "white" : "var(--ff-text-primary)",
                }}
              >
                <div className="font-medium">
                  {truckLabel(d.truckId)} → {projectLabel(d.destinationProjectId)}
                </div>
                <div style={{ opacity: 0.8 }}>
                  {driverLabel(d.driverId)} — {STATUS_LABEL[d.status] ?? d.status}
                </div>
              </button>
            ))}
          </div>

          <div className="w-1/2">
            {!selected && (
              <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
                Select a dispatch to view its chain of custody.
              </p>
            )}
            {selected && (
              <>
                <p className="mb-2 text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
                  Current status: <span style={{ color: "var(--ff-accent)" }}>{STATUS_LABEL[selected.status] ?? selected.status}</span>
                </p>
                <div className="mb-3 max-h-48 space-y-1 overflow-auto">
                  {events === null && (
                    <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
                      Loading events…
                    </p>
                  )}
                  {events?.map((e) => (
                    <div key={e.id} className="text-[0.7rem]" style={{ color: "var(--ff-text-secondary)" }}>
                      {e.fromStatus ? `${STATUS_LABEL[e.fromStatus] ?? e.fromStatus} → ` : "Created — "}
                      {STATUS_LABEL[e.toStatus] ?? e.toStatus}
                      <span style={{ color: "var(--ff-text-muted)" }}> · {new Date(e.changedAt).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                {nextStatus ? (
                  <button
                    type="button"
                    onClick={handleAdvance}
                    disabled={!updatePermission.allowed || advancing}
                    title={updatePermission.reason}
                    className="rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                    style={{ background: "var(--ff-accent)" }}
                  >
                    {advancing ? "Updating…" : `Advance to ${STATUS_LABEL[nextStatus] ?? nextStatus}`}
                  </button>
                ) : (
                  <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
                    Delivered — no further real transitions.
                  </p>
                )}

                <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--ff-panel-border)" }}>
                  <p className="mb-2 text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
                    Mileage
                  </p>
                  <p className="mb-2 text-[0.65rem]" style={{ color: "var(--ff-text-muted)" }}>
                    Real, odometer-based — miles is always derived from these two readings, never entered directly.
                    {selected.miles !== null ? ` Current: ${selected.miles} mi.` : ""}
                  </p>
                  <div className="mb-2 grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-[0.65rem]" style={{ color: "var(--ff-text-muted)" }}>
                        Odometer Start
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className="w-full rounded border px-2 py-1 text-xs"
                        value={odometerStartInput}
                        onChange={(e) => setOdometerStartInput(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[0.65rem]" style={{ color: "var(--ff-text-muted)" }}>
                        Odometer End
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className="w-full rounded border px-2 py-1 text-xs"
                        value={odometerEndInput}
                        onChange={(e) => setOdometerEndInput(e.target.value)}
                      />
                    </div>
                  </div>
                  <label className="mb-1 block text-[0.65rem]" style={{ color: "var(--ff-text-muted)" }}>
                    Business Purpose
                  </label>
                  <input
                    type="text"
                    className="mb-2 w-full rounded border px-2 py-1 text-xs"
                    value={businessPurposeInput}
                    onChange={(e) => setBusinessPurposeInput(e.target.value)}
                  />
                  {mileageError && (
                    <p className="mb-2 text-[0.65rem]" style={{ color: "var(--ff-status-critical)" }}>
                      {mileageError}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveMileage}
                    disabled={!updatePermission.allowed || savingMileage}
                    title={updatePermission.reason}
                    className="rounded px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                    style={{ background: "var(--ff-accent)" }}
                  >
                    {savingMileage ? "Saving…" : "Save Mileage"}
                  </button>
                </div>

                <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--ff-panel-border)" }}>
                  <p className="mb-2 text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
                    Tax Report
                  </p>
                  {selected.taxReportedAt ? (
                    <p className="text-xs" style={{ color: "var(--ff-status-positive)" }}>
                      ✓ Included in the Mileage Tax Report — {new Date(selected.taxReportedAt).toLocaleString()}.{" "}
                      <span style={{ color: "var(--ff-text-muted)" }}>See the Reports tab for the full report.</span>
                    </p>
                  ) : missingForTaxReport.length > 0 ? (
                    <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
                      Needs {missingForTaxReport.join(", ")} before this dispatch can be pushed to the tax report.
                    </p>
                  ) : (
                    <>
                      <p className="mb-2 text-[0.65rem]" style={{ color: "var(--ff-text-muted)" }}>
                        Real, one-way — marks this delivered haul as included in the real Mileage Tax Report (Reports
                        tab), which applies the real IRS rate actually in effect on this trip's own date.
                      </p>
                      {taxReportError && (
                        <p className="mb-2 text-[0.65rem]" style={{ color: "var(--ff-status-critical)" }}>
                          {taxReportError}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={handlePushToTaxReport}
                        disabled={!updatePermission.allowed || pushingTaxReport}
                        title={updatePermission.reason}
                        className="rounded px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                        style={{ background: "var(--ff-accent)" }}
                      >
                        {pushingTaxReport ? "Pushing…" : "Push to Tax Form"}
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
