import type { Prisma, ProductionRun } from "@prisma/client";

import { prisma } from "../lib/prisma";

export function findAllRuns(): Promise<ProductionRun[]> {
  return prisma.productionRun.findMany({ orderBy: { startedAt: "desc" } });
}

export function findRunById(id: string): Promise<ProductionRun | null> {
  return prisma.productionRun.findUnique({ where: { id } });
}

export function findAssemblyById(id: string) {
  return prisma.costAssembly.findUnique({ where: { id } });
}

/** Real assembly BOM + resolved material-catalog identity for each real component, the shape materialRequirementService walks (Phase 8, 2026-08-17). */
export function findRunWithRequirementContext(id: string) {
  return prisma.productionRun.findUnique({
    where: { id },
    include: {
      assembly: {
        include: {
          components: { include: { marketCostRecord: { include: { materialCatalogItem: true } } } },
        },
      },
    },
  });
}

export type CreateRunData = {
  assemblyId: string;
  cellRef: string | null;
  plannedQuantity: number | null;
  startedAt: Date;
  createdById: string;
  /** Real Manufacturing-model provenance snapshot (Phase 8, 2026-08-17) -- see ProductionRun's own schema doc comment. All three null together when this run wasn't created from a measured node. */
  sourceModelNodeId: string | null;
  sourceDimensions: Prisma.InputJsonValue | undefined;
  sourceExtras: Prisma.InputJsonValue | undefined;
};

export function createRun(data: CreateRunData): Promise<ProductionRun> {
  return prisma.productionRun.create({ data });
}

export function updateRunStatus(id: string, status: "in_progress" | "complete", completedAt: Date | null): Promise<ProductionRun> {
  return prisma.productionRun.update({ where: { id }, data: { status, completedAt } });
}

/** Real count of this run's own real produced units -- checked against its plannedQuantity, never assumed equal to it. */
export function countOutputsForRun(productionRunId: string): Promise<number> {
  return prisma.productionOutput.count({ where: { productionRunId } });
}
