import { authFetch } from "@/lib/authFetch";
import { BACKEND_URL } from "@/lib/env";

/**
 * Real API client for Logistics Document Management (Phase 5's backend,
 * finally getting a real frontend) — talks to the real 7 routes
 * (backend/src/routes/logisticsDocuments.ts), scoped to a real dispatchId
 * instead of Construction's projectId/treeNodeId pair (LogisticsDocument
 * has no tree-node equivalent — see the schema's own doc comment on why).
 * Same authFetch/describeResponseError/requestJson shape as
 * projectFilesApi.ts, deliberately kept as a separate file from
 * logisticsOperationsApi.ts (Truck/Driver/Dispatch/Material/Module) since
 * documents are a distinct concern, matching Construction's own split
 * between constructionSiteStore.ts and projectFilesApi.ts.
 */
const API_BASE = BACKEND_URL;

// Matches the real, closed vocabulary the backend validates against
// (services/logisticsDocumentService.ts's LOGISTICS_DOCUMENT_CATEGORIES) —
// kept here as the single source of truth the UI reads from.
export const LOGISTICS_DOCUMENT_CATEGORIES = [
  "Bill of Lading",
  "Delivery Manifest",
  "Proof of Delivery",
  "Inspection & Compliance",
] as const;
export type LogisticsDocumentCategory = (typeof LOGISTICS_DOCUMENT_CATEGORIES)[number];

export type LogisticsDocumentFile = {
  id: string;
  dispatchId: string;
  category: string;
  subcategory: string | null;
  fileId: string;
  version: number;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  uploadedById: string;
  uploadedAt: string;
  deletedAt: string | null;
};

async function describeResponseError(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  if (body && typeof body.error === "string") return body.error;
  return `server responded ${res.status}`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(`${API_BASE}${path}`, init);
  if (!res.ok) throw new Error(await describeResponseError(res));
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function listDocuments(dispatchId: string): Promise<LogisticsDocumentFile[]> {
  const params = new URLSearchParams({ dispatchId });
  return requestJson(`/logistics-files?${params}`);
}

export function getVersionHistory(fileId: string): Promise<LogisticsDocumentFile[]> {
  return requestJson(`/logistics-files/${fileId}/versions`);
}

export function getDownloadUrl(fileId: string, version?: number): Promise<{ document: LogisticsDocumentFile; url: string }> {
  const query = version ? `?version=${version}` : "";
  return requestJson(`/logistics-files/${fileId}/download${query}`);
}

export type InitiateUploadInput = {
  dispatchId: string;
  category: string;
  subcategory?: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
};

export function initiateUpload(input: InitiateUploadInput): Promise<{ document: LogisticsDocumentFile; uploadUrl: string }> {
  return requestJson("/logistics-files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export type InitiateVersionInput = {
  originalFilename?: string;
  contentType: string;
  sizeBytes: number;
};

export function initiateVersionUpload(
  fileId: string,
  input: InitiateVersionInput
): Promise<{ document: LogisticsDocumentFile; uploadUrl: string }> {
  return requestJson(`/logistics-files/${fileId}/versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export type MetadataPatch = {
  originalFilename?: string;
  category?: string;
  subcategory?: string | null;
};

export function renameDocument(fileId: string, patch: MetadataPatch): Promise<LogisticsDocumentFile> {
  return requestJson(`/logistics-files/${fileId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export function deleteDocument(fileId: string): Promise<void> {
  return requestJson(`/logistics-files/${fileId}`, { method: "DELETE" });
}

/** The real upload leg — bytes go client -> S3 directly via the presigned URL, never through this backend. Same as projectFilesApi.ts's uploadToPresignedUrl(). */
export async function uploadToPresignedUrl(uploadUrl: string, file: File): Promise<void> {
  const res = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!res.ok) throw new Error(`Upload to S3 failed (HTTP ${res.status})`);
}
