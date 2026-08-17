import { authFetch } from "@/lib/authFetch";
import { BACKEND_URL } from "@/lib/env";

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
