import { useState, type FormEvent } from "react";

import { usePermission } from "@/context/AuthContext";

import { createMaterial } from "../logisticsOperationsApi";

type LogisticsMaterialFormProps = {
  onClose: () => void;
  onCreated: () => void;
};

/**
 * Real Material-creation form (Phase 8) — closes the same real gap Phase 6
 * flagged (LogisticsMaterial had schema + zero routes since Phase 4): the
 * real Storage Browse zone needs a real way to put something in it. Same
 * provisional-modal posture as LogisticsDispatchForm/Tracker — a minimal
 * entry point, superseded once the real Browse Logistics panel's own
 * create affordance (if any) lands as part of a later, more complete pass.
 */
export default function LogisticsMaterialForm({ onClose, onCreated }: LogisticsMaterialFormProps) {
  const createPermission = usePermission("logistics", "create");

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Enter a material name.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createMaterial({
        name: name.trim(),
        quantity: quantity.trim() ? Number(quantity) : undefined,
        location: location.trim() || undefined,
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
            New Material
          </h2>
          <button type="button" onClick={onClose} className="text-sm" style={{ color: "var(--ff-text-muted)" }}>
            ✕
          </button>
        </div>
        <p className="mb-4 text-[0.7rem]" style={{ color: "var(--ff-text-muted)" }}>
          Real Storage record — creates a real LogisticsMaterial row.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
              Name
            </label>
            <input
              type="text"
              placeholder="e.g. Fastener Pallet"
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
              Quantity <span style={{ color: "var(--ff-text-muted)" }}>(optional)</span>
            </label>
            <input
              type="number"
              min={1}
              step={1}
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
              Location <span style={{ color: "var(--ff-text-muted)" }}>(optional, e.g. "Bay A")</span>
            </label>
            <input
              type="text"
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
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
              {submitting ? "Creating…" : "Create Material"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
