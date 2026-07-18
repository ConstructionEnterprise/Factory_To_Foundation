import { useManufacturingOutput } from "@/context/ManufacturingOutputContext";
import { PanelCard, StatusBadge } from "@/framework/ui";

/**
 * Real document library — reads the same in-memory ManufacturingOutputContext
 * Factory's "Instructions" ribbon menu already reads (see
 * features/factory/FactoryInstructions.tsx), not a second store. Genuinely
 * empty most of the time: nothing else in the app generates a document yet,
 * and the context isn't persisted, so a page reload clears it the same way
 * it clears Factory's own Instructions menu. An honest, explained empty
 * state instead of a generic "no reports" that implies something's broken.
 */
export default function ReportsLibrary() {
  const { instructionSet } = useManufacturingOutput();
  const hasReport = !!instructionSet && instructionSet.steps.length > 0;

  if (!hasReport) {
    return (
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
    );
  }

  return (
    <div className="space-y-6">
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
