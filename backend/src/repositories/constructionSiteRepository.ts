import type { ConstructionSite } from "@prisma/client";

import { prisma } from "../lib/prisma";

export type SiteValues = {
  address: string | null;
  coordsX: number | null;
  coordsZ: number | null;
};

export function findAllSites(): Promise<ConstructionSite[]> {
  return prisma.constructionSite.findMany({ orderBy: { projectId: "asc" } });
}

export function findSite(projectId: string): Promise<ConstructionSite | null> {
  return prisma.constructionSite.findUnique({ where: { projectId } });
}

export function findProjectById(projectId: string) {
  return prisma.constructionProject.findUnique({ where: { id: projectId } });
}

export function upsertSite(projectId: string, values: SiteValues): Promise<ConstructionSite> {
  return prisma.constructionSite.upsert({
    where: { projectId },
    create: { projectId, ...values },
    update: values,
  });
}

/** Real no-op (returns false) when nothing existed to delete — clearing an already-absent site isn't an error, matching constructionSiteStore.ts's existing idempotent clearSite() behavior. */
export async function deleteSite(projectId: string): Promise<boolean> {
  try {
    await prisma.constructionSite.delete({ where: { projectId } });
    return true;
  } catch (err) {
    if (isRecordNotFoundError(err)) return false;
    throw err;
  }
}

function isRecordNotFoundError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === "P2025";
}
