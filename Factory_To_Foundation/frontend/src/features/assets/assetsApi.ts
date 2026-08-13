import { authFetch } from "@/lib/authFetch";
import { BACKEND_URL } from "@/lib/env";

import type { AssetCategory, AssetStatus } from "./assetsData";

/** Real Asset record shape from GET /assets -- no x/y/width/height (those are frontend-only layout, applied via layoutAssets). */
export type AssetRecord = {
  id: string;
  title: string;
  subtitle: string;
  category: AssetCategory;
  family: string;
  status: AssetStatus;
  manufacturer: string;
  model: string;
  serialNumber: string;
  assetTag: string;
  location: string;
  acquisitionDate: string;
  lastService: string;
  nextService: string | null;
  notes: string | null;
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

export function fetchAssets(): Promise<AssetRecord[]> {
  return requestJson("/assets");
}
