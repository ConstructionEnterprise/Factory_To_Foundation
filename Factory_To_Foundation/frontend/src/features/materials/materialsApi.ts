import { authFetch } from "@/lib/authFetch";
import { BACKEND_URL } from "@/lib/env";

/**
 * Real Material record shape from GET /logistics-materials (Phase 3,
 * 2026-08-17 Inventory Command Ribbon rollout) -- Materials is now a
 * first-class Inventory capability, sibling to Assets/Genealogy, backed by
 * the same real LogisticsMaterial table LogisticsBrowse's Storage zone
 * already reads (one authoritative source, two real domain projections --
 * not a duplicate model).
 */
export type MaterialRecord = {
  id: string;
  name: string;
  /** Real on-hand/reserved/consumed ledger (Phase 8, 2026-08-17) -- quantityAvailable is always onHand - reserved, computed by the backend, never a separately editable number. */
  quantityOnHand: number;
  quantityReserved: number;
  quantityConsumed: number;
  quantityAvailable: number;
  location: string | null;
  materialCatalogItemId: string | null;
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

export function fetchMaterials(): Promise<MaterialRecord[]> {
  return requestJson("/logistics-materials");
}
