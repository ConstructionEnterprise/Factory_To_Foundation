import type { ConstructionProject, ConstructionSite, ConstructionTreeNode, LogisticsDispatch, Vehicle } from "@prisma/client";

import { prisma } from "../lib/prisma";

export type DispatchWithRelations = LogisticsDispatch & {
  truck: { identifier: string };
  driver: { name: string };
  vehicle: Pick<Vehicle, "id" | "identifier" | "vehicleClass"> | null;
};

export type ProjectRelationships = {
  project: ConstructionProject;
  site: ConstructionSite | null;
  treeNodes: ConstructionTreeNode[];
  fileCount: number;
  dispatches: DispatchWithRelations[];
};

/**
 * Real Construction Data Map read (Phase 1.1, 2026-08-16 rollout) -- one
 * query per real relation `ConstructionProject` already has
 * (site/treeNodes/files/logisticsDispatches, schema.prisma:332-349), run
 * in parallel. `ConstructionTreeNode` is real, seeded data (70 rows,
 * confirmed live) that no route has ever read before this -- same
 * "orphaned real data" shape Genealogy was in before Phase 1B.
 */
export async function findProjectRelationships(projectId: string): Promise<ProjectRelationships | null> {
  const project = await prisma.constructionProject.findUnique({ where: { id: projectId } });
  if (!project) return null;

  const [site, treeNodes, fileCount, dispatches] = await Promise.all([
    prisma.constructionSite.findUnique({ where: { projectId } }),
    prisma.constructionTreeNode.findMany({ where: { projectId }, orderBy: { id: "asc" } }),
    prisma.projectFile.count({ where: { projectId } }),
    prisma.logisticsDispatch.findMany({
      where: { destinationProjectId: projectId },
      include: {
        truck: { select: { identifier: true } },
        driver: { select: { name: true } },
        vehicle: { select: { id: true, identifier: true, vehicleClass: true } },
      },
      orderBy: { dispatchedAt: "desc" },
    }),
  ]);

  return { project, site, treeNodes, fileCount, dispatches };
}
