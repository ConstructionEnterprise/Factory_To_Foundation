import { useEffect, useState, type FormEvent } from "react";

import { usePermission } from "@/context/AuthContext";

import { createMileageRate, listMileageRates, type MileageRate } from "../logisticsOperationsApi";

type MileageRateManagerProps = {
  onClose: () => void;
};

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Real, configurable IRS standard mileage rate manager (Phase 1 of the
 * pilot mileage-tracking feature). Deliberately NOT hardcoded anywhere in
 * application code — the IRS republishes this rate annually, and this is
 * the one real place a user enters it. Effective-dated: a real export
 * (Phase 2) applies whichever rate was actually in effect on a given trip's
 * own date, not just "the newest rate," per Publication 463's own
 * recordkeeping standard.
 *
 * No specific real-world rate is ever seeded or guessed here — this list
 * starts genuinely empty (see seed.ts's own "empty is honest" convention
 * for the rest of Logistics) until a real user enters a real published
 * rate.
 *
 * PROVISIONAL MOUNT POINT, same posture as every other Logistics modal in
 * this pass — rendered from LogisticsToolbar/LogisticsPage.
 */
export default function MileageRateManager({ onClose }: MileageRateManagerProps) {
  const updatePermission = usePermission("logistics", "update");

  const [rates, setRates] = useState<MileageRate[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [centsPerMile, setCentsPerMile] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function reload() {
    listMileageRates()
      .then(setRates)
      .catch((err) => setLoadError(describeError(err)));
  }

  useEffect(reload, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    const rate = Number(centsPerMile);
    if (!centsPerMile.trim() || !(rate > 0)) {
      setSubmitError("Enter a real positive rate, in cents per mile (e.g. 67 for $0.67/mi).");
      return;
    }
    if (!effectiveDate) {
      setSubmitError("Choose the real date this rate took effect.");
      return;
    }

    setSubmitting(true);
    try {
      await createMileageRate({
        centsPerMile: rate,
        effectiveDate: new Date(effectiveDate).toISOString(),
      });
      setCentsPerMile("");
      setEffectiveDate("");
      reload();
    } catch (err) {
      setSubmitError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-md p-6 shadow-xl"
        style={{ background: "var(--ff-content-bg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: "var(--ff-text-primary)" }}>
            Mileage Rate
          </h2>
          <button type="button" onClick={onClose} className="text-sm" style={{ color: "var(--ff-text-muted)" }}>
            ✕
          </button>
        </div>
        <p className="mb-4 text-[0.7rem]" style={{ color: "var(--ff-text-muted)" }}>
          Real, configurable — never hardcoded. The IRS standard mileage rate changes annually (sometimes mid-year);
          enter the real published rate and the real date it took effect. A real trip export applies whichever rate
          was actually in effect on that trip's own date.
        </p>

        {loadError && (
          <p className="mb-3 text-xs" style={{ color: "var(--ff-status-critical)" }}>
            Couldn't load existing rates ({loadError}).
          </p>
        )}

        <div className="mb-4 max-h-40 overflow-auto rounded border">
          {rates === null && !loadError && (
            <p className="p-3 text-xs" style={{ color: "var(--ff-text-muted)" }}>
              Loading…
            </p>
          )}
          {rates?.length === 0 && (
            <p className="p-3 text-xs" style={{ color: "var(--ff-text-muted)" }}>
              No real rate configured yet — add the current IRS standard mileage rate below.
            </p>
          )}
          {rates?.map((r) => (
            <div key={r.id} className="border-b px-3 py-2 text-xs last:border-b-0" style={{ color: "var(--ff-text-primary)" }}>
              <span className="font-medium">{(r.centsPerMile / 100).toFixed(3)} $/mi</span>
              <span style={{ color: "var(--ff-text-muted)" }}> — effective {new Date(r.effectiveDate).toLocaleDateString()}</span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
              Rate <span style={{ color: "var(--ff-text-muted)" }}>(cents per mile, e.g. 67 for $0.67/mi)</span>
            </label>
            <input
              type="number"
              min="0"
              step="any"
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={centsPerMile}
              onChange={(e) => setCentsPerMile(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
              Effective Date
            </label>
            <input
              type="date"
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
          </div>

          {submitError && (
            <p className="text-xs" style={{ color: "var(--ff-status-critical)" }}>
              {submitError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded px-3 py-1.5 text-sm" style={{ color: "var(--ff-text-secondary)" }}>
              Close
            </button>
            <button
              type="submit"
              disabled={!updatePermission.allowed || submitting}
              title={updatePermission.reason}
              className="rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              style={{ background: "var(--ff-accent)" }}
            >
              {submitting ? "Adding…" : "Add Rate"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
