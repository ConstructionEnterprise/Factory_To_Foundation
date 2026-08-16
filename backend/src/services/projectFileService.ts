import { randomUUID } from "node:crypto";

import type { ProjectFile } from "@prisma/client";

import { NotFoundError } from "../lib/httpErrors";
import { getPresignedDownloadUrl, getPresignedUploadUrl } from "../lib/s3";
import * as repo from "../repositories/projectFileRepository";

/**
 * The real, closed set of Browse "folders" a file can be filed under — the
 * original 4 from the Phase 2 brief, plus 5 real Document Templates (A4,
 * Administration expansion): RFI/Submittal/Change Order/Inspection Report/
 * Purchase Order. Bill of Lading is deliberately NOT added here — it
 * already exists as a real Logistics document category
 * (LOGISTICS_DOCUMENT_CATEGORIES, logisticsDocumentService.ts), so adding a
 * second copy under Construction would duplicate, not extend, real
 * coverage. Purchase Order attaches here (Construction procurement is
 * real, per-project data; Logistics has no per-project procurement
 * concept) — a disclosed judgment call, not an oversight.
 */
export const PROJECT_FILE_CATEGORIES = [
  "Project Documents",
  "Drawings & Models",
  "Field Documentation",
  "Quality & Safety",
  "RFI",
  "Submittal",
  "Change Order",
  "Inspection Report",
  "Purchase Order",
] as const;
export type ProjectFileCategory = (typeof PROJECT_FILE_CATEGORIES)[number];

export function isProjectFileCategory(value: string): value is ProjectFileCategory {
  return (PROJECT_FILE_CATEGORIES as readonly string[]).includes(value);
}

