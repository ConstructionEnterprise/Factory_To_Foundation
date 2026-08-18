import { useEffect, useState } from "react";

import { PanelCard, StatusBadge } from "@/framework/ui";
import { constructionProjects } from "@/features/construction/constructionData";
import {
  listDrivers,
  listMileageTaxReport,
  listTrucks,
  type LogisticsDriver,
  type LogisticsTruck,
  type MileageTaxReportEntry,
} from "@/features/logistics/logisticsOperationsApi";

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Real Mileage Tax Report (Phase 2 of the pilot mileage-tracking feature;
 * relocated into its own real Reports ribbon tab 2026-08-18) — reads the
 * backend's own real per-trip eligibility gate and effective-dated rate
 * lookup (logisticsDispatchService.ts's listTaxReportEntries()), never
 * recomputes either client-side. Only dispatches a Dispatcher explicitly
 * pushed from Track Dispatches (real, delivered, complete mileage +
 * business purpose) appear here — this list is never auto-populated from
 * every dispatch that happens to have odometer readings.
 */
export default function LogisticsReport() {
  const [entries, setEntries] = useState<MileageTaxReportEntry[] | null>(null);
  const [trucks, setTrucks] = useState<LogisticsTruck[]>([]);
  const [drivers, setDrivers] = useState<LogisticsDriver[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listMileageTaxReport(), listTrucks(), listDrivers()])
      .then(([e, t, d]) => {
        setEntries(e);
        setTrucks(t);
        setDrivers(d);
      })
      .catch((err) => setError(describeError(err)));
  }, []);

  const truckLabel = (id: string) => trucks.find((t) => t.id === id)?.identifier ?? id;
  const driverLabel = (id: string) => drivers.find((d) => d.id === id)?.name ?? id;
  const projectLabel = (id: string) => constructionProjects.find((p) => p.id === id)?.title ?? id;

  const totalMiles = entries?.reduce((sum, e) => sum + e.miles, 0) ?? 0;
  const ratedEntries = entries?.filter((e) => e.deductionCents !== null) ?? [];
  const totalDeductionCents = ratedEntries.reduce((sum, e) => sum + (e.deductionCents ?? 0), 0);
  const unratedCount = (entries?.length ?? 0) - ratedEntries.length;

  /** Real CSV escaping — a business purpose or a driver/truck name can genuinely contain a comma or a quote, so every field is quoted and internal quotes doubled, not just comma-joined. */
  function csvField(value: string): string {
    return `"${value.replace(/"/g, '""')}"`;
  }

  /**
   * Real CSV/formula-injection guard — businessPurpose (free text the
   * Dispatcher types directly) and the truck identifier/driver name (also
   * real user-entered free text, not fixture data) can genuinely start with
   * =, +, -, or @, which Excel/Sheets treats as a formula prefix on open.
   * Prefixing with a literal leading single quote forces the cell to be
   * read as text instead. Destination (projectLabel) is real static fixture
   * data from constructionData.ts, never user-entered, so it's excluded.
   */
  function preventFormulaInjection(value: string): string {
    return /^[=+\-@]/.test(value) ? `'${value}` : value;
  }

  function handleExportCsv() {
    if (!entries || entries.length === 0) return;

    const header = ["Date", "Truck", "Destination", "Driver", "Business Purpose", "Odometer Start", "Odometer End", "Miles", "Rate ($/mi)", "Deduction ($)"];
    const rows = entries.map((e) => [
      new Date(e.dispatchedAt).toLocaleDateString(),
      preventFormulaInjection(truckLabel(e.truckId)),
      projectLabel(e.destinationProjectId),
      preventFormulaInjection(driverLabel(e.driverId)),
      preventFormulaInjection(e.businessPurpose),
      String(e.odometerStart),
      String(e.odometerEnd),
      String(e.miles),
      e.rateCentsPerMile !== null ? (e.rateCentsPerMile / 100).toFixed(3) : "no rate configured",
      e.deductionCents !== null ? (e.deductionCents / 100).toFixed(2) : "",
    ]);
    const totalRow = ["", "", "", "", "Total", "", "", String(totalMiles), "", (totalDeductionCents / 100).toFixed(2)];

    const csv = [header, ...rows, totalRow].map((r) => r.map(csvField).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mileage-tax-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Real "PDF" via the browser's own print-to-PDF, not a fabricated direct
   * PDF download — no PDF-generation library exists anywhere in this
   * frontend, and the honest, dependency-free way to get a real PDF file
   * from the actual browser is its own print dialog's "Save as PDF"
   * destination. The scoped print stylesheet below isolates just this
   * card's real content (table + total), not the sidebar/ribbon/other
   * report cards, and hides the two export buttons themselves.
   */
  function handlePrint() {
    window.print();
  }

  return (
    <PanelCard
      title="Mileage Tax Report"
      className="h-full"
      bodyClassName="flex-1 overflow-auto p-5"
      toolbar={
        <StatusBadge
          label={entries ? `${entries.length} Trip${entries.length === 1 ? "" : "s"}` : "Loading…"}
          tone={entries && entries.length > 0 ? "positive" : "neutral"}
        />
      }
    >
      <p className="mb-3 text-xs" style={{ color: "var(--ff-text-muted)" }}>
        Real, odometer-based per-trip mileage log, matching IRS Publication 463's own recordkeeping standard (date,
        destination/business purpose, odometer readings, mileage). Populated only from dispatches explicitly pushed
        here — delivered, with complete mileage and a business purpose — via Track Dispatches' "Push to Tax Form"
        action, never every dispatch that merely has odometer readings. Each trip's deduction applies the real IRS
        standard mileage rate that was actually in effect on that trip's own date (Logistics' Mileage Rate manager),
        not whatever rate is current now.
      </p>

      {error && (
        <p className="mb-3 text-xs" style={{ color: "var(--ff-status-critical)" }}>
          Couldn't load the real Mileage Tax Report ({error}).
        </p>
      )}

      {entries === null && !error && (
        <p className="text-sm" style={{ color: "var(--ff-text-muted)" }}>
          Loading…
        </p>
      )}

      {entries?.length === 0 && (
        <p className="text-sm" style={{ color: "var(--ff-text-muted)" }}>
          No dispatches have been pushed to the tax report yet — a delivered dispatch with complete mileage and a
          business purpose gets a real "Push to Tax Form" action in Logistics' Track Dispatches.
        </p>
      )}

      {entries && entries.length > 0 && (
        <>
          <style>{`
            @media print {
              body * { visibility: hidden; }
              #mileage-tax-report-print, #mileage-tax-report-print * { visibility: visible; }
              #mileage-tax-report-print { position: absolute; left: 0; top: 0; width: 100%; }
            }
          `}</style>
          <div className="mb-2 flex gap-2 print:hidden">
            <button
              type="button"
              onClick={handleExportCsv}
              className="rounded px-2.5 py-1 text-[0.7rem] font-medium text-white"
              style={{ background: "var(--ff-accent)" }}
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="rounded px-2.5 py-1 text-[0.7rem] font-medium"
              style={{ border: "1px solid var(--ff-panel-border)", color: "var(--ff-text-primary)" }}
            >
              Print / Save as PDF
            </button>
          </div>
          <div id="mileage-tax-report-print">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left" style={{ color: "var(--ff-text-muted)" }}>
                  <th className="py-1 pr-3 font-medium">Date</th>
                  <th className="py-1 pr-3 font-medium">Truck → Destination</th>
                  <th className="py-1 pr-3 font-medium">Driver</th>
                  <th className="py-1 pr-3 font-medium">Business Purpose</th>
                  <th className="py-1 pr-3 font-medium">Odometer</th>
                  <th className="py-1 pr-3 font-medium">Miles</th>
                  <th className="py-1 pr-3 font-medium">Rate</th>
                  <th className="py-1 font-medium">Deduction</th>
                </tr>
              </thead>
              <tbody style={{ color: "var(--ff-text-primary)" }}>
                {entries.map((e) => (
                  <tr key={e.dispatchId} style={{ borderTop: "1px solid var(--ff-panel-border)" }}>
                    <td className="py-1.5 pr-3">{new Date(e.dispatchedAt).toLocaleDateString()}</td>
                    <td className="py-1.5 pr-3 font-medium">
                      {truckLabel(e.truckId)} → {projectLabel(e.destinationProjectId)}
                    </td>
                    <td className="py-1.5 pr-3">{driverLabel(e.driverId)}</td>
                    <td className="py-1.5 pr-3">{e.businessPurpose}</td>
                    <td className="py-1.5 pr-3">
                      {e.odometerStart} → {e.odometerEnd}
                    </td>
                    <td className="py-1.5 pr-3">{e.miles} mi</td>
                    <td className="py-1.5 pr-3">
                      {e.rateCentsPerMile !== null ? (
                        `${(e.rateCentsPerMile / 100).toFixed(3)} $/mi`
                      ) : (
                        <span style={{ color: "var(--ff-status-warning)" }}>No rate configured</span>
                      )}
                    </td>
                    <td className="py-1.5 font-medium">
                      {e.deductionCents !== null ? `$${(e.deductionCents / 100).toFixed(2)}` : "--"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            className="mt-3 flex justify-between border-t pt-2 text-xs font-semibold"
            style={{ borderColor: "var(--ff-panel-border)", color: "var(--ff-text-primary)" }}
          >
            <span>Total: {totalMiles} mi</span>
            <span>${(totalDeductionCents / 100).toFixed(2)}</span>
          </div>
          {unratedCount > 0 && (
            <p className="mt-1 text-[0.65rem]" style={{ color: "var(--ff-status-warning)" }}>
              {unratedCount} trip{unratedCount === 1 ? "" : "s"} excluded from the total deduction above — no real
              rate was configured yet for that trip's date. Add the missing rate in Logistics' Mileage Rate manager.
            </p>
          )}
          </div>
        </>
      )}
    </PanelCard>
  );
}
