import type { InstructionExecution, InstructionSet, InstructionStep } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma";

export type UpsertInstructionSetInput = {
  sourceObjectId: string;
  generatedAt: Date;
  elementSpecJson: Prisma.InputJsonValue | undefined;
  fabricationNotesJson: Prisma.InputJsonValue | undefined;
};

/** Upserts by the real (sourceObjectId, generatedAt) identity added in Phase 1 — the same real generation event, referenced by every step execution logged against it, never a fresh row per Execute click. */
export function upsertInstructionSet(input: UpsertInstructionSetInput): Promise<InstructionSet> {
  return prisma.instructionSet.upsert({
    where: { sourceObjectId_generatedAt: { sourceObjectId: input.sourceObjectId, generatedAt: input.generatedAt } },
    update: {},
    create: {
      sourceObjectId: input.sourceObjectId,
      generatedAt: input.generatedAt,
      elementSpecJson: input.elementSpecJson,
      fabricationNotesJson: input.fabricationNotesJson,
    },
  });
}

export type UpsertInstructionStepInput = {
  instructionSetId: string;
  sequence: number;
  targetSubsystemId: string;
  realCommandTarget: string;
  targetType: string;
  action: string;
  relatedObjectId: string | undefined;
  estimatedDurationSec: number;
  dispatchJson: Prisma.InputJsonValue | undefined;
  codeJson: Prisma.InputJsonValue | undefined;
  reachabilityIssue: string | undefined;
};

/** Upserts by the real (instructionSetId, sequence) identity added in Phase 1 — a real step within a real generated set, not a client-supplied id the frontend never had a reason to mint before now. */
export function upsertInstructionStep(input: UpsertInstructionStepInput): Promise<InstructionStep> {
  return prisma.instructionStep.upsert({
    where: { instructionSetId_sequence: { instructionSetId: input.instructionSetId, sequence: input.sequence } },
    update: {},
    create: {
      instructionSetId: input.instructionSetId,
      sequence: input.sequence,
      targetSubsystemId: input.targetSubsystemId,
      realCommandTarget: input.realCommandTarget,
      targetType: input.targetType,
      action: input.action,
      relatedObjectId: input.relatedObjectId,
      estimatedDurationSec: input.estimatedDurationSec,
      dispatchJson: input.dispatchJson,
      codeJson: input.codeJson,
      reachabilityIssue: input.reachabilityIssue,
    },
  });
}

export type CreateExecutionInput = {
  instructionStepId: string;
  userId: string;
  ok: boolean;
  commandsJson: Prisma.InputJsonValue;
  twinFrameAtDispatch: number | undefined;
};

/** One real row per real Execute click — never batched, never retroactively fabricated for a step that was only generated, not actually dispatched. */
export function createExecution(input: CreateExecutionInput): Promise<InstructionExecution> {
  return prisma.instructionExecution.create({
    data: {
      instructionStepId: input.instructionStepId,
      userId: input.userId,
      ok: input.ok,
      commandsJson: input.commandsJson,
      twinFrameAtDispatch: input.twinFrameAtDispatch,
    },
  });
}

export type ExecutionHistoryFilter = {
  targetSubsystemId?: string;
};

/** Real execution history for Analytics' Production Output / Work Cell Performance widgets — joins through to the owning step/set so a report can group by real subsystem/target without a second round trip. */
export function findExecutionHistory(filter: ExecutionHistoryFilter) {
  return prisma.instructionExecution.findMany({
    where: filter.targetSubsystemId ? { instructionStep: { targetSubsystemId: filter.targetSubsystemId } } : undefined,
    include: { instructionStep: { include: { instructionSet: true } } },
    orderBy: { executedAt: "desc" },
  });
}
