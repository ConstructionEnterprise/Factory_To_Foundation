import { authFetch } from "@/lib/authFetch";
import { BACKEND_URL } from "@/lib/env";

/**
 * Real API client for Construction Document Management (Phase 4) — talks
 * to the real backend's 7 routes (backend/src/routes/projectFiles.ts):
 * list, download, upload, replace-version, version history, rename,
 * delete. Every call goes through authFetch (credentials always included,
 * same reasoning as constructionSiteStore.ts — without it, the httpOnly
 * auth cookies never leave the browser cross-origin at all — plus a
 * transparent retry-after-refresh on a real 401, see lib/authFetch.ts) and
 * surfaces the backend's real `{ error }` body instead of a generic
 * "server responded 4xx", so a 403 reads as "which permission is missing,"
 * not a silent failure.
 */
const API_BASE = BACKEND_URL;

// Matches the real, closed 4-value vocabulary the backend validates
// against (services/projectFileService.ts's PROJECT_FILE_CATEGORIES) —
// kept here as the single source of truth the UI reads from, not
// duplicated ad hoc at each call site.
export const PROJECT_FILE_CATEGORIES = [
  "Project Documents",
  "Drawings & Models",
  "Field Documentation",
  "Quality & Safety",
] as const;
export type ProjectFileCategory = (typeof PROJECT_FILE_CATEGORIES)[number];

export type ProjectFile = {
  id: string;
  projectId: string;
  treeNodeId: string;
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

export function listFiles(projectId: string, treeNodeId: string): Promise<ProjectFile[]> {
  const params = new URLSearchParams({ projectId, treeNodeId });
  return requestJson(`/construction-files?${params}`);
}

export function getVersionHistory(fileId: string): Promise<ProjectFile[]> {
  return requestJson(`/construction-files/${fileId}/versions`);
}

export function getDownloadUrl(fileId: string, version?: number): Promise<{ file: ProjectFile; url: string }> {
  const query = version ? `?version=${version}` : "";
  return requestJson(`/construction-files/${fileId}/download${query}`);
}

export type InitiateUploadInput = {
  projectId: string;
  treeNodeId: string;
  category: string;
  subcategory?: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
};

export function initiateUpload(input: InitiateUploadInput): Promise<{ file: ProjectFile; uploadUrl: string }> {
  return requestJson("/construction-files", {
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
): Promise<{ file: ProjectFile; uploadUrl: string }> {
  return requestJson(`/construction-files/${fileId}/versions`, {
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

export function renameFile(fileId: string, patch: MetadataPatch): Promise<ProjectFile> {
  return requestJson(`/construction-files/${fileId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export function deleteFile(fileId: string): Promise<void> {
  return requestJson(`/construction-files/${fileId}`, { method: "DELETE" });
}

/** The real upload leg — bytes go client -> S3 directly via the presigned URL, never through this backend. Not routed through requestJson()/API_BASE: this URL points at S3, not our own API, and a non-2xx here is a real S3-side failure, not one of our own `{ error }` bodies. */
export async function uploadToPresignedUrl(uploadUrl: string, file: File): Promise<void> {
  const res = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!res.ok) throw new Error(`Upload to S3 failed (HTTP ${res.status})`);
}
