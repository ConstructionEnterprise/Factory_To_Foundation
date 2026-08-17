import { authFetch } from "@/lib/authFetch";
import { BACKEND_URL } from "@/lib/env";

/**
 * Real API client for all 5 Logistics operational models — talks to the
 * real backend route files added across Phases 5-8 (logisticsTrucks.ts,
 * logisticsDrivers.ts, logisticsDispatches.ts, logisticsMaterials.ts,
 * logisticsModules.ts). Same authFetch/describeResponseError pattern as
 * projectFilesApi.ts: credentials always included, a real `{ error }` body
 * surfaced on failure instead of a generic "server responded 4xx". Phase 8
 * is this file's first real consumer for Material/Module — added once the
 * real Browse Logistics panel needed a real Storage/Yard data source,
 * closing the gap Phase 6 explicitly flagged as unbuilt.
 */
const API_BASE = BACKEND_URL;

export type LogisticsTruck = { id: string; identifier: string };
export type LogisticsDriver = { id: string; name: string };
export type LogisticsDispatch = {
  id: string;
  truckId: string;
  driverId: string;
  destinationProjectId: string;
  status: string;
  route: string | null;
  traffic: string | null;
  eta: string | null;
  odometerStart: number | null;
  odometerEnd: number | null;
  /** Always server-derived (odometerEnd - odometerStart) — never independently entered, see recordDispatchMileage(). */
  miles: number | null;
  businessPurpose: string | null;
  /** Non-null once pushed to the real Mileage Tax Report, see pushDispatchToTaxReport(). */
  taxReportedAt: string | null;
  dispatchedAt: string;
};

async function describeResponseError(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  if (body && typeof body.error === "string") return body.error;
  return `server responded ${res.status}`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(`${API_BASE}${path}`, init);
  if (!res.ok) throw new Error(await describeResponseError(res));
  return res.json() as Promise<T>;
}

export function listTrucks(): Promise<LogisticsTruck[]> {
  return requestJson("/logistics-trucks");
}

export function createTruck(identifier: string): Promise<LogisticsTruck> {
  return requestJson("/logistics-trucks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier }),
  });
}

export function listDrivers(): Promise<LogisticsDriver[]> {
  return requestJson("/logistics-drivers");
}

