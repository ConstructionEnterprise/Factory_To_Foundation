import { authFetch } from "@/lib/authFetch";
import { BACKEND_URL } from "@/lib/env";

/**
 * Real API client for Inventory's shared identity layer (Phase 2,
 * 2026-08-15) — talks to the real backend routes.ts/inventoryItemService.ts
 * (GET /inventory-items, /inventory-items/:id). Same authFetch/
 * describeResponseError pattern as every other real *Api.ts in this app.
 */
const API_BASE = BACKEND_URL;

export type InventoryAssetDetail = {
  id: string;
  category: string;
  family: string;
  status: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  assetTag: string;
  acquisitionDate: string;
  lastService: string;
  nextService: string | null;
  notes: string | null;
};

export type InventoryGenealogyDetail = {
  id: string;
  tier: string;
  qr: string | null;
};

export type InventoryItem = {
  id: string;
  title: string;
  kind: "asset" | "genealogy_node";
  location: string | null;
  asset: InventoryAssetDetail | null;
  genealogyNode: InventoryGenealogyDetail | null;
};

async function describeResponseError(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  if (body && typeof body.error === "string") return body.error;
  return `server responded ${res.status}`;
}

async function requestJson<T>(path: string): Promise<T> {
  const res = await authFetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(await describeResponseError(res));
  return res.json() as Promise<T>;
}

export function fetchInventoryItems(query?: string): Promise<InventoryItem[]> {
  const params = query ? `?query=${encodeURIComponent(query)}` : "";
  return requestJson(`/inventory-items${params}`);
}

export function fetchInventoryItem(id: string): Promise<InventoryItem> {
  return requestJson(`/inventory-items/${id}`);
}
