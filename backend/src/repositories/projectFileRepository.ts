import type { ProjectFile } from "@prisma/client";

import { prisma } from "../lib/prisma";

export type ProjectFileFilter = {
  projectId: string;
  treeNodeId?: string;
  category?: string;
};

/**
 * One row per real logical file (the latest non-deleted version) — a
 * document library lists "the file", not every historical version.
 * Prisma has no native "latest per group" query, so this fetches every
 * non-deleted candidate row (sorted so each fileId's highest version comes
 * first) and reduces to one per fileId in-process — real, simple, and
 * correct at the row counts this app actually has; would need a real
 * window-function query if that stopped being true.
 */
export async function findLatestVersions(filter: ProjectFileFilter): Promise<ProjectFile[]> {
  const rows = await prisma.projectFile.findMany({
    where: {
      projectId: filter.projectId,
      treeNodeId: filter.treeNodeId,
      category: filter.category,
      deletedAt: null,
    },
    orderBy: [{ fileId: "asc" }, { version: "desc" }],
  });
  const latestByFileId = new Map<string, ProjectFile>();
  for (const row of rows) {
    if (!latestByFileId.has(row.fileId)) latestByFileId.set(row.fileId, row);
  }
  return Array.from(latestByFileId.values());
}

/** The single highest-version, non-deleted row for a logical file — null if the file doesn't exist or every version has been deleted. */
export function findLatestVersion(fileId: string): Promise<ProjectFile | null> {
  return prisma.projectFile.findFirst({
    where: { fileId, deletedAt: null },
    orderBy: { version: "desc" },
  });
}

/** A specific historical version, real audit access even if the file's current (latest) state is deleted — used only for real version-history lookups, never the default. */
export function findVersion(fileId: string, version: number): Promise<ProjectFile | null> {
  return prisma.projectFile.findUnique({ where: { fileId_version: { fileId, version } } });
}

/** Every real version row for a logical file, newest first — the actual data a "version history" UI needs (Phase 4), not something inferrable from the latest row's `version` number alone. Included even if the file's current state is deleted, so real history stays visible/auditable. */
export function findAllVersions(fileId: string): Promise<ProjectFile[]> {
  return prisma.projectFile.findMany({ where: { fileId }, orderBy: { version: "desc" } });
}

export function findProjectById(projectId: string) {
  return prisma.constructionProject.findUnique({ where: { id: projectId } });
}

/** Real validation against the actual seeded tree, not a hand-maintained duplicate list — construction_tree_node already mirrors constructionData.ts exactly (Phase 2's seed.ts). */
export function findTreeNode(projectId: string, treeNodeId: string) {
  return prisma.constructionTreeNode.findFirst({ where: { id: treeNodeId, projectId } });
}

export type CreateFileInput = {
  projectId: string;
  treeNodeId: string;
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

export function createFile(data: CreateFileInput): Promise<ProjectFile> {
  return prisma.projectFile.create({ data });
}

export type MetadataPatch = {
  originalFilename?: string;
  category?: string;
  subcategory?: string | null;
};

/** Updates only the latest version row — renaming/re-filing a document affects its current state, not its frozen history. Never touches s3Key (see service layer's own doc comment on the real S3-key/display-name drift this creates). */
export function updateLatestVersionMetadata(id: string, patch: MetadataPatch): Promise<ProjectFile> {
  return prisma.projectFile.update({ where: { id }, data: patch });
}

/** Soft-deletes every version row sharing a fileId in one real transaction — "delete this file" means the whole logical file is gone, not just its latest version. Idempotent: only touches rows not already deleted. */
export async function softDeleteAllVersions(fileId: string, deletedById: string): Promise<number> {
  const result = await prisma.projectFile.updateMany({
    where: { fileId, deletedAt: null },
    data: { deletedAt: new Date(), deletedById },
  });
  return result.count;
}
