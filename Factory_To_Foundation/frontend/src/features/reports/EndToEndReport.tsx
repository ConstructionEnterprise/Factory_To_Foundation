import { useEffect, useState } from "react";

import { PanelCard, StatusBadge } from "@/framework/ui";
import { STATUS_LABEL as SEQUENCE_STATUS_LABEL } from "@/features/construction/Sequencing/SequencingPanel";
import { fetchUnitLifecycleReport, type UnitLifecycleRow } from "./reportsApi";

type OverallState = "complete" | "blocked" | "qc_failed" | "in_progress";

/**
 * Real overall classification -- derived purely from this row's own real
 * fields, never a separately stored status. Distinguishes "genuinely
 * stopped for a real reason" (qc_failed, blocked) from "just hasn't
 * reached that stage yet" (in_progress) -- collapsing both into one dash
 * was a real reporting defect this session's own investigation surfaced
 * (a QC-failed unit and an early-stage unit rendered identically).
 */
function overallState(r: UnitLifecycleRow): OverallState {
  if (r.endToEndComplete) return "complete";
  if (r.qcStatus === "failed") return "qc_failed";
  if (r.sequenceBlocked) return "blocked";
  return "in_progress";
}

const OVERALL_LABEL: Record<OverallState, string> = {
  complete: "✓ Complete",
  blocked: "🟡 Blocked",
  qc_failed: "QC Failed",
  in_progress: "—",
};

const OVERALL_COLOR: Record<OverallState, string> = {
  complete: "var(--ff-status-positive)",
  blocked: "var(--ff-status-warning)",
  qc_failed: "var(--ff-status-critical)",
  in_progress: "var(--ff-text-muted)",
};

/**
 * Real End-to-End Unit Lifecycle report (Reports rebuild, 2026-08-18;
 * vocabulary extended same day after a real investigation into why
 * CW-WP-B-0001/0002 weren't reaching completion -- see this session's own
 * findings). Per-unit, not per-run: every real completed ProductionOutput
 * across the whole app, showing exactly where its real chain currently
 * stands and, when it's genuinely stopped, why -- a real QC failure or a
 * real incomplete blocking dependency, never inferred, always read
 * straight off the same records the Sequencing/Logistics/Manufacturing
 * domains themselves are authoritative for. No fabricated "green line."
 * No project-level completion percentage here -- that needs real backend
 * aggregation not built yet (see
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

  const states = rows?.map(overallState) ?? [];
  const completeCount = states.filter((s) => s === "complete").length;
  const blockedCount = states.filter((s) => s === "blocked").length;
  const qcFailedCount = states.filter((s) => s === "qc_failed").length;

  return (
    <PanelCard
      title="End-to-End Manufactured Unit Lifecycle"
      className="h-full"
      bodyClassName="flex-1 overflow-auto p-5"
      toolbar={
        rows && (
          <div className="flex gap-2">
            <StatusBadge label={`${completeCount} / ${rows.length} Complete`} tone={completeCount === rows.length && rows.length > 0 ? "positive" : "neutral"} />
            {blockedCount > 0 && <StatusBadge label={`${blockedCount} Blocked`} tone="warning" />}
            {qcFailedCount > 0 && <StatusBadge label={`${qcFailedCount} QC Failed`} tone="critical" />}
          </div>
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
        <>
          {/* Real scope disclosure -- this report's denominator is real Factory-produced units traceable downstream (ProductionOutput -> LogisticsModule -> LogisticsDispatch -> ModuleSequenceEntry), not every real ModuleSequenceEntry that exists (Construction's own Sequencing screen counts that broader population -- e.g. project-wide "5/6 modules complete" -- a real, legitimately different number, not a discrepancy). Stated explicitly so the two real counts are never mistaken for measuring the same thing. */}
          <p className="mb-3 text-xs" style={{ color: "var(--ff-text-muted)" }}>
            {rows.length} real Factory production output{rows.length === 1 ? "" : "s"} currently traced across the
            full operational chain — not every real module in Construction's own Sequencing count, which includes
            modules with no known Factory production lineage.
          </p>
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
              {rows.map((r) => {
                const overall = overallState(r);
                return (
                  <tr key={r.productionOutputId} style={{ borderBottom: "1px solid var(--ff-content-bg)" }}>
                    <td className="py-2 pr-4 font-semibold" style={{ color: "var(--ff-text-primary)" }}>
                      {r.serialNumber}
                    </td>
                    <td className="py-2 pr-4" style={{ color: "var(--ff-status-positive)" }}>
                      ✓ Complete
                    </td>
                    <td className="py-2 pr-4" style={{ color: r.logisticsModuleId ? "var(--ff-status-positive)" : r.qcStatus === "failed" ? "var(--ff-status-critical)" : "var(--ff-text-muted)" }}>
                      {r.logisticsModuleId
                        ? "✓ Handed off"
                        : r.qcStatus === "failed"
                          ? "❌ QC Failed"
                          : r.qcStatus === "pending"
                            ? "QC Pending"
                            : "Not started"}
                    </td>
                    <td className="py-2 pr-4" style={{ color: r.dispatchStatus === "delivered" ? "var(--ff-status-positive)" : "var(--ff-text-muted)" }}>
                      {r.dispatchStatus ? (r.dispatchStatus === "delivered" ? "✓ Delivered" : r.dispatchStatus) : "—"}
                    </td>
                    <td className="py-2 pr-4" style={{ color: r.sequenceStatus === "complete" ? "var(--ff-status-positive)" : r.sequenceBlocked ? "var(--ff-status-warning)" : "var(--ff-text-muted)" }}>
                      {r.sequenceBlocked
                        ? `🟡 Blocked${r.blockedByLabel ? ` — waiting on ${r.blockedByLabel}` : ""}`
                        : r.sequenceStatus
                          ? SEQUENCE_STATUS_LABEL[r.sequenceStatus]
                          : "Not yet sequenced"}
                    </td>
                    <td className="py-2 pr-4 font-semibold" style={{ color: OVERALL_COLOR[overall] }}>
                      {OVERALL_LABEL[overall]}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </>
      )}
    </PanelCard>
  );
}
