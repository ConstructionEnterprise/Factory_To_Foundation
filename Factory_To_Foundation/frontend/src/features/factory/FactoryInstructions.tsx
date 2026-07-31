import { useState } from "react";

import { useManufacturingOutput, type InstructionSet, type InstructionStep } from "@/context/ManufacturingOutputContext";
import { usePermission } from "@/context/AuthContext";
import { useTwinState } from "./useTwinState";
import { executeStep, type StepExecutionResult } from "./twinExecute";
import { logInstructionExecution } from "./instructionExecutionsApi";

/**
 * Content for Factory's "Instructions" CommandRibbon dropdown — the third
 * menu type, deferred until a real cross-feature flow earned it (see
 * ManufacturingOutputContext). Read-only display of whatever Manufacturing
 * last generated, plus (Track B, Phase B4) a real, explicitly human-
 * triggered Execute action per step — Option 1 from Phase B3's decision:
 * generate only, manual dispatch, no batch auto-run. Never shows a stale
 * set from a previous ingested asset — the context is in-memory only, so a
 * page reload naturally clears it too.
 */
export default function FactoryInstructions() {
  const { instructionSet } = useManufacturingOutput();
  const { connected, state } = useTwinState();
  // Phase 3c — UX/honesty gating only. twin-bridge (localhost:4100), which
  // this Execute click actually dispatches to, has NO auth of its own —
  // disabling this button is the entire extent of any protection here.
  // Checked last, after every real twin-state precondition, so the banner
  // never claims a permission problem when the twin itself isn't even in a
  // dispatchable state yet.
  const executePermission = usePermission("factory", "execute");

  if (!instructionSet || instructionSet.steps.length === 0) {
    return (
      <div className="w-80 p-3 text-sm text-gray-400">
        No instructions yet — generate them from Manufacturing.
      </div>
    );
  }

  const canExecute = connected && state?.mode === "MANUAL" && state?.paused === true && executePermission.allowed;
  const gateReason = !connected
    ? "Twin bridge not reachable — Execute is unavailable until it's running."
    : state?.mode !== "MANUAL"
      ? `Twin is in ${state?.mode ?? "an unknown"} mode — set it to MANUAL to execute a step.`
      : !state?.paused
        ? "Twin is not paused — pause it before executing a manual command."
        : !executePermission.allowed
          ? executePermission.reason
          : null;

  return (
    <div className="w-[28rem] max-h-96 overflow-auto p-3">
      <div
        className="mb-3 rounded-[0.2rem] p-2 text-xs font-semibold"
        style={{ background: "var(--ff-status-warning)", color: "white" }}
      >
        Planning Draft — action text and durations are illustrative. A step with real
        dispatchable code below can be sent to the real twin only via its own Execute
        click, one step at a time. Nothing here runs automatically.
      </div>

      {gateReason && (
        <div
          className="mb-3 rounded-[0.2rem] p-2 text-xs"
          style={{ border: "1px solid var(--ff-panel-border)", color: "var(--ff-text-muted)" }}
        >
          {gateReason}
        </div>
      )}

      <div className="mb-2 text-xs" style={{ color: "var(--ff-text-muted)" }}>
        Source: <span className="font-medium" style={{ color: "var(--ff-text-primary)" }}>{instructionSet.sourceObjectId}</span>
        {" · "}
        Generated {new Date(instructionSet.generatedAt).toLocaleTimeString()}
      </div>

      {instructionSet.fabricationNotes?.map((note) => (
        <div
          key={note}
          className="mb-2 rounded-[0.2rem] p-2 text-xs"
          style={{
            border: "1px solid var(--ff-panel-border)",
            color: note.startsWith("Exceeds") ? "var(--ff-status-critical)" : "var(--ff-text-primary)",
          }}
        >
          {note}
        </div>
      ))}

      <ol className="space-y-2">
        {instructionSet.steps
          .slice()
          .sort((a, b) => a.sequence - b.sequence)
          .map((step) => (
            <InstructionStepRow key={step.id} instructionSet={instructionSet} step={step} canExecute={canExecute} />
          ))}
      </ol>
    </div>
  );
}

function InstructionStepRow({
  instructionSet,
  step,
  canExecute,
}: {
  instructionSet: InstructionSet;
  step: InstructionStep;
  canExecute: boolean;
}) {
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<StepExecutionResult | null>(null);

  async function handleExecute() {
    setExecuting(true);
    setResult(null);
    const r = await executeStep(step);
    setResult(r);
    setExecuting(false);
    // Real audit-trail write — logs both a success and a failure, fire-
    // and-forget from the UI's point of view (see instructionExecutionsApi's
    // own doc comment on why a logging failure never blocks/alarms here).
    void logInstructionExecution(instructionSet, step, r);
  }

  return (
    <li className="rounded-[0.2rem] p-2" style={{ border: "1px solid var(--ff-panel-border)" }}>
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

      {step.reachabilityIssue && (
        <div
          className="mt-1.5 rounded-[0.2rem] p-1.5 text-[0.65rem]"
          style={{ background: "var(--ff-status-critical)", color: "white" }}
        >
          ⚠ {step.reachabilityIssue}
        </div>
      )}

      {step.code && step.code.length > 0 && (
        <pre
          className="mt-1.5 overflow-x-auto rounded-[0.2rem] p-1.5 text-[0.65rem]"
          style={{ background: "var(--ff-chrome-bg)", color: "var(--ff-text-primary)" }}
        >
          {step.code.join("\n")}
        </pre>
      )}

      {step.dispatch && step.dispatch.length > 0 && (
        <div className="mt-1.5 flex items-center gap-2">
          <button
            type="button"
            disabled={!canExecute || executing}
            onClick={handleExecute}
            className="rounded-[0.2rem] px-2 py-1 text-[0.65rem] font-semibold text-white disabled:opacity-40"
            style={{ background: "var(--ff-accent)" }}
          >
            {executing ? "Executing…" : "Execute"}
          </button>
          {result && (
            <span
              className="text-[0.65rem]"
              style={{ color: result.ok ? "var(--ff-status-positive)" : "var(--ff-status-critical)" }}
            >
              {result.ok
                ? "Dispatched — real completion confirmed."
                : `Failed: ${result.commands[result.commands.length - 1]?.reason ?? "unknown"}`}
            </span>
          )}
        </div>
      )}
    </li>
  );
}
