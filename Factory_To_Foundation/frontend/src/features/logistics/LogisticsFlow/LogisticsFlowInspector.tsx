import { useEffect, useState } from "react";

import { usePermission } from "@/context/AuthContext";
import { DetailRow, PanelCard } from "@/framework/ui";

import AddFlowConnectionForm from "./AddFlowConnectionForm";
import { resolveFlowPointAsset, useFlowAssetLookups } from "./flowPointResolution";
import * as api from "./logisticsFlowApi";
import { clearFlowSelection, loadLogisticsFlow, useLogisticsFlowState } from "./logisticsFlowStore";

/** Real detail + edit/delete for whichever flow point or connection is currently selected — honest "Nothing selected" state otherwise. Mirrors ManufacturingInspector.tsx's selection-branch shape. */
export default function LogisticsFlowInspector() {
  const { points, connections, selection } = useLogisticsFlowState();
  const updatePermission = usePermission("logistics", "update");
  const deletePermission = usePermission("logistics", "delete");
  const createPermission = usePermission("logistics", "create");
  const assetLookups = useFlowAssetLookups();

  const [showAddConnection, setShowAddConnection] = useState(false);
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [assetRef, setAssetRef] = useState("");
  const [relationship, setRelationship] = useState("");
  const [distanceMeters, setDistanceMeters] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPoint = selection?.kind === "point" ? points.find((p) => p.id === selection.id) : undefined;
  const selectedConnection = selection?.kind === "connection" ? connections.find((c) => c.id === selection.id) : undefined;

  useEffect(() => {
    setError(null);
    if (selectedPoint) {
      setStatus(selectedPoint.status ?? "");
      setNotes(selectedPoint.notes ?? "");
      setAssetRef(selectedPoint.assetRef ?? "");
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
        status: status.trim() || null,
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

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
              Status
            </label>
            <input type="text" className="w-full rounded border px-2 py-1.5 text-sm" value={status} onChange={(e) => setStatus(e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
              Asset Reference
            </label>
            <input type="text" className="w-full rounded border px-2 py-1.5 text-sm" value={assetRef} onChange={(e) => setAssetRef(e.target.value)} />
            {(selectedPoint.type === "load_assignment" || selectedPoint.type === "transportation_handoff") &&
              (() => {
                const resolved = resolveFlowPointAsset(selectedPoint.type, assetRef.trim() || null, assetLookups);
                return resolved ? (
                  <p className="mt-1 text-[0.65rem]" style={{ color: "var(--ff-text-muted)" }}>
                    Resolves to: {resolved}
                  </p>
                ) : null;
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
