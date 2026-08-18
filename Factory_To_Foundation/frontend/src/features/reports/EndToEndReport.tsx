import { useEffect, useState } from "react";

import { PanelCard, StatusBadge } from "@/framework/ui";
import { STATUS_LABEL as SEQUENCE_STATUS_LABEL } from "@/features/construction/Sequencing/SequencingPanel";
import { fetchUnitLifecycleReport, type UnitLifecycleRow } from "./reportsApi";

/**
 * Real End-to-End Unit Lifecycle report (Reports rebuild, 2026-08-18) --
 * per-unit, not per-run: every real completed ProductionOutput across the
 * whole app, showing exactly where its real chain currently stands
 * (Logistics/Transportation/Modular Sequence). No fabricated "green line"
 * -- a null field renders as an honest dash, never inferred from a
 * sibling field. No project-level completion percentage here -- that
 * needs real backend aggregation not built yet (see
 * docs/decisions/2026-08-18-reports-domain-audit-and-taxonomy.md §4).
 */
export default function EndToEndReport() {
  const [rows, setRows] = useState<UnitLifecycleRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUnitLifecycleReport()
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load the real unit lifecycle report"));
  }, []);

  const completeCount = rows?.filter((r) => r.endToEndComplete).length ?? 0;

  return (
    <PanelCard
      title="End-to-End Unit Lifecycle"
      className="h-full"
      bodyClassName="flex-1 overflow-auto p-5"
      toolbar={
        rows && (
          <StatusBadge
            label={`${completeCount} / ${rows.length} Complete`}
            tone={completeCount === rows.length && rows.length > 0 ? "positive" : "neutral"}
          />
        )
      }
    >
      {error && (
        <p className="mb-3 text-sm" style={{ color: "var(--ff-status-critical)" }}>
          {error}
        </p>
      )}

      {!rows && !error && (
        <p className="text-sm" style={{ color: "var(--ff-text-muted)" }}>
          Loading real units…
        </p>
      )}

      {rows && rows.length === 0 && (
        <p className="text-sm" style={{ color: "var(--ff-text-muted)" }}>
          No real completed production outputs yet.
        </p>
      )}

      {rows && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr style={{ borderBottom: "2px solid var(--ff-panel-border)" }}>
                {["Unit", "Factory", "Logistics", "Transportation", "Modular Sequence", "Overall"].map((h) => (
                  <th key={h} className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ff-text-muted)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.productionOutputId} style={{ borderBottom: "1px solid var(--ff-content-bg)" }}>
                  <td className="py-2 pr-4 font-semibold" style={{ color: "var(--ff-text-primary)" }}>
                    {r.serialNumber}
                  </td>
                  <td className="py-2 pr-4" style={{ color: "var(--ff-status-positive)" }}>
                    ✓ Complete
                  </td>
                  <td className="py-2 pr-4" style={{ color: r.logisticsModuleId ? "var(--ff-status-positive)" : "var(--ff-text-muted)" }}>
                    {r.logisticsModuleId ? "✓ Handed off" : "Not started"}
                  </td>
                  <td className="py-2 pr-4" style={{ color: r.dispatchStatus === "delivered" ? "var(--ff-status-positive)" : "var(--ff-text-muted)" }}>
                    {r.dispatchStatus ? (r.dispatchStatus === "delivered" ? "✓ Delivered" : r.dispatchStatus) : "—"}
                  </td>
                  <td className="py-2 pr-4" style={{ color: r.sequenceStatus === "complete" ? "var(--ff-status-positive)" : "var(--ff-text-muted)" }}>
                    {r.sequenceStatus ? SEQUENCE_STATUS_LABEL[r.sequenceStatus] : "Not yet sequenced"}
                  </td>
                  <td className="py-2 pr-4 font-semibold" style={{ color: r.endToEndComplete ? "var(--ff-status-positive)" : "var(--ff-text-muted)" }}>
                    {r.endToEndComplete ? "✓" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PanelCard>
  );
}
