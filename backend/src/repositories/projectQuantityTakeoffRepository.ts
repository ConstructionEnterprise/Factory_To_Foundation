import type { ProjectQuantityTakeoff, CostAssembly, ConstructionTreeNode } from "@prisma/client";

import { prisma } from "../lib/prisma";

export type TakeoffWithRelations = ProjectQuantityTakeoff & {
  assembly: CostAssembly;
  buildingTreeNode: ConstructionTreeNode | null;
};

const withRelations = { assembly: true, buildingTreeNode: true } as const;

export function findByProject(projectId: string): Promise<TakeoffWithRelations[]> {
  return prisma.projectQuantityTakeoff.findMany({
    where: { constructionProjectId: projectId },
    include: withRelations,
    orderBy: { createdAt: "desc" },
  });
}

/** Real takeoffs actually linked to one scenario (Phase 6, 2026-08-17) -- the set a SKU-level breakdown is built from. */
export function findByScenario(costEstimateScenarioId: string): Promise<TakeoffWithRelations[]> {
  return prisma.projectQuantityTakeoff.findMany({
    where: { costEstimateScenarioId },
    include: withRelations,
    orderBy: { createdAt: "asc" },
  });
}

export function findProjectById(id: string) {
  return prisma.constructionProject.findUnique({ where: { id } });
}

export function findAssemblyById(id: string): Promise<CostAssembly | null> {
  return prisma.costAssembly.findUnique({ where: { id } });
}

export function findBuildingTreeNodeById(id: string): Promise<ConstructionTreeNode | null> {
  return prisma.constructionTreeNode.findUnique({ where: { id } });
}

export function findScenarioById(id: string) {
  return prisma.costEstimateScenario.findUnique({ where: { id } });
}

export type CreateTakeoffData = {
  constructionProjectId: string;
  buildingTreeNodeId: string | null;
  assemblyId: string;
  costEstimateScenarioId: string | null;
  quantity: number;
  unit: string;
  methodology: string;
  sourceNotes: string | null;
  enteredById: string;
};

export function createTakeoff(data: CreateTakeoffData): Promise<TakeoffWithRelations> {
  return prisma.projectQuantityTakeoff.create({ data, include: withRelations });
}
