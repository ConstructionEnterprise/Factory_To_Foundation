import { authFetch } from "@/lib/authFetch";
import { BACKEND_URL } from "@/lib/env";

export type MarketCostRecord = {
  id: string;
  category: "material" | "labor" | "equipment";
  itemName: string;
  sku: string | null;
  unit: string;
  unitCostCents: number;
  region: string | null;
  sourceName: string;
  sourceUrl: string | null;
  observedAt: string;
  notes: string | null;
};

export type ProductivityRecord = {
  id: string;
  task: string;
  value: number;
  unit: string;
  crewSize: number | null;
  applicabilityNotes: string | null;
  region: string | null;
  sourceName: string;
  sourceUrl: string | null;
  observedAt: string;
};

export type CostAssemblyComponent = {
  id: string;
  marketCostRecordId: string;
  itemName: string;
  unitCostCents: number;
  recordUnit: string;
  quantityPerUnit: number;
  quantitySourceName: string;
  quantityNotes: string | null;
  componentCostCents: number;
  productivityRecordId: string | null;
  productivityRecordTask: string | null;
};

export type CostAssembly = {
  id: string;
  name: string;
  unit: string;
  description: string | null;
  assumptionNotes: string | null;
  components: CostAssemblyComponent[];
  estimatedCostPerUnitCents: number | null;
};

export type ProjectQuantityTakeoff = {
  id: string;
  constructionProjectId: string;
  buildingTreeNodeId: string | null;
  buildingTitle: string | null;
  assemblyId: string;
  assemblyName: string;
  costEstimateScenarioId: string | null;
  quantity: number;
  unit: string;
  methodology: string;
  sourceNotes: string | null;
  assemblyCostPerUnitCents: number | null;
  calculatedTotalCostCents: number | null;
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

/** Same real read paths Construction's own future Cost Intelligence UI will use -- Analytics is a second consumer of these routes, never a second source of truth. */
export function fetchMarketCostRecords(): Promise<MarketCostRecord[]> {
  return requestJson("/market-cost-records");
}

export function fetchProductivityRecords(): Promise<ProductivityRecord[]> {
  return requestJson("/productivity-records");
}

export function fetchCostAssemblies(): Promise<CostAssembly[]> {
  return requestJson("/cost-assemblies");
}

export function fetchProjectQuantityTakeoffs(projectId: string): Promise<ProjectQuantityTakeoff[]> {
  return requestJson(`/construction-projects/${projectId}/quantity-takeoffs`);
}
