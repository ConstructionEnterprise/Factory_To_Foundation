import { useEffect, useState } from "react";

import { useManufacturingOutput } from "@/context/ManufacturingOutputContext";
import { PanelCard, StatusBadge } from "@/framework/ui";
import { startCollisionMonitor, useCollisionSnapshot } from "@/features/factory/collisionStore";
import { constructionProjects } from "@/features/construction/constructionData";
import {
  listDrivers,
  listMileageTaxReport,
  listTrucks,
  type LogisticsDriver,
  type LogisticsTruck,
  type MileageTaxReportEntry,
} from "@/features/logistics/logisticsOperationsApi";

/**
 * Real document library — reads the same in-memory ManufacturingOutputContext
 * Factory's "Instructions" ribbon menu already reads (see
 * features/factory/FactoryInstructions.tsx), not a second store, plus the
 * live collision monitor's real run log (same singleton store Factory's
 * viewport indicator reads — one engine, two views of it). Neither is
 * persisted: a reload clears the instruction report and restarts the
 * collision log, and both say so rather than implying something broke.
 */

function EventTable({ events, showStatus }: { events: ReturnType<typeof useCollisionSnapshot>["events"]; showStatus: boolean }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left" style={{ color: "var(--ff-text-muted)" }}>
          <th className="py-1 pr-3 font-medium">Subsystems</th>
          <th className="py-1 pr-3 font-medium">Frames</th>
          <th className="py-1 pr-3 font-medium">Duration (ticks)</th>
          <th className="py-1 pr-3 font-medium">Max Penetration</th>
          {showStatus && <th className="py-1 font-medium">Status</th>}
        </tr>
      </thead>
      <tbody style={{ color: "var(--ff-text-primary)" }}>
        {events.map((ev) => (
          <tr key={ev.id} style={{ borderTop: "1px solid var(--ff-panel-border)" }}>
            <td className="py-1.5 pr-3 font-medium">
              {ev.a} × {ev.b}
            </td>
            <td className="py-1.5 pr-3">
              {ev.startFrame}–{ev.endFrame}
            </td>
            <td className="py-1.5 pr-3">
              {ev.endFrame - ev.startFrame} ({ev.samples} observed)
            </td>
            <td className="py-1.5 pr-3">{(ev.maxPenetration * 1000).toFixed(1)} mm</td>
            {showStatus && (
              <td className="py-1.5">
                {ev.ongoing ? (
                  <span className="font-semibold" style={{ color: "var(--ff-status-critical)" }}>
                    ONGOING
                  </span>
                ) : (
                  "ended"
                )}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CollisionReportCard() {
  const snap = useCollisionSnapshot();

  // Idempotent — monitoring may already be running if Factory's viewport
  // started it; opening Reports first also works.
  useEffect(() => {
    startCollisionMonitor();
  }, []);

  const persistent = snap.events.filter((e) => e.persistent);
  const transient = snap.events.filter((e) => !e.persistent);
  const ongoing = transient.filter((e) => e.ongoing).length;

  return (
    <PanelCard
      title="Collision Report — Live Twin Run"
      toolbar={
        <StatusBadge
          label={
            !snap.connected
              ? "Twin Bridge Offline"
              : ongoing > 0
                ? `${ongoing} Active Transient`
                : `${transient.length} Transient Event${transient.length === 1 ? "" : "s"}`
          }
          tone={!snap.connected ? "neutral" : ongoing > 0 ? "critical" : transient.length > 0 ? "warning" : "positive"}
        />
      }
    >
      <p className="mb-3 text-xs" style={{ color: "var(--ff-text-muted)" }}>
        Real geometric intersection testing (exact primitive math, not bounding boxes) against every state.json
        snapshot the twin writes (~135 ms apart), polled at 150 ms. Sim ticks between writes are genuinely
        unobserved — a transient faster than one write interval cannot appear here, and nothing is interpolated to
        pretend otherwise. Frames are the twin's own sim-tick counter. Log is in-memory for this session only.
      </p>

      {snap.lastFrame !== null && (
        <p className="mb-3 text-xs" style={{ color: "var(--ff-text-muted)" }}>
          Observing since frame{" "}
          <span className="font-medium" style={{ color: "var(--ff-text-primary)" }}>
            {snap.firstFrame}
          </span>{" "}
          · latest frame{" "}
          <span className="font-medium" style={{ color: "var(--ff-text-primary)" }}>
            {snap.lastFrame}
          </span>{" "}
          · {snap.checkedSnapshots} snapshots checked
        </p>
      )}

      <h3 className="mb-1 text-xs font-semibold" style={{ color: "var(--ff-text-primary)" }}>
        Transient Collision Events
      </h3>
      {transient.length === 0 ? (
        <p className="mb-4 text-sm" style={{ color: "var(--ff-text-primary)" }}>
          0 transient collision events observed
          {snap.checkedSnapshots > 0 ? ` across ${snap.checkedSnapshots} checked snapshots` : ""}.
          {snap.checkedSnapshots > 0 && (
            <span style={{ color: "var(--ff-text-muted)" }}>
              {" "}
              That is a real measured result, not an unmonitored blank — anything appearing here started AFTER
              monitoring began, i.e. real motion moved real geometry into contact.
            </span>
          )}
        </p>
      ) : (
        <div className="mb-4">
          <EventTable events={transient} showStatus />
        </div>
      )}

      {persistent.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-1 text-xs font-semibold" style={{ color: "var(--ff-text-primary)" }}>
            Persistent Contacts — held in every snapshot since monitoring began
          </h3>
          <p className="mb-2 text-[0.65rem]" style={{ color: "var(--ff-text-muted)" }}>
            By-construction conditions in the twin's own source geometry, measured, not assumed: the fixture
            tabletop rectangle overhangs the rails (each robot's vertical base link crosses its plane), parked
            robot bases overlap their ATC racks by a real 30 mm, and the ATC-far racks overlap the roller frame
            region by a real 50 mm — all directly from the twin's constants. Classified by observed behavior
            (continuous since first snapshot), not a hardcoded list: if one of these ever ends, it closes and
            moves to the transient log above.
          </p>
          <EventTable events={persistent} showStatus={false} />
        </div>
      )}

      {snap.robotPairStats.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-1 text-xs font-semibold" style={{ color: "var(--ff-text-primary)" }}>
            Robot-to-Robot Minimum Clearances (exact, closed-form arm-segment distances)
          </h3>
          <p className="mb-2 text-[0.65rem]" style={{ color: "var(--ff-text-muted)" }}>
            The twin has no real arm-link thickness (its linewidths are display pixels), so arm proximity is
            reported as the exact measured distance — no invented contact radius, no severity score.
          </p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left" style={{ color: "var(--ff-text-muted)" }}>
                <th className="py-1 pr-3 font-medium">Pair</th>
                <th className="py-1 pr-3 font-medium">Min Distance</th>
                <th className="py-1 font-medium">At Frame</th>
              </tr>
            </thead>
            <tbody style={{ color: "var(--ff-text-primary)" }}>
              {snap.robotPairStats.map((s) => (
                <tr key={s.pair} style={{ borderTop: "1px solid var(--ff-panel-border)" }}>
                  <td className="py-1.5 pr-3 font-medium">
                    {s.a} × {s.b}
                  </td>
                  <td className="py-1.5 pr-3">{s.minDistance.toFixed(3)} m</td>
                  <td className="py-1.5">{s.atFrame}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PanelCard>
  );
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * The real Mileage Tax Report (Phase 2 of the pilot mileage-tracking
 * feature) — reads the backend's own real per-trip eligibility gate and
 * effective-dated rate lookup (logisticsDispatchService.ts's
 * listTaxReportEntries()), never recomputes either client-side. Only
 * dispatches a Dispatcher explicitly pushed from Track Dispatches (real,
 * delivered, complete mileage + business purpose) appear here — this list
 * is never auto-populated from every dispatch that happens to have
 * odometer readings.
 */
function MileageTaxReportCard() {
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

  function handleExportCsv() {
    if (!entries || entries.length === 0) return;

    const header = ["Date", "Truck", "Destination", "Driver", "Business Purpose", "Odometer Start", "Odometer End", "Miles", "Rate ($/mi)", "Deduction ($)"];
    const rows = entries.map((e) => [
      new Date(e.dispatchedAt).toLocaleDateString(),
      truckLabel(e.truckId),
      projectLabel(e.destinationProjectId),
      driverLabel(e.driverId),
      e.businessPurpose,
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

export default function ReportsLibrary() {
  const { instructionSet } = useManufacturingOutput();
  const hasReport = !!instructionSet && instructionSet.steps.length > 0;

  if (!hasReport) {
    return (
      <div className="space-y-6">
        <MileageTaxReportCard />
        <CollisionReportCard />
        <PanelCard title="Generated Reports" toolbar={<StatusBadge label="0 Reports" tone="neutral" />}>
          <p className="text-sm" style={{ color: "var(--ff-text-muted)" }}>
            No reports generated yet — Manufacturing's Shop Drawings and{" "}
            <span className="font-medium" style={{ color: "var(--ff-text-primary)" }}>
              Generate Shop Drawings &amp; Instructions
            </span>{" "}
            actions populate this list. Reports are held in-memory for the current session only, the
            same as Factory's "Instructions" ribbon menu — reloading the page clears both.
          </p>
        </PanelCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <MileageTaxReportCard />
      <CollisionReportCard />
      <PanelCard title="Generated Reports" toolbar={<StatusBadge label="1 Report" tone="positive" />}>
        <div
          className="mb-3 rounded-[0.2rem] p-2 text-xs font-semibold"
          style={{ background: "var(--ff-status-warning)", color: "white" }}
        >
          Planning Draft — action text and durations are illustrative. Steps below with real
          dispatchable code are read-only here; use Factory's "Instructions" menu to Execute
          one, which always requires its own explicit click.
        </div>
        <div className="flex justify-between text-xs" style={{ color: "var(--ff-text-muted)" }}>
          <span>
            Source:{" "}
            <span className="font-medium" style={{ color: "var(--ff-text-primary)" }}>
              {instructionSet.sourceObjectId}
            </span>
          </span>
          <span>
            Generated:{" "}
            <span className="font-medium" style={{ color: "var(--ff-text-primary)" }}>
              {new Date(instructionSet.generatedAt).toLocaleString()}
            </span>
          </span>
          <span>
            Steps:{" "}
            <span className="font-medium" style={{ color: "var(--ff-text-primary)" }}>
              {instructionSet.steps.length}
            </span>
          </span>
        </div>
        {instructionSet.elementSpec && (
          <p className="mt-2 text-xs" style={{ color: "var(--ff-text-muted)" }}>
            Generated from the real shop-drawing sheet of{" "}
            <span className="font-medium" style={{ color: "var(--ff-text-primary)" }}>
              {instructionSet.elementSpec.name}
            </span>
            {instructionSet.elementSpec.orientationKind && ` (${instructionSet.elementSpec.orientationKind}-oriented element)`}.
          </p>
        )}
        {instructionSet.fabricationNotes?.map((note) => (
          <div
            key={note}
            className="mt-2 rounded-[0.2rem] p-2 text-xs"
            style={{
              border: "1px solid var(--ff-panel-border)",
              color: note.startsWith("Exceeds") ? "var(--ff-status-critical)" : "var(--ff-text-primary)",
            }}
          >
            {note}
          </div>
        ))}
      </PanelCard>

      <PanelCard title={`Instruction Sequence — ${instructionSet.sourceObjectId}`}>
        <ol className="space-y-2">
          {instructionSet.steps
            .slice()
            .sort((a, b) => a.sequence - b.sequence)
            .map((step) => (
              <li key={step.id} className="rounded-[0.2rem] p-3" style={{ border: "1px solid var(--ff-panel-border)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold" style={{ color: "var(--ff-accent)" }}>
                    Step {step.sequence}
                  </span>
                  <span
                    className="rounded-[0.2rem] px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase"
                    style={{ background: "var(--ff-status-neutral)", color: "white" }}
                  >
                    {step.status}
                  </span>
                </div>
                <p className="mt-1 text-sm" style={{ color: "var(--ff-text-primary)" }}>
                  {step.action}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-x-4 text-xs" style={{ color: "var(--ff-text-muted)" }}>
                  <span>
                    Target: <span className="font-medium">{step.targetSubsystemId}</span>
                  </span>
                  <span>
                    Real target: <span className="font-medium">{step.realCommandTarget}</span>
                  </span>
                  <span>
                    Type: <span className="font-medium">{step.targetType}</span>
                  </span>
                  {step.relatedObjectId && (
                    <span>
                      Object: <span className="font-medium">{step.relatedObjectId}</span>
                    </span>
                  )}
                </div>
                {step.reachabilityIssue && (
                  <div
                    className="mt-1.5 rounded-[0.2rem] p-1.5 text-xs"
                    style={{ background: "var(--ff-status-critical)", color: "white" }}
                  >
                    ⚠ {step.reachabilityIssue}
                  </div>
                )}
                {step.code && step.code.length > 0 && (
                  <pre
                    className="mt-1.5 overflow-x-auto rounded-[0.2rem] p-1.5 text-xs"
                    style={{ background: "var(--ff-chrome-bg)", color: "var(--ff-text-primary)" }}
                  >
                    {step.code.join("\n")}
                  </pre>
                )}
              </li>
            ))}
        </ol>
      </PanelCard>
    </div>
  );
}
