import { useState, type FormEvent } from "react";

import { usePermission } from "@/context/AuthContext";

import { createFlowConnection } from "./logisticsFlowApi";
import { loadLogisticsFlow, useLogisticsFlowState } from "./logisticsFlowStore";

type AddFlowConnectionFormProps = { onClose: () => void };

/** Real FlowConnection-creation form — source/target pickers populated from the real points already loaded, same provisional-modal styling as AddFlowPointForm. */
export default function AddFlowConnectionForm({ onClose }: AddFlowConnectionFormProps) {
  const createPermission = usePermission("logistics", "create");
  const { points } = useLogisticsFlowState();

  const [sourcePointId, setSourcePointId] = useState(points[0]?.id ?? "");
  const [targetPointId, setTargetPointId] = useState(points[1]?.id ?? points[0]?.id ?? "");
  const [relationship, setRelationship] = useState("");
  const [distanceMeters, setDistanceMeters] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!sourcePointId || !targetPointId) {
      setError("Choose both a source and a target point.");
      return;
    }
    if (sourcePointId === targetPointId) {
      setError("Source and target must be different points.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createFlowConnection({
        sourcePointId,
        targetPointId,
        relationship: relationship.trim() || undefined,
        distanceMeters: distanceMeters.trim() ? Number(distanceMeters) : undefined,
      });
      await loadLogisticsFlow();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (points.length < 2) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
        <div
          className="w-full max-w-sm rounded-md p-6 shadow-xl"
          style={{ background: "var(--ff-content-bg)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-sm" style={{ color: "var(--ff-text-secondary)" }}>
            Add at least two flow points before connecting them.
          </p>
          <div className="flex justify-end pt-4">
            <button type="button" onClick={onClose} className="rounded px-3 py-1.5 text-sm" style={{ color: "var(--ff-text-secondary)" }}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-md p-6 shadow-xl"
        style={{ background: "var(--ff-content-bg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: "var(--ff-text-primary)" }}>
            New Connection
          </h2>
          <button type="button" onClick={onClose} className="text-sm" style={{ color: "var(--ff-text-muted)" }}>
            ✕
          </button>
        </div>
        <p className="mb-4 text-[0.7rem]" style={{ color: "var(--ff-text-muted)" }}>
          Real, directed record — creates a real FlowConnection row from source to target.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
              Source
            </label>
            <select className="w-full rounded border px-2 py-1.5 text-sm" value={sourcePointId} onChange={(e) => setSourcePointId(e.target.value)}>
              {points.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
              Target
            </label>
            <select className="w-full rounded border px-2 py-1.5 text-sm" value={targetPointId} onChange={(e) => setTargetPointId(e.target.value)}>
              {points.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
              Relationship <span style={{ color: "var(--ff-text-muted)" }}>(optional, e.g. "material-transfer")</span>
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
              Distance (meters) <span style={{ color: "var(--ff-text-muted)" }}>(optional)</span>
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

          {error && (
            <p className="text-xs" style={{ color: "var(--ff-status-critical)" }}>
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded px-3 py-1.5 text-sm" style={{ color: "var(--ff-text-secondary)" }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={!createPermission.allowed || submitting}
              title={createPermission.reason}
              className="rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              style={{ background: "var(--ff-accent)" }}
            >
              {submitting ? "Creating…" : "Create Connection"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
