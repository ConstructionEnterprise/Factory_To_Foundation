import { authFetch } from "@/lib/authFetch";
import { BACKEND_URL } from "@/lib/env";

export type CostEstimateScenario = {
  id: string;
  projectId: string;
  name: string;
  squareFootage: number;
  ratePerSquareFootCents: number;
  overheadPercent: number | null;
  markupPercent: number | null;
  notes: string | null;
  totalCents: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateScenarioInput = {
  name: string;
  squareFootage: number;
  ratePerSquareFootCents: number;
  overheadPercent?: number;
  markupPercent?: number;
  notes?: string;
};

async function describeResponseError(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  if (body && typeof body.error === "string") return body.error;
  return `server responded ${res.status}`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(`${BACKEND_URL}${path}`, init);
  if (!res.ok) throw new Error(await describeResponseError(res));
  return res.json() as Promise<T>;
}

export function fetchScenarios(projectId: string): Promise<CostEstimateScenario[]> {
  return requestJson(`/construction-projects/${projectId}/cost-estimates`);
}

export function createScenario(projectId: string, input: CreateScenarioInput): Promise<CostEstimateScenario> {
  return requestJson(`/construction-projects/${projectId}/cost-estimates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function deleteScenario(id: string): Promise<void> {
  const res = await authFetch(`${BACKEND_URL}/cost-estimates/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await describeResponseError(res));
}

/**
 * Real SKU-level breakdown (Phase 6, 2026-08-17) -- every real
 * ProjectQuantityTakeoff linked to this scenario, resolved down to its
 * assembly's real components. See costEstimateService.ts's own doc
 * comments for the full reconciliation semantics (unresolvedCents is a
 * real dollar remainder, never a scope claim).
 */
export type ScenarioBreakdownLineItem = {
  id: string;
  itemName: string;
  unitCostCents: number;
  recordUnit: string;
  quantityPerUnit: number;
  extendedCostCents: number;
};

export type ScenarioBreakdownTakeoff = {
  id: string;
  assemblyId: string;
  assemblyName: string;
  buildingTitle: string | null;
  quantity: number;
  unit: string;
  assemblyCostPerUnitCents: number | null;
  calculatedTotalCostCents: number | null;
  lineItems: ScenarioBreakdownLineItem[];
};

export type ScenarioBreakdown = {
  scenarioId: string;
  scenarioName: string;
  scenarioTotalCents: number;
  takeoffs: ScenarioBreakdownTakeoff[];
  itemizedTotalCents: number | null;
  unresolvedCents: number | null;
};

export function fetchScenarioBreakdown(id: string): Promise<ScenarioBreakdown> {
  return requestJson(`/cost-estimates/${id}/breakdown`);
}
