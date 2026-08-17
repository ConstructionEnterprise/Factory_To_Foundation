import type { ProductionRun } from "@prisma/client";

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

export type CreateRunData = {
  assemblyId: string;
  cellRef: string | null;
  plannedQuantity: number | null;
  startedAt: Date;
  createdById: string;
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
