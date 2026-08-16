import { authFetch } from "@/lib/authFetch";
import { BACKEND_URL } from "@/lib/env";

/** Real Vehicle record shape from GET /vehicles -- see backend/src/services/vehicleService.ts's VehicleDto. */
export type VehicleRecord = {
  id: string;
  identifier: string;
  vehicleClass: string;
  status: "active" | "maintenance" | "retired";
  location: string | null;
  inventoryItemId: string | null;
  logisticsTruckIdentifier: string | null;
  createdAt: string;
};

export type VehicleDispatchSummary = {
  id: string;
  status: string;
  destinationProjectId: string;
  route: string | null;
  eta: string | null;
  miles: number | null;
  dispatchedAt: string;
};

export type VehicleDetail = VehicleRecord & { dispatches: VehicleDispatchSummary[] };

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

export function fetchVehicles(): Promise<VehicleRecord[]> {
  return requestJson("/vehicles");
}

export function fetchVehicleDetail(id: string): Promise<VehicleDetail> {
  return requestJson(`/vehicles/${id}`);
}
