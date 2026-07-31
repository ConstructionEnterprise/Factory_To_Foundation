import type { ComplianceDocument } from "@prisma/client";

import { prisma } from "../lib/prisma";

export type ComplianceDocumentFilter = {
  category?: string;
};

/** Same "latest non-deleted version per logical file" pattern as projectFileRepository.ts — no projectId/treeNodeId here, ComplianceDocument is deliberately standalone (company/employee-wide, not per-project). */
export async function findLatestVersions(filter: ComplianceDocumentFilter): Promise<ComplianceDocument[]> {
  const rows = await prisma.complianceDocument.findMany({
    where: { category: filter.category, deletedAt: null },
    orderBy: [{ fileId: "asc" }, { version: "desc" }],
  });
  const latestByFileId = new Map<string, ComplianceDocument>();
  for (const row of rows) {
    if (!latestByFileId.has(row.fileId)) latestByFileId.set(row.fileId, row);
  }
  return Array.from(latestByFileId.values());
}

export function findLatestVersion(fileId: string): Promise<ComplianceDocument | null> {
  return prisma.complianceDocument.findFirst({ where: { fileId, deletedAt: null }, orderBy: { version: "desc" } });
}

export function findVersion(fileId: string, version: number): Promise<ComplianceDocument | null> {
  return prisma.complianceDocument.findUnique({ where: { fileId_version: { fileId, version } } });
}

export function findAllVersions(fileId: string): Promise<ComplianceDocument[]> {
  return prisma.complianceDocument.findMany({ where: { fileId }, orderBy: { version: "desc" } });
}

export type CreateDocumentInput = {
  category: string;
  subject: string | null;
  subcategory: string | null;
  fileId: string;
  version: number;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  s3Key: string;
  uploadedById: string;
};

export function createDocument(data: CreateDocumentInput): Promise<ComplianceDocument> {
  return prisma.complianceDocument.create({ data });
}

export type MetadataPatch = {
  originalFilename?: string;
  category?: string;
  subject?: string | null;
  subcategory?: string | null;
};

export function updateLatestVersionMetadata(id: string, patch: MetadataPatch): Promise<ComplianceDocument> {
  return prisma.complianceDocument.update({ where: { id }, data: patch });
}

export async function softDeleteAllVersions(fileId: string, deletedById: string): Promise<number> {
  const result = await prisma.complianceDocument.updateMany({
    where: { fileId, deletedAt: null },
    data: { deletedAt: new Date(), deletedById },
  });
  return result.count;
}
