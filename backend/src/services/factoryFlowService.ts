import type { ModuleSequenceStatus } from "@prisma/client";

import { NotFoundError } from "../lib/httpErrors";
import * as repo from "../repositories/factoryFlowRepository";
import { computeMaterialRequirements, type MaterialRequirementReportDto } from "./materialRequirementService";

export type FactoryFlowStageKey =
  | "instructions_received"
  | "materials_received"
  | "manufacturing"
  | "production_complete"
  | "logistics_handoff"
  | "modular_sequence";

export type InstructionsReceivedStageDto = {
  status: "resolved" | "unresolved";
  instructionSetId: string | null;
  generatedAt: string | null;
  totalSteps: number | null;
  executedSteps: number | null;
  unresolvedReason: string | null;
};

export type MaterialsReceivedStageDto = {
  status: "sufficient" | "insufficient" | "unresolved";
  report: MaterialRequirementReportDto;
};

export type ManufacturingStageDto = {
  status: "in_progress" | "complete";
  startedAt: string;
  completedAt: string | null;
};

export type ProductionOutputSummaryDto = {
  id: string;
  serialNumber: string;
  status: string;
  qcStatus: string;
  inventoryItemId: string;
};

export type ProductionCompleteStageDto = {
  status: "not_started" | "partial" | "complete";
  plannedQuantity: number | null;
  outputs: ProductionOutputSummaryDto[];
};

export type LogisticsHandoffLineDto = {
  productionOutputId: string;
  serialNumber: string;
  status: "handed_off" | "pending";
  logisticsModuleId: string | null;
  dispatchStatus: string | null;
};

export type LogisticsHandoffStageDto = {
  status: "not_started" | "partial" | "complete";
  lines: LogisticsHandoffLineDto[];
};

export type ModularSequenceLineDto = {
  productionOutputId: string;
  serialNumber: string;
  sequenceEntryId: string | null;
  sequenceStatus: ModuleSequenceStatus | null;
};

export type ModularSequenceStageDto = {
  status: "not_started" | "partial" | "complete";
  lines: ModularSequenceLineDto[];
};

export type FactoryFlowDto = {
  productionRunId: string;
  currentStage: FactoryFlowStageKey;
  instructionsReceived: InstructionsReceivedStageDto;
  materialsReceived: MaterialsReceivedStageDto;
  manufacturing: ManufacturingStageDto;
  productionComplete: ProductionCompleteStageDto;
  logisticsHandoff: LogisticsHandoffStageDto;
  modularSequence: ModularSequenceStageDto;
};

/**
 * The real Factory Flow projection (Phase 10, 2026-08-18) -- Instructions
 * Received -> Materials Received -> Manufacturing/Assembly -> Production
 * Complete -> Logistics Handoff, each stage backed by an existing real
 * record, never a second parallel lifecycle. See this feature's own
 * design note: InstructionSet.sourceObjectId and
 * ProductionRun.sourceModelNodeId are two independent features'
 * references to the SAME real Manufacturing geometry-node identity --
 * reused as the real join key here, not a fabricated FK.
 */
export async function getFactoryFlow(productionRunId: string): Promise<FactoryFlowDto> {
  const run = await repo.findRunForFlow(productionRunId);
  if (!run) throw new NotFoundError(`No production run with id "${productionRunId}"`);

  // --- Instructions Received ---
  let instructionsReceived: InstructionsReceivedStageDto;
  if (!run.sourceModelNodeId) {
    instructionsReceived = {
      status: "unresolved",
      instructionSetId: null,
      generatedAt: null,
      totalSteps: null,
      executedSteps: null,
      unresolvedReason: "This run has no real Manufacturing-model source captured -- cannot resolve which real instructions it concerns.",
    };
  } else {
    const sets = await repo.findInstructionSetsBySourceObjectId(run.sourceModelNodeId);
    if (sets.length === 0) {
      instructionsReceived = {
        status: "unresolved",
        instructionSetId: null,
        generatedAt: null,
        totalSteps: null,
        executedSteps: null,
        unresolvedReason: `No real instruction set has been generated yet for Manufacturing node "${run.sourceModelNodeId}".`,
      };
    } else {
      const newest = sets[0];
      instructionsReceived = {
        status: "resolved",
        instructionSetId: newest.id,
        generatedAt: newest.generatedAt.toISOString(),
        totalSteps: newest.steps.length,
        executedSteps: newest.steps.filter((s) => s.executions.length > 0).length,
        unresolvedReason: null,
      };
    }
  }

  // --- Materials Received ---
  const materialReport = await computeMaterialRequirements(productionRunId);
  const materialsReceived: MaterialsReceivedStageDto = {
    status: !materialReport.allResolved ? "unresolved" : materialReport.allSufficient ? "sufficient" : "insufficient",
    report: materialReport,
  };

  // --- Manufacturing / Assembly ---
  const manufacturing: ManufacturingStageDto = {
    status: run.status,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt ? run.completedAt.toISOString() : null,
  };

  // --- Production Complete ---
  const outputs: ProductionOutputSummaryDto[] = run.outputs.map((o) => ({
    id: o.id,
    serialNumber: o.serialNumber,
    status: o.status,
    qcStatus: o.qcStatus,
    inventoryItemId: o.inventoryItemId,
  }));
  const productionComplete: ProductionCompleteStageDto = {
    status: outputs.length === 0 ? "not_started" : outputs.every((o) => o.status === "complete") ? "complete" : "partial",
    plannedQuantity: run.plannedQuantity,
    outputs,
  };

  // --- Logistics Handoff --- only evaluated against real completed outputs; an in-production output isn't expected to have moved to Logistics yet.
  const completedOutputs = run.outputs.filter((o) => o.status === "complete");
  const logisticsLines: LogisticsHandoffLineDto[] = completedOutputs.map((o) => {
    const module = o.inventoryItem.logisticsModule;
    return {
      productionOutputId: o.id,
      serialNumber: o.serialNumber,
      status: module ? "handed_off" : "pending",
      logisticsModuleId: module?.id ?? null,
      dispatchStatus: module?.dispatch?.status ?? null,
    };
  });
  const logisticsHandoff: LogisticsHandoffStageDto = {
    status:
      completedOutputs.length === 0
        ? "not_started"
        : logisticsLines.every((l) => l.status === "handed_off")
          ? "complete"
          : "partial",
    lines: logisticsLines,
  };

  // --- Modular Sequence --- only evaluated against real completed outputs, same real-vs-invented-state posture as Logistics Handoff above. A null sequenceStatus is an honest "not yet sequenced," never inferred from dispatchStatus.
  const modularSequenceLines: ModularSequenceLineDto[] = completedOutputs.map((o) => {
    const entry = o.inventoryItem.moduleSequenceEntry;
    return {
      productionOutputId: o.id,
      serialNumber: o.serialNumber,
      sequenceEntryId: entry?.id ?? null,
      sequenceStatus: entry?.status ?? null,
    };
  });
  const modularSequence: ModularSequenceStageDto = {
    status:
      completedOutputs.length === 0
        ? "not_started"
        : modularSequenceLines.every((l) => l.sequenceStatus === "complete")
          ? "complete"
          : "partial",
    lines: modularSequenceLines,
  };

  // --- Current stage: the real, earliest unresolved bottleneck, same "blocked" framing as Sequencing's own effectiveState. ---
  let currentStage: FactoryFlowStageKey;
  if (instructionsReceived.status !== "resolved") currentStage = "instructions_received";
  else if (materialsReceived.status !== "sufficient") currentStage = "materials_received";
  else if (manufacturing.status !== "complete") currentStage = "manufacturing";
  else if (productionComplete.status !== "complete") currentStage = "production_complete";
  else if (logisticsHandoff.status !== "complete") currentStage = "logistics_handoff";
  else currentStage = "modular_sequence";

  return {
    productionRunId,
    currentStage,
    instructionsReceived,
    materialsReceived,
    manufacturing,
    productionComplete,
    logisticsHandoff,
    modularSequence,
  };
}

