import { useEffect, useState, type FormEvent } from "react";

import { usePermission } from "@/context/AuthContext";
import { constructionProjects } from "@/features/construction/constructionData";

import { listDispatches, listTrucks, type LogisticsDispatch, type LogisticsTruck } from "../logisticsOperationsApi";
import { resolveFlowPointAsset } from "./flowPointResolution";
import { createFlowPoint, SUGGESTED_FLOW_POINT_TYPES } from "./logisticsFlowApi";
import { loadLogisticsFlow, useLogisticsFlowState } from "./logisticsFlowStore";

function projectTitle(id: string): string {
  return constructionProjects.find((p) => p.id === id)?.title ?? id;
}

const CUSTOM_TYPE_OPTION = "__custom__";

type AddFlowPointFormProps = { onClose: () => void };

/**
 * Real FlowPoint-creation form, same provisional-modal styling as
 * LogisticsMaterialForm.tsx. `type` offers the suggested vocabulary
 * (logisticsFlowApi.ts's SUGGESTED_FLOW_POINT_TYPES) plus a free-text
 * "Custom…" fallback — never enforced as a closed set, matching the real
 * architecture decision behind this whole feature.
 *
 * `load_assignment`/`transportation_handoff` are the two types with a real
 * cross-domain reference (see flowPointResolution.ts) — for those, Asset
 * Reference becomes a real picker over the real LogisticsTruck/
 * LogisticsDispatch list (same fetch-on-mount pattern as
 * LogisticsDispatchForm.tsx's truck/driver pickers) instead of free text,
 * so the id is always a real row, never typed/guessed.
 */
export default function AddFlowPointForm({ onClose }: AddFlowPointFormProps) {
  const createPermission = usePermission("logistics", "create");
  const { flows } = useLogisticsFlowState();

  const [flowId, setFlowId] = useState<string>(flows[0]?.id ?? "");
  const [typeChoice, setTypeChoice] = useState<string>(SUGGESTED_FLOW_POINT_TYPES[0]);
  const [customType, setCustomType] = useState("");
  const [name, setName] = useState("");
  const [assetRef, setAssetRef] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [trucks, setTrucks] = useState<LogisticsTruck[]>([]);
  const [dispatches, setDispatches] = useState<LogisticsDispatch[]>([]);
  const [refLoadError, setRefLoadError] = useState<string | null>(null);

  const resolvedType = typeChoice === CUSTOM_TYPE_OPTION ? customType.trim() : typeChoice;
  const needsTruckPicker = resolvedType === "load_assignment";
  const needsDispatchPicker = resolvedType === "transportation_handoff";

  useEffect(() => {
    if (!needsTruckPicker && !needsDispatchPicker) return;
    Promise.all([listTrucks(), listDispatches()])
      .then(([truckRows, dispatchRows]) => {
        setTrucks(truckRows);
        setDispatches(dispatchRows);
      })
      .catch((err) => setRefLoadError(err instanceof Error ? err.message : String(err)));
  }, [needsTruckPicker, needsDispatchPicker]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!flowId) {
      setError("Select a real Logistics Flow.");
      return;
    }
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
        flowId,
        type: resolvedType,
        name: name.trim(),
        // A new point starts near the map's origin, spread slightly so
        // several new points don't stack exactly on top of each other —
        // real position is then whatever the user drags it to afterward.
        positionX: Math.round(Math.random() * 300),
        positionY: Math.round(Math.random() * 200),
        assetRef: assetRef.trim() || undefined,
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
              Logistics Flow <span style={{ color: "var(--ff-text-muted)" }}>(the real project this point belongs to)</span>
            </label>
            {flows.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--ff-status-critical)" }}>
                No real Logistics Flow exists yet — create one before adding points.
              </p>
            ) : (
              <select className="w-full rounded border px-2 py-1.5 text-sm" value={flowId} onChange={(e) => setFlowId(e.target.value)}>
                {flows.map((f) => (
                  <option key={f.id} value={f.id}>
                    {projectTitle(f.constructionProjectId)} — {f.name}
                  </option>
                ))}
              </select>
            )}
          </div>

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
              {needsTruckPicker
                ? "Truck"
                : needsDispatchPicker
                  ? "Dispatch"
                  : "Asset Reference"}{" "}
              <span style={{ color: "var(--ff-text-muted)" }}>
                {needsTruckPicker
                  ? "(optional — the real truck this asset is assigned to)"
                  : needsDispatchPicker
                    ? "(optional — the real dispatch handing this asset to Transportation)"
                    : "(optional — an id from the Engineering Asset Catalog or elsewhere)"}
              </span>
            </label>
            {refLoadError && (
              <p className="mb-1 text-xs" style={{ color: "var(--ff-status-critical)" }}>
                Couldn't load real trucks/dispatches ({refLoadError}).
              </p>
            )}
            {needsTruckPicker ? (
              <select className="w-full rounded border px-2 py-1.5 text-sm" value={assetRef} onChange={(e) => setAssetRef(e.target.value)}>
                <option value="">— none —</option>
                {trucks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.identifier}
                  </option>
                ))}
              </select>
            ) : needsDispatchPicker ? (
              <select className="w-full rounded border px-2 py-1.5 text-sm" value={assetRef} onChange={(e) => setAssetRef(e.target.value)}>
                <option value="">— none —</option>
                {dispatches.map((d) => (
                  <option key={d.id} value={d.id}>
                    {resolveFlowPointAsset("transportation_handoff", d.id, { trucks, dispatches })}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="e.g. ce-integrated-cell-v3-0-6"
                className="w-full rounded border px-2 py-1.5 text-sm"
                value={assetRef}
                onChange={(e) => setAssetRef(e.target.value)}
              />
            )}
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
