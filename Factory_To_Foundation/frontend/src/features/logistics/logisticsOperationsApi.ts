import { authFetch } from "@/lib/authFetch";

/**
 * Real API client for the Logistics Dispatch-creation flow — talks to the
 * 3 real backend route files added alongside the dispatch-creation form
 * (backend/src/routes/logisticsTrucks.ts, logisticsDrivers.ts,
 * logisticsDispatches.ts). Same authFetch/describeResponseError pattern as
 * projectFilesApi.ts: credentials always included, a real `{ error }` body
 * surfaced on failure instead of a generic "server responded 4xx".
 */
const API_BASE = "http://localhost:4300";

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
};

export function createDispatch(input: CreateDispatchInput): Promise<LogisticsDispatch> {
  return requestJson("/logistics-dispatches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function listDispatches(): Promise<LogisticsDispatch[]> {
  return requestJson("/logistics-dispatches");
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
