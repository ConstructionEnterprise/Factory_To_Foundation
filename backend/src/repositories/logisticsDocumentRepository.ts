import type { LogisticsDocument } from "@prisma/client";

import { prisma } from "../lib/prisma";

export type LogisticsDocumentFilter = {
  dispatchId: string;
  category?: string;
};

/**
 * One row per real logical document (the latest non-deleted version) —
 * mirrors projectFileRepository.ts's findLatestVersions() exactly, same
 * in-process reduce-to-one-per-fileId approach at the same real row counts.
 */
export async function findLatestVersions(filter: LogisticsDocumentFilter): Promise<LogisticsDocument[]> {
  const rows = await prisma.logisticsDocument.findMany({
    where: {
      dispatchId: filter.dispatchId,
      category: filter.category,
      deletedAt: null,
    },
    orderBy: [{ fileId: "asc" }, { version: "desc" }],
  });
  const latestByFileId = new Map<string, LogisticsDocument>();
  for (const row of rows) {
    if (!latestByFileId.has(row.fileId)) latestByFileId.set(row.fileId, row);
  }
  return Array.from(latestByFileId.values());
}

/** The single highest-version, non-deleted row for a logical file — null if the file doesn't exist or every version has been deleted. */
export function findLatestVersion(fileId: string): Promise<LogisticsDocument | null> {
  return prisma.logisticsDocument.findFirst({
    where: { fileId, deletedAt: null },
    orderBy: { version: "desc" },
  });
}

/** A specific historical version, real audit access even if the file's current (latest) state is deleted. */
export function findVersion(fileId: string, version: number): Promise<LogisticsDocument | null> {
  return prisma.logisticsDocument.findUnique({ where: { fileId_version: { fileId, version } } });
}

/** Every real version row for a logical file, newest first. */
export function findAllVersions(fileId: string): Promise<LogisticsDocument[]> {
  return prisma.logisticsDocument.findMany({ where: { fileId }, orderBy: { version: "desc" } });
}

/** Real validation against the actual seeded/created Dispatch — never trust a client-supplied dispatchId without checking it exists. */
export function findDispatchById(dispatchId: string) {
  return prisma.logisticsDispatch.findUnique({ where: { id: dispatchId } });
}

export type CreateDocumentInput = {
  dispatchId: string;
  category: string;
  subcategory: string | null;
  fileId: string;
  version: number;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  s3Key: string;
  uploadedById: string;
};

export function createDocument(data: CreateDocumentInput): Promise<LogisticsDocument> {
  return prisma.logisticsDocument.create({ data });
}

export type MetadataPatch = {
  originalFilename?: string;
  category?: string;
  subcategory?: string | null;
};

/** Updates only the latest version row — same rename-affects-current-state-only rule as projectFileRepository.ts. Never touches s3Key. */
export function updateLatestVersionMetadata(id: string, patch: MetadataPatch): Promise<LogisticsDocument> {
  return prisma.logisticsDocument.update({ where: { id }, data: patch });
}

/** Soft-deletes every version row sharing a fileId in one real update — idempotent, only touches rows not already deleted. */
export async function softDeleteAllVersions(fileId: string, deletedById: string): Promise<number> {
  const result = await prisma.logisticsDocument.updateMany({
    where: { fileId, deletedAt: null },
    data: { deletedAt: new Date(), deletedById },
  });
  return result.count;
}
