import { authFetch } from "@/lib/authFetch";
import { BACKEND_URL } from "@/lib/env";
import type { ModuleSequenceStatus } from "@/features/construction/Sequencing/moduleSequenceApi";

/**
 * Real API client for Phase 9's ProductionRun/ProductionOutput --
 * Manufacturing prepares (model/shop drawings/instructions), Factory
 * executes (this data). Surfaced as a real Factory Command Ribbon
 * capability, not a Manufacturing page -- see FactoryProduction.tsx.
 */
export type ProductionRun = {
  id: string;
  assemblyId: string;
  assemblyName: string;
  cellRef: string | null;
  status: "in_progress" | "complete";
  plannedQuantity: number | null;
  actualQuantity: number;
  startedAt: string;
  completedAt: string | null;
};

/** Real Manufacturing-model provenance, captured at run creation (Phase 8, 2026-08-17) -- see ProductionRun's own schema doc comment. */
export type ProductionRunWithSource = ProductionRun & {
  sourceModelNodeId: string | null;
  sourceDimensions: unknown;
  sourceExtras: unknown;
};

/** Real, read-only WHAT-IF resource-availability check (Phase 8, 2026-08-17) -- see materialRequirementService.ts. Never mutates anything. */
export type MaterialRequirementLine = {
  costAssemblyComponentId: string;
  materialCatalogItemId: string | null;
  materialCatalogItemName: string | null;
  materialIds: string[];
  requiredQuantity: number | null;
  unresolvedReason: string | null;
  availableQuantity: number | null;
  sufficient: boolean | null;
};

export type MaterialRequirementReport = {
  productionRunId: string;
  sourceModelNodeId: string | null;
  lines: MaterialRequirementLine[];
  allResolved: boolean;
  allSufficient: boolean;
};

export type ProductionOutput = {
  id: string;
  productionRunId: string;
  assemblyId: string;
  assemblyName: string;
  serialNumber: string;
  inventoryItemId: string;
  destinationProjectId: string | null;
  destinationTreeNodeId: string | null;
  status: "in_production" | "complete";
  qcStatus: "pending" | "passed" | "failed";
  producedAt: string | null;
};

async function describeResponseError(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  if (body && typeof body.error === "string") return body.error;
  return `server responded ${res.status}`;
}

async function requestJson<T>(path: string): Promise<T> {
  const res = await authFetch(`${BACKEND_URL}${path}`);
  if (!res.ok) throw new Error(await describeResponseError(res));
  return res.json() as Promise<T>;
}

export function listProductionRuns(): Promise<ProductionRun[]> {
  return requestJson("/production-runs");
}

/** `productionRunId` is an optional real filter -- omitted, lists every real output across every run. */
export function listProductionOutputs(productionRunId?: string): Promise<ProductionOutput[]> {
  return requestJson(`/production-outputs${productionRunId ? `?productionRunId=${encodeURIComponent(productionRunId)}` : ""}`);
}

export function fetchMaterialRequirements(productionRunId: string): Promise<MaterialRequirementReport> {
  return requestJson(`/production-runs/${productionRunId}/material-requirements`);
}

/**
 * Real Factory Flow projection (Phase 10, 2026-08-18) -- Instructions
 * Received -> Materials Received -> Manufacturing/Assembly -> Production
 * Complete -> Logistics Handoff, each stage a real read projection over
 * existing Phase 5/8/9 records, never a second parallel lifecycle. See
 * factoryFlowService.ts.
 */
export type FactoryFlowStageKey =
  | "instructions_received"
  | "materials_received"
  | "manufacturing"
  | "production_complete"
  | "logistics_handoff"
  | "modular_sequence";

export type InstructionsReceivedStage = {
  status: "resolved" | "unresolved";
  instructionSetId: string | null;
  generatedAt: string | null;
  totalSteps: number | null;
  executedSteps: number | null;
  unresolvedReason: string | null;
};

export type MaterialsReceivedStage = {
  status: "sufficient" | "insufficient" | "unresolved";
  report: MaterialRequirementReport;
};

export type ManufacturingStage = {
  status: "in_progress" | "complete";
  startedAt: string;
  completedAt: string | null;
};

export type ProductionOutputSummary = {
  id: string;
  serialNumber: string;
  status: string;
  qcStatus: string;
  inventoryItemId: string;
};

export type ProductionCompleteStage = {
  status: "not_started" | "partial" | "complete";
  plannedQuantity: number | null;
  outputs: ProductionOutputSummary[];
};

export type LogisticsHandoffLine = {
  productionOutputId: string;
  serialNumber: string;
  status: "handed_off" | "pending";
  logisticsModuleId: string | null;
  dispatchStatus: string | null;
};

export type LogisticsHandoffStage = {
  status: "not_started" | "partial" | "complete";
  lines: LogisticsHandoffLine[];
};

export type ModularSequenceLine = {
  productionOutputId: string;
  serialNumber: string;
  sequenceEntryId: string | null;
  sequenceStatus: ModuleSequenceStatus | null;
};

export type ModularSequenceStage = {
  status: "not_started" | "partial" | "complete";
  lines: ModularSequenceLine[];
};

export type FactoryFlow = {
  productionRunId: string;
  currentStage: FactoryFlowStageKey;
  instructionsReceived: InstructionsReceivedStage;
  materialsReceived: MaterialsReceivedStage;
  manufacturing: ManufacturingStage;
  productionComplete: ProductionCompleteStage;
  logisticsHandoff: LogisticsHandoffStage;
  modularSequence: ModularSequenceStage;
};

export function fetchFactoryFlow(productionRunId: string): Promise<FactoryFlow> {
  return requestJson(`/production-runs/${productionRunId}/factory-flow`);
}