export type UnitLifecycleRowDto = {
  productionOutputId: string;
  serialNumber: string;
  qcStatus: "pending" | "passed" | "failed";
  logisticsModuleId: string | null;
  dispatchStatus: string | null;
  sequenceEntryId: string | null;
  sequenceStatus: ModuleSequenceStatus | null;
  /** Real, direct-only (not transitive) blocker check -- same "blocked" fact moduleSequenceService.transitionStatus() itself enforces before letting an entry leave `pending`. Only meaningful while sequenceStatus === "pending"; an entry that already advanced past pending is never re-blocked by a later predecessor regression (transitionStatus() never re-checks). */
  sequenceBlocked: boolean;
  /** Real title of the one real incomplete blocking entry's InventoryItem, e.g. "Module CWF-D-301 (Cedarwood, Building D)" -- null unless sequenceBlocked is true. Never a synthesized/shortened label. */
  blockedByLabel: string | null;
  endToEndComplete: boolean;
};

/**
 * Real End-to-End Unit Lifecycle report (Reports rebuild, 2026-08-18;
 * extended same day after a real investigation -- see
 * docs/decisions/2026-08-18-reports-domain-audit-and-taxonomy.md and this
 * session's own findings -- distinguishing "QC failed" and "blocked" from
 * plain "not started" honestly, rather than collapsing all three into one
 * dash). The same real Factory -> Logistics -> Transportation -> Modular
 * Sequence chain getFactoryFlow() reads per-run, applied unscoped across
 * every real completed ProductionOutput. Every row's factory leg is
 * already "complete" by construction (repo.findAllCompletedOutputsForUnitLifecycle()
 * only selects completed outputs) -- nothing here infers a stage from
 * another; each field is read straight off its own real record, same as
 * logisticsHandoff/modularSequence above. endToEndComplete is the
 * "brutally simple" AND predicate: real dispatch delivered AND real
 * sequence entry complete, computed at read time, never stored.
 */
export async function getUnitLifecycleReport(): Promise<UnitLifecycleRowDto[]> {
  const outputs = await repo.findAllCompletedOutputsForUnitLifecycle();
  return outputs.map((o) => {
    const module = o.inventoryItem.logisticsModule;
    const entry = o.inventoryItem.moduleSequenceEntry;
    const dispatchStatus = module?.dispatch?.status ?? null;
    const sequenceStatus = entry?.status ?? null;

    const incompleteBlocker =
      entry?.status === "pending"
        ? entry.blockedDependencies.find((d) => d.blockingEntry.status !== "complete")
        : undefined;

    return {
      productionOutputId: o.id,
      serialNumber: o.serialNumber,
      qcStatus: o.qcStatus,
      logisticsModuleId: module?.id ?? null,
      dispatchStatus,
      sequenceEntryId: entry?.id ?? null,
      sequenceStatus,
      sequenceBlocked: !!incompleteBlocker,
      blockedByLabel: incompleteBlocker?.blockingEntry.inventoryItem.title ?? null,
      endToEndComplete: dispatchStatus === "delivered" && sequenceStatus === "complete",
    };
  });
}
