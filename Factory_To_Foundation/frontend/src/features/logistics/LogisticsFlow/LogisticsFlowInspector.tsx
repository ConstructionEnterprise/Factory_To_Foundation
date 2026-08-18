import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { usePermission } from "@/context/AuthContext";
import { DetailRow, PanelCard } from "@/framework/ui";
import { constructionProjects } from "@/features/construction/constructionData";

import AddFlowConnectionForm from "./AddFlowConnectionForm";
import { STATUS_COLOR } from "./FlowMapNode";
import { resolveFlowPointAsset, useFlowAssetLookups } from "./flowPointResolution";
import * as api from "./logisticsFlowApi";
import type { FlowPointStatus, FlowPointStatusEvent } from "./logisticsFlowApi";
import { clearFlowSelection, loadLogisticsFlow, refreshFlowGraph, useLogisticsFlowState } from "./logisticsFlowStore";

const HOLD_HALT_OPTIONS: { value: FlowPointStatus; label: string }[] = [
  { value: "normal", label: "Return to Normal" },
  { value: "held", label: "Mark Held" },
  { value: "halted", label: "Emergency Stop" },
];

function projectTitle(id: string): string {
  return constructionProjects.find((p) => p.id === id)?.title ?? id;
}

/** Real detail + edit/delete for whichever flow point or connection is currently selected — honest "Nothing selected" state otherwise. Mirrors ManufacturingInspector.tsx's selection-branch shape. */
export default function LogisticsFlowInspector() {
  const { flows, points, connections, selection, selectedFlowId, graph } = useLogisticsFlowState();
  const navigate = useNavigate();
  const updatePermission = usePermission("logistics", "update");
  const deletePermission = usePermission("logistics", "delete");
  const createPermission = usePermission("logistics", "create");
  const assetLookups = useFlowAssetLookups();

  const [showAddConnection, setShowAddConnection] = useState(false);
  const [notes, setNotes] = useState("");
  const [assetRef, setAssetRef] = useState("");
  const [relationship, setRelationship] = useState("");
  const [distanceMeters, setDistanceMeters] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusEvents, setStatusEvents] = useState<FlowPointStatusEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [transitionTo, setTransitionTo] = useState<FlowPointStatus>("held");
  const [transitionReason, setTransitionReason] = useState("");
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  const selectedPoint = selection?.kind === "point" ? points.find((p) => p.id === selection.id) : undefined;
  const selectedConnection = selection?.kind === "connection" ? connections.find((c) => c.id === selection.id) : undefined;
  // Only meaningful within a flow-scoped live monitor — the unscoped
  // cross-flow list has no real per-flow blockage graph to derive it from.
  const graphPoint =
    selectedFlowId && graph && selectedPoint && graph.flow.id === selectedPoint.flowId
      ? graph.points.find((p) => p.id === selectedPoint.id)
      : undefined;

  useEffect(() => {
    setError(null);
    setTransitionError(null);
    setTransitionReason("");
    if (selectedPoint) {
      // Default to the first status that isn't the point's current one —
      // the dropdown below always excludes the current status as an
      // option, so a stale default here would silently submit a value the
      // select never actually visually showed (the real bug this fixes).
      setTransitionTo(HOLD_HALT_OPTIONS.find((o) => o.value !== selectedPoint.status)?.value ?? "held");
      setNotes(selectedPoint.notes ?? "");
      setAssetRef(selectedPoint.assetRef ?? "");
      setEventsLoading(true);
      api
        .listFlowPointStatusEvents(selectedPoint.id)
        .then((events) => setStatusEvents(events.slice().reverse()))
        .catch(() => setStatusEvents([]))
        .finally(() => setEventsLoading(false));
    } else if (selectedConnection) {
      setRelationship(selectedConnection.relationship ?? "");
      setDistanceMeters(selectedConnection.distanceMeters != null ? String(selectedConnection.distanceMeters) : "");
      setNotes(selectedConnection.notes ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection?.kind, selection?.id]);

  async function handleSavePoint() {
    if (!selectedPoint) return;
    setSaving(true);
    setError(null);
    try {
      await api.updateFlowPoint(selectedPoint.id, {
        notes: notes.trim() || null,
        assetRef: assetRef.trim() || null,
      });
      await loadLogisticsFlow();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleRecordTransition() {
    if (!selectedPoint) return;
    setTransitioning(true);
    setTransitionError(null);
    try {
      await api.transitionFlowPointStatus(selectedPoint.id, transitionTo, transitionReason.trim() || undefined);
      setTransitionReason("");
      // The dropdown's options exclude whatever status is now current —
      // re-derive a value that's actually a rendered option, same fix as
      // the initial-selection effect above.
      setTransitionTo(HOLD_HALT_OPTIONS.find((o) => o.value !== transitionTo)?.value ?? "held");
      const events = await api.listFlowPointStatusEvents(selectedPoint.id);
      setStatusEvents(events.slice().reverse());
      await loadLogisticsFlow();
      if (selectedFlowId) await refreshFlowGraph();
    } catch (err) {
      setTransitionError(err instanceof Error ? err.message : String(err));
    } finally {
      setTransitioning(false);
    }
  }

  async function handleDeletePoint() {
    if (!selectedPoint) return;
    setSaving(true);
    setError(null);
    try {
      await api.deleteFlowPoint(selectedPoint.id);
      clearFlowSelection();
      await loadLogisticsFlow();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  async function handleSaveConnection() {
    if (!selectedConnection) return;
    setSaving(true);
    setError(null);
    try {
      await api.updateFlowConnection(selectedConnection.id, {
        relationship: relationship.trim() || null,
        distanceMeters: distanceMeters.trim() ? Number(distanceMeters) : null,
        notes: notes.trim() || null,
      });
      await loadLogisticsFlow();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConnection() {
    if (!selectedConnection) return;
    setSaving(true);
    setError(null);
    try {
      await api.deleteFlowConnection(selectedConnection.id);
      clearFlowSelection();
      await loadLogisticsFlow();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <PanelCard title="Selected Flow Item" className="h-full" bodyClassName="flex flex-col flex-1 overflow-y-auto">
      <div className="border-b border-gray-100 px-4 py-3">
        <button
          type="button"
          onClick={() => setShowAddConnection(true)}
          disabled={!createPermission.allowed}
          title={createPermission.reason}
          className="w-full rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          style={{ background: "var(--ff-accent)" }}
        >
          + Add Connection
        </button>
      </div>

      {!selectedPoint && !selectedConnection && (
        <p className="p-4 text-xs" style={{ color: "var(--ff-text-muted)" }}>
          Nothing selected — click a point or connection on the map, or a point in Browse.
        </p>
      )}

      {selectedPoint && (
        <div className="space-y-3 p-4">
          <DetailRow label="Name" value={selectedPoint.name} />
          <DetailRow label="Type" value={selectedPoint.type} />
          <DetailRow
            label="Project"
            value={projectTitle(flows.find((f) => f.id === selectedPoint.flowId)?.constructionProjectId ?? "")}
          />

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
              Operational Status
            </label>
            <div className="flex items-center gap-2">
              <span
                className="rounded px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase text-white"
                style={{ background: STATUS_COLOR[selectedPoint.status] }}
              >
                {selectedPoint.status}
              </span>
              {graphPoint && graphPoint.effectiveStatus !== graphPoint.status && (
                <span
                  className="rounded px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase text-white"
                  style={{ background: STATUS_COLOR[graphPoint.effectiveStatus] }}
                  title="Backed up by a downstream held/halted point — this point's own status is unchanged."
                >
                  {graphPoint.effectiveStatus} (backed up)
                </span>
              )}
            </div>
            {statusEvents[0]?.reason && (
              <p className="mt-1 text-[0.7rem]" style={{ color: "var(--ff-text-secondary)" }}>
                {statusEvents[0].reason}
              </p>
            )}

            <div className="mt-2 flex items-end gap-2">
              <div className="flex-1">
                <select
                  className="w-full rounded border px-2 py-1.5 text-sm"
                  value={transitionTo}
                  onChange={(e) => setTransitionTo(e.target.value as FlowPointStatus)}
                >
                  {HOLD_HALT_OPTIONS.filter((o) => o.value !== selectedPoint.status).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleRecordTransition}
                disabled={!updatePermission.allowed || transitioning}
                title={updatePermission.reason}
                className="rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                style={{ background: STATUS_COLOR[transitionTo] }}
              >
                {transitioning ? "Recording…" : "Record"}
              </button>
            </div>
            {transitionTo !== "normal" && (
              <input
                type="text"
                placeholder="Reason (required)"
                className="mt-2 w-full rounded border px-2 py-1.5 text-sm"
                value={transitionReason}
                onChange={(e) => setTransitionReason(e.target.value)}
              />
            )}
            {transitionError && (
              <p className="mt-1 text-xs" style={{ color: "var(--ff-status-critical)" }}>
                {transitionError}
              </p>
            )}

            {statusEvents.length > 0 && (
              <div className="mt-2 max-h-32 space-y-1 overflow-y-auto rounded border border-gray-100 p-2">
                {eventsLoading && (
                  <p className="text-[0.65rem]" style={{ color: "var(--ff-text-muted)" }}>
                    Loading history…
                  </p>
                )}
                {statusEvents.map((ev) => (
                  <div key={ev.id} className="text-[0.65rem]" style={{ color: "var(--ff-text-muted)" }}>
                    <span style={{ color: STATUS_COLOR[ev.toStatus] }}>●</span>{" "}
                    {ev.fromStatus ? `${ev.fromStatus} → ${ev.toStatus}` : `created ${ev.toStatus}`}
                    {" — "}
                    {new Date(ev.changedAt).toLocaleString()}
                    {ev.reason ? ` — ${ev.reason}` : ""}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
              Asset Reference
            </label>
            <input type="text" className="w-full rounded border px-2 py-1.5 text-sm" value={assetRef} onChange={(e) => setAssetRef(e.target.value)} />
            {(selectedPoint.type === "load_assignment" || selectedPoint.type === "transportation_handoff") &&
              (() => {
                const trimmedRef = assetRef.trim() || null;
                const resolved = resolveFlowPointAsset(selectedPoint.type, trimmedRef, assetLookups);
                if (!resolved) return null;

                // Real cross-domain navigation (not just a description): a
                // transportation_handoff's assetRef IS a real LogisticsDispatch
                // id, so it can navigate straight to that dispatch selected in
                // Logistics Operations -- same ?capability=/deep-link query-param
                // convention ModularSequenceTimeline.tsx already established for
                // Scheduling -> Construction. load_assignment's assetRef (a real
                // LogisticsTruck id) has no equivalent Fleet deep-link wired up
                // yet, so it stays plain text for now.
                if (selectedPoint.type === "transportation_handoff" && trimmedRef) {
                  const dispatchExists = assetLookups.dispatches.some((d) => d.id === trimmedRef);
                  if (dispatchExists) {
                    return (
                      <button
                        type="button"
                        onClick={() => navigate(`/logistics?capability=operations&dispatch=${trimmedRef}`)}
                        className="mt-1 text-[0.65rem] underline"
                        style={{ color: "var(--ff-accent)" }}
                      >
                        Dispatch: {resolved} ↗
                      </button>
                    );
                  }
                }

                return (
                  <p className="mt-1 text-[0.65rem]" style={{ color: "var(--ff-text-muted)" }}>
                    Resolves to: {resolved}
                  </p>
                );
              })()}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
              Notes
            </label>
            <textarea className="w-full rounded border px-2 py-1.5 text-sm" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {error && (
            <p className="text-xs" style={{ color: "var(--ff-status-critical)" }}>
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleSavePoint}
              disabled={!updatePermission.allowed || saving}
              title={updatePermission.reason}
              className="rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              style={{ background: "var(--ff-accent)" }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={handleDeletePoint}
              disabled={!deletePermission.allowed || saving}
              title={deletePermission.reason}
              className="rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              style={{ color: "var(--ff-status-critical)" }}
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {selectedConnection && (
        <div className="space-y-3 p-4">
          <DetailRow
            label="Source"
            value={points.find((p) => p.id === selectedConnection.sourcePointId)?.name ?? selectedConnection.sourcePointId}
          />
          <DetailRow
            label="Target"
            value={points.find((p) => p.id === selectedConnection.targetPointId)?.name ?? selectedConnection.targetPointId}
          />

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
              Relationship
            </label>
            <input
              type="text"
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
              Distance (meters)
            </label>
            <input
              type="number"
              min={0}
              step="any"
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={distanceMeters}
              onChange={(e) => setDistanceMeters(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
              Notes
            </label>
            <textarea className="w-full rounded border px-2 py-1.5 text-sm" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {error && (
            <p className="text-xs" style={{ color: "var(--ff-status-critical)" }}>
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleSaveConnection}
              disabled={!updatePermission.allowed || saving}
              title={updatePermission.reason}
              className="rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              style={{ background: "var(--ff-accent)" }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={handleDeleteConnection}
              disabled={!deletePermission.allowed || saving}
              title={deletePermission.reason}
              className="rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              style={{ color: "var(--ff-status-critical)" }}
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {showAddConnection && <AddFlowConnectionForm onClose={() => setShowAddConnection(false)} />}
    </PanelCard>
  );
}
