import { randomUUID } from "node:crypto";

import type { ComplianceDocument } from "@prisma/client";

import { NotFoundError } from "../lib/httpErrors";
import { getPresignedDownloadUrl, getPresignedUploadUrl } from "../lib/s3";
import * as repo from "../repositories/complianceDocumentRepository";

/** Real, closed vocabulary — company/employee-wide compliance record types (A4). Not FK'd to any project/dispatch, per the user's explicit decision that this is company-wide, not per-project data. */
export const COMPLIANCE_DOCUMENT_CATEGORIES = ["OSHA", "Certification", "License"] as const;
export type ComplianceDocumentCategory = (typeof COMPLIANCE_DOCUMENT_CATEGORIES)[number];

export function isComplianceDocumentCategory(value: string): value is ComplianceDocumentCategory {
  return (COMPLIANCE_DOCUMENT_CATEGORIES as readonly string[]).includes(value);
}

export type ComplianceDocumentDto = {
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

function toDto(row: ComplianceDocument): ComplianceDocumentDto {
  return {
    id: row.id,
    category: row.category,
    subject: row.subject,
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

/** compliance-documents/{fileId}/{version}/{originalFilename} — no project/dispatch segment, matching this model's standalone real shape. */
function buildS3Key(fileId: string, version: number, originalFilename: string): string {
  return `compliance-documents/${fileId}/${version}/${originalFilename}`;
}

export async function listDocuments(filter: repo.ComplianceDocumentFilter): Promise<ComplianceDocumentDto[]> {
  const rows = await repo.findLatestVersions(filter);
  return rows.map(toDto);
}

export async function listVersionHistory(fileId: string): Promise<ComplianceDocumentDto[]> {
  const rows = await repo.findAllVersions(fileId);
  if (rows.length === 0) throw new NotFoundError(`No document with id "${fileId}"`);
  return rows.map(toDto);
}

export type InitiateUploadInput = {
  category: string;
  subject: string | null;
  subcategory: string | null;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  uploadedById: string;
};

export async function initiateUpload(input: InitiateUploadInput): Promise<{ document: ComplianceDocumentDto; uploadUrl: string }> {
  const fileId = randomUUID();
  const version = 1;
  const s3Key = buildS3Key(fileId, version, input.originalFilename);

  const row = await repo.createDocument({
    category: input.category,
    subject: input.subject,
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

export async function initiateVersionUpload(
  fileId: string,
  input: InitiateVersionInput
): Promise<{ document: ComplianceDocumentDto; uploadUrl: string }> {
  const latest = await repo.findLatestVersion(fileId);
  if (!latest) throw new NotFoundError(`No document with id "${fileId}"`);

  const version = latest.version + 1;
  const originalFilename = input.originalFilename ?? latest.originalFilename;
  const s3Key = buildS3Key(fileId, version, originalFilename);

  const row = await repo.createDocument({
    category: latest.category,
    subject: latest.subject,
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

export async function getDownloadUrl(fileId: string, version?: number): Promise<{ document: ComplianceDocumentDto; url: string }> {
  const row = version ? await repo.findVersion(fileId, version) : await repo.findLatestVersion(fileId);
  if (!row || (version === undefined && row.deletedAt)) throw new NotFoundError(`No document with id "${fileId}"`);

  const url = await getPresignedDownloadUrl(row.s3Key);
  return { document: toDto(row), url };
}

export type MetadataPatch = {
  originalFilename?: string;
  category?: string;
  subject?: string | null;
  subcategory?: string | null;
};

/** Same real, disclosed limitation as ProjectFile/LogisticsDocument's own updateMetadata(): never re-keys the S3 object. */
export async function updateMetadata(fileId: string, patch: MetadataPatch): Promise<ComplianceDocumentDto> {
  const latest = await repo.findLatestVersion(fileId);
  if (!latest) throw new NotFoundError(`No document with id "${fileId}"`);
  const row = await repo.updateLatestVersionMetadata(latest.id, patch);
  return toDto(row);
}

export async function deleteDocument(fileId: string, deletedById: string): Promise<void> {
  const latest = await repo.findLatestVersion(fileId);
  if (!latest) throw new NotFoundError(`No document with id "${fileId}"`);
  await repo.softDeleteAllVersions(fileId, deletedById);
}
