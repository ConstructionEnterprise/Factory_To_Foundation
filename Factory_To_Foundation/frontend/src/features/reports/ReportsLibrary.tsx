import { useEffect } from "react";

import { useManufacturingOutput } from "@/context/ManufacturingOutputContext";
import { PanelCard, StatusBadge } from "@/framework/ui";
import { startCollisionMonitor, useCollisionSnapshot } from "@/features/factory/collisionStore";

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

export default function ReportsLibrary() {
  const { instructionSet } = useManufacturingOutput();
  const hasReport = !!instructionSet && instructionSet.steps.length > 0;

  if (!hasReport) {
    return (
      <div className="space-y-6">
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
      <CollisionReportCard />
      <PanelCard title="Generated Reports" toolbar={<StatusBadge label="1 Report" tone="positive" />}>
        <div
          className="mb-3 rounded-[0.2rem] p-2 text-xs font-semibold"
          style={{ background: "var(--ff-status-warning)", color: "white" }}
        >
          Planning Draft — an illustrative planned sequence. Not real command_queue.json entries;
          nothing here executes or has ever been written to the twin.
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
              </li>
            ))}
        </ol>
      </PanelCard>
    </div>
  );
}
