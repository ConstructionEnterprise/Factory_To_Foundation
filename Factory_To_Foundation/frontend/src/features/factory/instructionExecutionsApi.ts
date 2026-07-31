import { authFetch } from "@/lib/authFetch";
import { BACKEND_URL } from "@/lib/env";
import type { InstructionSet, InstructionStep } from "@/context/ManufacturingOutputContext";
import type { StepExecutionResult } from "./twinExecute";

export type InstructionExecutionHistoryEntry = {
  id: string;
  executedAt: string;
  ok: boolean;
  targetSubsystemId: string;
  targetType: string;
  sourceObjectId: string;
};

async function describeResponseError(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  if (body && typeof body.error === "string") return body.error;
  return `server responded ${res.status}`;
}

/** Real read of the audit trail this same file's logInstructionExecution() writes — consumed by Analytics' Production Output / Work Cell Performance widgets (A5). */
export async function listExecutionHistory(): Promise<InstructionExecutionHistoryEntry[]> {
  const res = await authFetch(`${BACKEND_URL}/instruction-executions`);
  if (!res.ok) throw new Error(await describeResponseError(res));
  return res.json();
}

/**
 * Real API client closing the audit-trail gap confirmed during Phase 1
 * investigation (backend/src/routes/instructionExecutions.ts): a real
 * Execute click dispatches real commands to the live twin
 * (twinExecute.ts's executeStep) but nothing ever persisted the result.
 * Called once per real Execute click (FactoryInstructions.tsx), logging
 * both a success and a failure — never called speculatively or in a batch.
 */
const API_BASE = BACKEND_URL;

export async function logInstructionExecution(
  instructionSet: InstructionSet,
  step: InstructionStep,
  result: StepExecutionResult
): Promise<void> {
  const res = await authFetch(`${API_BASE}/instruction-executions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instructionSet: {
        sourceObjectId: instructionSet.sourceObjectId,
        generatedAt: instructionSet.generatedAt,
        elementSpecJson: instructionSet.elementSpec ?? undefined,
        fabricationNotesJson: instructionSet.fabricationNotes ?? undefined,
      },
      step: {
        sequence: step.sequence,
        targetSubsystemId: step.targetSubsystemId,
        realCommandTarget: step.realCommandTarget,
        targetType: step.targetType,
        action: step.action,
        relatedObjectId: step.relatedObjectId,
        estimatedDurationSec: step.estimatedDurationSec,
        dispatchJson: step.dispatch ?? undefined,
        codeJson: step.code ?? undefined,
        reachabilityIssue: step.reachabilityIssue,
      },
      execution: {
        ok: result.ok,
        commandsJson: result.commands,
      },
    }),
  });
  // Real, disclosed limitation: a failure to log is reported to the
  // console, never surfaced as an error to the user or retried — the real
  // twin dispatch already happened (or didn't) by the time this call runs,
  // and blocking/alarming the Execute flow over a logging failure would
  // misrepresent a reporting gap as a real dispatch problem.
  if (!res.ok) {
    console.error(`Failed to log instruction execution: ${await describeResponseError(res)}`);
  }
}
