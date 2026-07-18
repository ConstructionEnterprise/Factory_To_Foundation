import { useManufacturingOutput } from "@/context/ManufacturingOutputContext";

/**
 * Content for Factory's "Instructions" CommandRibbon dropdown — the third
 * menu type, deferred until a real cross-feature flow earned it (see
 * ManufacturingOutputContext). Read-only: Factory never writes here, only
 * displays whatever Manufacturing last generated, or an honest empty state.
 * Never shows a stale set from a previous ingested asset — the context is
 * in-memory only, so a page reload naturally clears it too.
 */
export default function FactoryInstructions() {
  const { instructionSet } = useManufacturingOutput();

  if (!instructionSet || instructionSet.steps.length === 0) {
    return (
      <div className="w-80 p-3 text-sm text-gray-400">
        No instructions yet — generate them from Manufacturing.
      </div>
    );
  }

  return (
    <div className="w-96 max-h-96 overflow-auto p-3">
      <div
        className="mb-3 rounded-[0.2rem] p-2 text-xs font-semibold"
        style={{ background: "var(--ff-status-warning)", color: "white" }}
      >
        Planning Draft — an illustrative planned sequence. Not real command_queue.json
        entries; nothing here executes or has ever been written to the twin.
      </div>

      <div className="mb-2 text-xs" style={{ color: "var(--ff-text-muted)" }}>
        Source: <span className="font-medium" style={{ color: "var(--ff-text-primary)" }}>{instructionSet.sourceObjectId}</span>
        {" · "}
        Generated {new Date(instructionSet.generatedAt).toLocaleTimeString()}
      </div>

      <ol className="space-y-2">
        {instructionSet.steps
          .slice()
          .sort((a, b) => a.sequence - b.sequence)
          .map((step) => (
            <li
              key={step.id}
              className="rounded-[0.2rem] p-2"
              style={{ border: "1px solid var(--ff-panel-border)" }}
            >
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
              <p className="mt-1 text-xs" style={{ color: "var(--ff-text-primary)" }}>{step.action}</p>
              <div className="mt-1.5 flex flex-wrap gap-x-3 text-[0.65rem]" style={{ color: "var(--ff-text-muted)" }}>
                <span>Target: <span className="font-medium">{step.targetSubsystemId}</span></span>
                <span>Real target: <span className="font-medium">{step.realCommandTarget}</span></span>
                <span>Type: <span className="font-medium">{step.targetType}</span></span>
                {step.relatedObjectId && <span>Object: <span className="font-medium">{step.relatedObjectId}</span></span>}
              </div>
            </li>
          ))}
      </ol>
    </div>
  );
}
