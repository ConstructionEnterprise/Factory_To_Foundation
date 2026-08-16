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
