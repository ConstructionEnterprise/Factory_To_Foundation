import type { Prisma } from "@prisma/client";

import * as repo from "../repositories/instructionExecutionRepository";

/**
 * Closes the real audit-trail gap confirmed during Phase 1 investigation:
 * InstructionSet/InstructionStep/InstructionExecution have existed as real
 * schema since the enterprise-migration Phase 2, but nothing anywhere ever
 * wrote to them — Track B's real Execute action (frontend's twinExecute.ts)
 * dispatches real commands to the live twin and returns a result, but that
 * result was never persisted. This is the missing write path, called once
 * per real Execute click (features/factory/FactoryInstructions.tsx), never
 * batched or backfilled.
 *
 * The frontend's ManufacturingOutputContext is in-memory only — a
 * generated InstructionSet/InstructionStep never had a real database row
 * before this. Rather than requiring a separate "save this generation"
 * step, the real set/step rows are lazily upserted here at the moment a
 * step is actually executed, keyed by the real (sourceObjectId,
 * generatedAt) / (instructionSetId, sequence) identities added in Phase 1 —
 * so executing two steps from the same generated set correctly references
 * one real InstructionSet row, not two.
 */
export type LogExecutionInput = {
  instructionSet: {
    sourceObjectId: string;
    generatedAt: string;
    elementSpecJson?: unknown;
    fabricationNotesJson?: unknown;
  };
  step: {
    sequence: number;
    targetSubsystemId: string;
    realCommandTarget: string;
    targetType: string;
    action: string;
    relatedObjectId?: string;
    estimatedDurationSec: number;
    dispatchJson?: unknown;
    codeJson?: unknown;
    reachabilityIssue?: string;
  };
  execution: {
    ok: boolean;
    commandsJson: unknown;
    twinFrameAtDispatch?: number;
  };
  userId: string;
};

export type InstructionExecutionDto = {
  id: string;
  instructionStepId: string;
  userId: string;
  executedAt: string;
  ok: boolean;
};

export async function logExecution(input: LogExecutionInput): Promise<InstructionExecutionDto> {
  const set = await repo.upsertInstructionSet({
    sourceObjectId: input.instructionSet.sourceObjectId,
    generatedAt: new Date(input.instructionSet.generatedAt),
    elementSpecJson: input.instructionSet.elementSpecJson as Prisma.InputJsonValue | undefined,
    fabricationNotesJson: input.instructionSet.fabricationNotesJson as Prisma.InputJsonValue | undefined,
  });

  const step = await repo.upsertInstructionStep({
    instructionSetId: set.id,
    sequence: input.step.sequence,
    targetSubsystemId: input.step.targetSubsystemId,
    realCommandTarget: input.step.realCommandTarget,
    targetType: input.step.targetType,
    action: input.step.action,
    relatedObjectId: input.step.relatedObjectId,
    estimatedDurationSec: input.step.estimatedDurationSec,
    dispatchJson: input.step.dispatchJson as Prisma.InputJsonValue | undefined,
    codeJson: input.step.codeJson as Prisma.InputJsonValue | undefined,
    reachabilityIssue: input.step.reachabilityIssue,
  });

  const execution = await repo.createExecution({
    instructionStepId: step.id,
    userId: input.userId,
    ok: input.execution.ok,
    commandsJson: input.execution.commandsJson as Prisma.InputJsonValue,
    twinFrameAtDispatch: input.execution.twinFrameAtDispatch,
  });

  return {
    id: execution.id,
    instructionStepId: execution.instructionStepId,
    userId: execution.userId,
    executedAt: execution.executedAt.toISOString(),
    ok: execution.ok,
  };
}

export type ExecutionHistoryEntryDto = {
  id: string;
  executedAt: string;
  ok: boolean;
  targetSubsystemId: string;
  targetType: string;
  sourceObjectId: string;
};

/** Real execution history for Analytics (Phase 5) — Production Output / Work Cell Performance read this, never fabricated counts. */
export async function listExecutionHistory(targetSubsystemId?: string): Promise<ExecutionHistoryEntryDto[]> {
  const rows = await repo.findExecutionHistory({ targetSubsystemId });
  return rows.map((row) => ({
    id: row.id,
    executedAt: row.executedAt.toISOString(),
    ok: row.ok,
    targetSubsystemId: row.instructionStep.targetSubsystemId,
    targetType: row.instructionStep.targetType,
    sourceObjectId: row.instructionStep.instructionSet.sourceObjectId,
  }));
}
