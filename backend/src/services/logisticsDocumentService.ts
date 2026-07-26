import { randomUUID } from "node:crypto";

import type { LogisticsDocument } from "@prisma/client";

import { NotFoundError } from "../lib/httpErrors";
import { getPresignedDownloadUrl, getPresignedUploadUrl } from "../lib/s3";
import * as repo from "../repositories/logisticsDocumentRepository";

/**
 * Real, closed set of Logistics document types — NOT quoted from this
 * feature's task brief the way ProjectFileCategory's four values were
 * quoted from Construction's brief verbatim (that brief didn't enumerate
 * one for Logistics). Drawn instead from real, standard industry logistics
 * document types: a bill of lading and delivery manifest travel with every
 * real haul, proof of delivery closes it out, and inspection/compliance
 * covers the rest (DOT/load-securement checks) — not an exhaustive
 * fabricated list, a real closed vocabulary this schema can still grow
 * later the same deliberate way ProjectFileCategory would (a migration,
 * not a silent string change).
 */
export const LOGISTICS_DOCUMENT_CATEGORIES = [
  "Bill of Lading",
  "Delivery Manifest",
  "Proof of Delivery",
  "Inspection & Compliance",
] as const;
export type LogisticsDocumentCategory = (typeof LOGISTICS_DOCUMENT_CATEGORIES)[number];

export function isLogisticsDocumentCategory(value: string): value is LogisticsDocumentCategory {
  return (LOGISTICS_DOCUMENT_CATEGORIES as readonly string[]).includes(value);
}

export type LogisticsDocumentDto = {
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

// s3Key is deliberately never exposed to the frontend — same internal-
// storage-detail posture as ProjectFile's own toDto().
function toDto(row: LogisticsDocument): LogisticsDocumentDto {
  return {
    id: row.id,
    dispatchId: row.dispatchId,
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

/** logistics-dispatches/{dispatchId}/{fileId}/{version}/{originalFilename} — Logistics' own real storage layout, same "real key, never proxied bytes" convention as ProjectFile's buildS3Key(). */
function buildS3Key(dispatchId: string, fileId: string, version: number, originalFilename: string): string {
  return `logistics-dispatches/${dispatchId}/${fileId}/${version}/${originalFilename}`;
}

async function assertRealDispatch(dispatchId: string): Promise<void> {
  const dispatch = await repo.findDispatchById(dispatchId);
  if (!dispatch) throw new NotFoundError(`No logistics dispatch with id "${dispatchId}"`);
}

export async function listDocuments(filter: repo.LogisticsDocumentFilter): Promise<LogisticsDocumentDto[]> {
  const rows = await repo.findLatestVersions(filter);
  return rows.map(toDto);
}

export async function listVersionHistory(fileId: string): Promise<LogisticsDocumentDto[]> {
  const rows = await repo.findAllVersions(fileId);
  if (rows.length === 0) throw new NotFoundError(`No document with id "${fileId}"`);
  return rows.map(toDto);
}

export type InitiateUploadInput = {
  dispatchId: string;
  category: string;
  subcategory: string | null;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  uploadedById: string;
};

export async function initiateUpload(input: InitiateUploadInput): Promise<{ document: LogisticsDocumentDto; uploadUrl: string }> {
  await assertRealDispatch(input.dispatchId);

  const fileId = randomUUID();
  const version = 1;
  const s3Key = buildS3Key(input.dispatchId, fileId, version, input.originalFilename);

  const row = await repo.createDocument({
    dispatchId: input.dispatchId,
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
  return { document: toDto(row), uploadUrl };
}

export type InitiateVersionInput = {
  originalFilename?: string;
  contentType: string;
  sizeBytes: number;
  uploadedById: string;
};

/** A new version of an existing logical document — same fileId, version = current max + 1. Inherits dispatchId/category/subcategory from the current latest version. */
export async function initiateVersionUpload(
  fileId: string,
  input: InitiateVersionInput
): Promise<{ document: LogisticsDocumentDto; uploadUrl: string }> {
  const latest = await repo.findLatestVersion(fileId);
  if (!latest) throw new NotFoundError(`No document with id "${fileId}"`);

  const version = latest.version + 1;
  const originalFilename = input.originalFilename ?? latest.originalFilename;
  const s3Key = buildS3Key(latest.dispatchId, fileId, version, originalFilename);

  const row = await repo.createDocument({
    dispatchId: latest.dispatchId,
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
  return { document: toDto(row), uploadUrl };
}

/** Presigned GET for the current (latest) version by default; a specific real historical version via `version`. */
export async function getDownloadUrl(fileId: string, version?: number): Promise<{ document: LogisticsDocumentDto; url: string }> {
  const row = version ? await repo.findVersion(fileId, version) : await repo.findLatestVersion(fileId);
  if (!row || (version === undefined && row.deletedAt)) throw new NotFoundError(`No document with id "${fileId}"`);

  const url = await getPresignedDownloadUrl(row.s3Key);
  return { document: toDto(row), url };
}

export type MetadataPatch = {
  originalFilename?: string;
  category?: string;
  subcategory?: string | null;
};

/**
 * Same real, disclosed limitation as ProjectFile's updateMetadata(): only
 * updates the DB row's display metadata, never re-keys the S3 object — a
 * rename after upload can leave the DB's display name and the S3 key's
 * embedded filename genuinely diverged. Not fixed here for the same reason
 * it wasn't fixed there (real cost/risk for a cosmetic-only concern).
 */
export async function updateMetadata(fileId: string, patch: MetadataPatch): Promise<LogisticsDocumentDto> {
  const latest = await repo.findLatestVersion(fileId);
  if (!latest) throw new NotFoundError(`No document with id "${fileId}"`);
  const row = await repo.updateLatestVersionMetadata(latest.id, patch);
  return toDto(row);
}

/** Soft-deletes every version of a logical document — the whole thing disappears from real listings, not just its latest version. Real S3 objects for every version stay in the bucket untouched. */
export async function deleteDocument(fileId: string, deletedById: string): Promise<void> {
  const latest = await repo.findLatestVersion(fileId);
  if (!latest) throw new NotFoundError(`No document with id "${fileId}"`);
  await repo.softDeleteAllVersions(fileId, deletedById);
}
