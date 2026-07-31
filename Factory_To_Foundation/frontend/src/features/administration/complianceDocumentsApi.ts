import { authFetch } from "@/lib/authFetch";
import { BACKEND_URL } from "@/lib/env";

/**
 * Real API client for Compliance & Records (A4) — backend/src/routes/
 * complianceDocuments.ts. Mirrors projectFilesApi.ts's shape exactly, minus
 * projectId/treeNodeId (this model is deliberately standalone, company/
 * employee-wide, not per-project).
 */
const API_BASE = BACKEND_URL;

export const COMPLIANCE_DOCUMENT_CATEGORIES = ["OSHA", "Certification", "License"] as const;
export type ComplianceDocumentCategory = (typeof COMPLIANCE_DOCUMENT_CATEGORIES)[number];

export type ComplianceDocument = {
  id: string;
  category: string;
  subject: string | null;
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

export function listDocuments(): Promise<ComplianceDocument[]> {
  return requestJson("/compliance-documents");
}

export function getVersionHistory(fileId: string): Promise<ComplianceDocument[]> {
  return requestJson(`/compliance-documents/${fileId}/versions`);
}

export function getDownloadUrl(fileId: string, version?: number): Promise<{ document: ComplianceDocument; url: string }> {
  const query = version ? `?version=${version}` : "";
  return requestJson(`/compliance-documents/${fileId}/download${query}`);
}

export type InitiateUploadInput = {
  category: string;
  subject?: string;
  subcategory?: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
};

export function initiateUpload(
  input: InitiateUploadInput
): Promise<{ document: ComplianceDocument; uploadUrl: string }> {
  return requestJson("/compliance-documents", {
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
): Promise<{ document: ComplianceDocument; uploadUrl: string }> {
  return requestJson(`/compliance-documents/${fileId}/versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export type MetadataPatch = {
  originalFilename?: string;
  category?: string;
  subject?: string | null;
  subcategory?: string | null;
};

export function renameDocument(fileId: string, patch: MetadataPatch): Promise<ComplianceDocument> {
  return requestJson(`/compliance-documents/${fileId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export function deleteDocument(fileId: string): Promise<void> {
  return requestJson(`/compliance-documents/${fileId}`, { method: "DELETE" });
}

/** Real upload leg — bytes go client -> S3 directly via the presigned URL, same convention as projectFilesApi.ts's own uploadToPresignedUrl. */
export async function uploadToPresignedUrl(uploadUrl: string, file: File): Promise<void> {
  const res = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!res.ok) throw new Error(`Upload to S3 failed (HTTP ${res.status})`);
}