export function createDriver(name: string): Promise<LogisticsDriver> {
  return requestJson("/logistics-drivers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export type CreateDispatchInput = {
  truckId: string;
  driverId: string;
  destinationProjectId: string;
  eta?: string;
  route?: string;
  traffic?: string;
  odometerStart?: number;
  businessPurpose?: string;
};

export function createDispatch(input: CreateDispatchInput): Promise<LogisticsDispatch> {
  return requestJson("/logistics-dispatches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export type RecordMileageInput = {
  odometerStart?: number;
  odometerEnd?: number;
  businessPurpose?: string;
};

/** Real, server-validated mileage recording — the backend derives `miles` from the merged odometer readings, never accepts it directly (see logisticsDispatchService.ts's recordMileage()). */
export function recordDispatchMileage(dispatchId: string, input: RecordMileageInput): Promise<LogisticsDispatch> {
  return requestJson(`/logistics-dispatches/${dispatchId}/mileage`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

/** Real, configurable IRS standard mileage rate — see schema.prisma's MileageRateConfig doc comment for the full reasoning (effective-dated, never hardcoded, never seeded with a guessed real-world number). */
export type MileageRate = {
  id: string;
  centsPerMile: number;
  effectiveDate: string;
  createdAt: string;
  createdById: string | null;
};

export function listMileageRates(): Promise<MileageRate[]> {
  return requestJson("/mileage-rates");
}

export type CreateMileageRateInput = { centsPerMile: number; effectiveDate: string };

export function createMileageRate(input: CreateMileageRateInput): Promise<MileageRate> {
  return requestJson("/mileage-rates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function listDispatches(): Promise<LogisticsDispatch[]> {
  return requestJson("/logistics-dispatches");
}

/** Real eligibility-gated push — the backend rejects this unless the dispatch is delivered, both odometer readings are recorded, and a business purpose is set (see logisticsDispatchService.ts's pushToTaxReport()). Idempotent if already pushed. */
export function pushDispatchToTaxReport(dispatchId: string): Promise<LogisticsDispatch> {
  return requestJson(`/logistics-dispatches/${dispatchId}/tax-report`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

/** Real Mileage Tax Report row — the rate actually in effect on this specific trip's own dispatchedAt date, not just whatever's current now. rateCentsPerMile/deductionCents are null (not zero) when no rate was configured yet for that date — honest absence, see logisticsDispatchService.ts's listTaxReportEntries(). */
export type MileageTaxReportEntry = {
  dispatchId: string;
  truckId: string;
  driverId: string;
  destinationProjectId: string;
  dispatchedAt: string;
  businessPurpose: string;
  odometerStart: number;
  odometerEnd: number;
  miles: number;
  taxReportedAt: string;
  rateCentsPerMile: number | null;
  rateEffectiveDate: string | null;
  deductionCents: number | null;
};

export function listMileageTaxReport(): Promise<MileageTaxReportEntry[]> {
  return requestJson("/logistics-mileage-tax-report");
}

/** Real KPI-row numbers (closes gap #4) — "Modules Staged" (dispatchId null, matching the schema's own "staged in the yard" language), "In Transit" (assigned dispatch status), and "Deliveries (MTD)" (real custody-event transitions into `delivered` this calendar month, server-computed). Dock Utilization stays a disclosed non-value on the frontend since no dock/capacity model exists in this schema. */
export type LogisticsKpis = {
  modulesStaged: number;
  modulesInTransit: number;
  deliveriesThisMonth: number;
};

export function getLogisticsKpis(): Promise<LogisticsKpis> {
  return requestJson("/logistics-kpis");
}

/** Real vocabulary — matches the backend's own closed state machine (logisticsDispatchService.ts's VALID_TRANSITIONS): staged -> in_transit -> delivered only, no skipping, no going backward. */
export type LogisticsCustodyEvent = {
  id: string;
  dispatchId: string;
  fromStatus: string | null;
  toStatus: string;
  changedById: string;
  changedAt: string;
  notes: string | null;
};

export function transitionDispatchStatus(
  dispatchId: string,
  toStatus: string,
  notes?: string
): Promise<LogisticsDispatch> {
  return requestJson(`/logistics-dispatches/${dispatchId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ toStatus, notes }),
  });
}

export function listCustodyEvents(dispatchId: string): Promise<LogisticsCustodyEvent[]> {
  return requestJson(`/logistics-dispatches/${dispatchId}/events`);
}

export type RecentLogisticsCustodyEvent = LogisticsCustodyEvent & { truckIdentifier: string };

/** Real cross-dispatch recent activity for Analytics' Events feed (Phase 1.3, 2026-08-16 rollout). */
export function listRecentCustodyEvents(): Promise<RecentLogisticsCustodyEvent[]> {
  return requestJson(`/logistics-dispatches/events/recent`);
}

export type LogisticsMaterial = {
  id: string;
  name: string;
  /** Real on-hand/reserved/consumed ledger (Phase 8, 2026-08-17); quantityAvailable is always onHand - reserved, computed by the backend. */
  quantityOnHand: number;
  quantityReserved: number;
  quantityConsumed: number;
  quantityAvailable: number;
  location: string | null;
};

export function listMaterials(): Promise<LogisticsMaterial[]> {
  return requestJson("/logistics-materials");
}

export type CreateMaterialInput = { name: string; quantity?: number; location?: string };

export function createMaterial(input: CreateMaterialInput): Promise<LogisticsMaterial> {
  return requestJson("/logistics-materials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export type LogisticsModule = {
  id: string;
  name: string;
  location: string | null;
  dispatchId: string | null;
};

export function listModules(): Promise<LogisticsModule[]> {
  return requestJson("/logistics-modules");
}

export type CreateModuleInput = { name: string; location?: string; dispatchId?: string };

export function createModule(input: CreateModuleInput): Promise<LogisticsModule> {
  return requestJson("/logistics-modules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