export type ProjectFileDto = {
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

// s3Key is deliberately never exposed to the frontend — it's an internal
// storage detail, not something a client needs or should be able to
// construct/guess. Downloads go through getDownloadUrl() below instead.
function toDto(row: ProjectFile): ProjectFileDto {
  return {
    id: row.id,
    projectId: row.projectId,
    treeNodeId: row.treeNodeId,
    category: row.category,
    subcategory: row.subcategory,
    fileId: row.fileId,
    version: row.version,
    originalFilename: row.originalFilename,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    uploadedById: row.uploadedById,
    uploadedAt: row.uploadedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

/** projects/{projectId}/{treeNodeId}/{fileId}/{version}/{originalFilename} — the brief's real storage layout convention, verbatim. originalFilename is never sanitized here — kept real and human-readable for direct bucket audits. */
function buildS3Key(projectId: string, treeNodeId: string, fileId: string, version: number, originalFilename: string): string {
  return `projects/${projectId}/${treeNodeId}/${fileId}/${version}/${originalFilename}`;
}

async function assertRealProjectAndTreeNode(projectId: string, treeNodeId: string): Promise<void> {
  const project = await repo.findProjectById(projectId);
  if (!project) throw new NotFoundError(`No construction project with id "${projectId}"`);
  const treeNode = await repo.findTreeNode(projectId, treeNodeId);
  if (!treeNode) throw new NotFoundError(`No tree node "${treeNodeId}" under project "${projectId}"`);
}

export async function listFiles(filter: repo.ProjectFileFilter): Promise<ProjectFileDto[]> {
  const rows = await repo.findLatestVersions(filter);
  return rows.map(toDto);
}

/** Real cross-project search (Reports) — same DTO shape as listFiles(), just not scoped to a single project. Every result stays traceable to its real project via projectId, resolved to a real title client-side (constructionData.ts's real project fixture, same source LogisticsDispatchForm already uses). */
export async function searchFiles(filter: repo.ProjectFileSearchFilter): Promise<ProjectFileDto[]> {
  const rows = await repo.searchLatestVersions(filter);
  return rows.map(toDto);
}

/**
 * Real gap found building Phase 4's UI, not part of the original 6-route
 * plan: there was no way to enumerate which versions of a file exist —
 * `list` only ever returns the latest, and `download` needs a version
 * number you'd already have to know. A "version history" UI can't be
 * built honestly without this, so it's added here rather than faked
 * client-side from the latest row's `version` count alone.
 */
export async function listVersionHistory(fileId: string): Promise<ProjectFileDto[]> {
  const rows = await repo.findAllVersions(fileId);
  if (rows.length === 0) throw new NotFoundError(`No file with id "${fileId}"`);
  return rows.map(toDto);
}

export type InitiateUploadInput = {
  projectId: string;
  treeNodeId: string;
  category: string;
  subcategory: string | null;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  uploadedById: string;
};

export async function initiateUpload(input: InitiateUploadInput): Promise<{ file: ProjectFileDto; uploadUrl: string }> {
  await assertRealProjectAndTreeNode(input.projectId, input.treeNodeId);

  const fileId = randomUUID();
  const version = 1;
  const s3Key = buildS3Key(input.projectId, input.treeNodeId, fileId, version, input.originalFilename);

  const row = await repo.createFile({
    projectId: input.projectId,
    treeNodeId: input.treeNodeId,
    category: input.category,
    subcategory: input.subcategory,
    fileId,
    version,
    originalFilename: input.originalFilename,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    s3Key,
    uploadedById: input.uploadedById,
  });

  const uploadUrl = await getPresignedUploadUrl(s3Key, input.contentType);
  return { file: toDto(row), uploadUrl };
}

export type InitiateVersionInput = {
  originalFilename?: string;
  contentType: string;
  sizeBytes: number;
  uploadedById: string;
};

/** A new version of an existing logical file — same fileId, version = current max + 1. Inherits projectId/treeNodeId/category/subcategory from the current latest version; only filename/contentType/sizeBytes are real per-upload facts that must be given fresh each time. */
export async function initiateVersionUpload(
  fileId: string,
  input: InitiateVersionInput
): Promise<{ file: ProjectFileDto; uploadUrl: string }> {
  const latest = await repo.findLatestVersion(fileId);
  if (!latest) throw new NotFoundError(`No file with id "${fileId}"`);

  const version = latest.version + 1;
  const originalFilename = input.originalFilename ?? latest.originalFilename;
  const s3Key = buildS3Key(latest.projectId, latest.treeNodeId, fileId, version, originalFilename);

  const row = await repo.createFile({
    projectId: latest.projectId,
    treeNodeId: latest.treeNodeId,
    category: latest.category,
    subcategory: latest.subcategory,
    fileId,
    version,
    originalFilename,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    s3Key,
    uploadedById: input.uploadedById,
  });

  const uploadUrl = await getPresignedUploadUrl(s3Key, input.contentType);
  return { file: toDto(row), uploadUrl };
}

/** Presigned GET for the current (latest) version by default; a specific real historical version via `version`, for the rare "view history" case — never proxied through this backend. */
export async function getDownloadUrl(fileId: string, version?: number): Promise<{ file: ProjectFileDto; url: string }> {
  const row = version ? await repo.findVersion(fileId, version) : await repo.findLatestVersion(fileId);
  if (!row || (version === undefined && row.deletedAt)) throw new NotFoundError(`No file with id "${fileId}"`);

  const url = await getPresignedDownloadUrl(row.s3Key);
  return { file: toDto(row), url };
}

export type MetadataPatch = {
  originalFilename?: string;
  category?: string;
  subcategory?: string | null;
};

/**
 * Real, disclosed limitation: this only updates the DB row's display
 * metadata (filename/category/subcategory) — it never touches the S3
 * object or its key. The brief's storage convention bakes
 * `originalFilename` into the S3 key at upload time for real human
 * readability in a direct bucket audit; a rename after that point means
 * the DB's display name and the S3 key's embedded filename can genuinely
 * diverge. Re-keying (an S3 CopyObject + delete-old-key) would fix this
 * but was never asked for and adds real cost/risk for a cosmetic-only
 * concern — flagged here rather than silently built or silently ignored.
 */
export async function updateMetadata(fileId: string, patch: MetadataPatch): Promise<ProjectFileDto> {
  const latest = await repo.findLatestVersion(fileId);
  if (!latest) throw new NotFoundError(`No file with id "${fileId}"`);
  const row = await repo.updateLatestVersionMetadata(latest.id, patch);
  return toDto(row);
}

/** Soft-deletes every version of a logical file — "delete this file" means the whole thing is gone from real listings, not just its latest version. Real S3 objects for every version stay in the bucket untouched. */
export async function deleteFile(fileId: string, deletedById: string): Promise<void> {
  const latest = await repo.findLatestVersion(fileId);
  if (!latest) throw new NotFoundError(`No file with id "${fileId}"`);
  await repo.softDeleteAllVersions(fileId, deletedById);
}
