import { useState, type FormEvent } from "react";

import { usePermission } from "@/context/AuthContext";

import { createFlowPoint, SUGGESTED_FLOW_POINT_TYPES } from "./logisticsFlowApi";
import { loadLogisticsFlow } from "./logisticsFlowStore";

const CUSTOM_TYPE_OPTION = "__custom__";

type AddFlowPointFormProps = { onClose: () => void };

/**
 * Real FlowPoint-creation form, same provisional-modal styling as
 * LogisticsMaterialForm.tsx. `type` offers the suggested vocabulary
 * (logisticsFlowApi.ts's SUGGESTED_FLOW_POINT_TYPES) plus a free-text
 * "Custom…" fallback — never enforced as a closed set, matching the real
 * architecture decision behind this whole feature.
 */
export default function AddFlowPointForm({ onClose }: AddFlowPointFormProps) {
  const createPermission = usePermission("logistics", "create");

  const [typeChoice, setTypeChoice] = useState<string>(SUGGESTED_FLOW_POINT_TYPES[0]);
  const [customType, setCustomType] = useState("");
  const [name, setName] = useState("");
  const [assetRef, setAssetRef] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedType = typeChoice === CUSTOM_TYPE_OPTION ? customType.trim() : typeChoice;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Enter a point name.");
      return;
    }
    if (!resolvedType) {
      setError("Enter a type.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createFlowPoint({
        type: resolvedType,
        name: name.trim(),
        // A new point starts near the map's origin, spread slightly so
        // several new points don't stack exactly on top of each other —
        // real position is then whatever the user drags it to afterward.
        positionX: Math.round(Math.random() * 300),
        positionY: Math.round(Math.random() * 200),
        assetRef: assetRef.trim() || undefined,
        status: status.trim() || undefined,
      });
      await loadLogisticsFlow();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
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
            New Flow Point
          </h2>
          <button type="button" onClick={onClose} className="text-sm" style={{ color: "var(--ff-text-muted)" }}>
            ✕
          </button>
        </div>
        <p className="mb-4 text-[0.7rem]" style={{ color: "var(--ff-text-muted)" }}>
          Real record — creates a real FlowPoint row.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
              Name
            </label>
            <input
              type="text"
              placeholder="e.g. Stud Rack, CR6 Framing Cell"
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
              Type
            </label>
            <select
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={typeChoice}
              onChange={(e) => setTypeChoice(e.target.value)}
            >
              {SUGGESTED_FLOW_POINT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              <option value={CUSTOM_TYPE_OPTION}>Custom…</option>
            </select>
            {typeChoice === CUSTOM_TYPE_OPTION && (
              <input
                type="text"
                placeholder="Custom type"
                className="mt-2 w-full rounded border px-2 py-1.5 text-sm"
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
              />
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
              Asset Reference <span style={{ color: "var(--ff-text-muted)" }}>(optional — an id from the Engineering Asset Catalog or elsewhere)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. ce-integrated-cell-v3-0-6"
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={assetRef}
              onChange={(e) => setAssetRef(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
              Status <span style={{ color: "var(--ff-text-muted)" }}>(optional)</span>
            </label>
            <input
              type="text"
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
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
              {submitting ? "Creating…" : "Create Point"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
