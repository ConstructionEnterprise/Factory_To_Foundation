import { useEffect, useState, type FormEvent } from "react";

import { usePermission } from "@/context/AuthContext";
import { constructionProjects } from "@/features/construction/constructionData";

import {
  createModule,
  listDispatches,
  listTrucks,
  type LogisticsDispatch,
  type LogisticsTruck,
} from "../logisticsOperationsApi";

type LogisticsModuleFormProps = {
  onClose: () => void;
  onCreated: () => void;
};

const UNASSIGNED = "";

/**
 * Real Module-creation form (Phase 8) — closes the same real gap Phase 6
 * flagged for LogisticsModule. A module can optionally be assigned to a
 * real existing Dispatch at creation time (staged in the Yard with a real
 * haul already lined up) or left unassigned (the honest default — most
 * modules sit in the Yard with no dispatch yet). Same provisional-modal
 * posture as the other Logistics creation forms.
 */
export default function LogisticsModuleForm({ onClose, onCreated }: LogisticsModuleFormProps) {
  const createPermission = usePermission("logistics", "create");

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [dispatchId, setDispatchId] = useState(UNASSIGNED);
  const [dispatches, setDispatches] = useState<LogisticsDispatch[]>([]);
  const [trucks, setTrucks] = useState<LogisticsTruck[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listDispatches(), listTrucks()])
      .then(([d, t]) => {
        setDispatches(d);
        setTrucks(t);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  function dispatchLabel(d: LogisticsDispatch): string {
    const truck = trucks.find((t) => t.id === d.truckId)?.identifier ?? "Unknown truck";
    const project = constructionProjects.find((p) => p.id === d.destinationProjectId)?.title ?? d.destinationProjectId;
    return `${truck} → ${project}`;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Enter a module name.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createModule({
        name: name.trim(),
        location: location.trim() || undefined,
        dispatchId: dispatchId || undefined,
      });
      onCreated();
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
            New Module
          </h2>
          <button type="button" onClick={onClose} className="text-sm" style={{ color: "var(--ff-text-muted)" }}>
            ✕
          </button>
        </div>
        <p className="mb-4 text-[0.7rem]" style={{ color: "var(--ff-text-muted)" }}>
          Real Yard record — creates a real LogisticsModule row.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
              Name
            </label>
            <input
              type="text"
              placeholder="e.g. Module M24-089"
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
              Location <span style={{ color: "var(--ff-text-muted)" }}>(optional, e.g. "Yard Row 3")</span>
            </label>
            <input
              type="text"
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
              Assigned Dispatch <span style={{ color: "var(--ff-text-muted)" }}>(optional)</span>
            </label>
            <select
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={dispatchId}
              onChange={(e) => setDispatchId(e.target.value)}
            >
              <option value={UNASSIGNED}>Unassigned — staged in the Yard</option>
              {dispatches.map((d) => (
                <option key={d.id} value={d.id}>
                  {dispatchLabel(d)}
                </option>
              ))}
            </select>
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
              {submitting ? "Creating…" : "Create Module"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
