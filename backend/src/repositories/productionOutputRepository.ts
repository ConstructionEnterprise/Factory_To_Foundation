import type { ProductionOutput, ProductionOutputStatus, ProductionOutputStatusEvent, QcStatus } from "@prisma/client";

import { prisma } from "../lib/prisma";

export function findAllOutputs(productionRunId?: string): Promise<ProductionOutput[]> {
  return prisma.productionOutput.findMany({
    where: productionRunId ? { productionRunId } : undefined,
    orderBy: { createdAt: "asc" },
  });
}

export function findOutputById(id: string): Promise<ProductionOutput | null> {
  return prisma.productionOutput.findUnique({ where: { id } });
}

export function findRunById(id: string) {
  return prisma.productionRun.findUnique({ where: { id } });
}

export function findAssemblyById(id: string) {
  return prisma.costAssembly.findUnique({ where: { id } });
}

export function findProjectById(id: string) {
  return prisma.constructionProject.findUnique({ where: { id } });
}

export function findTreeNodeById(id: string) {
  return prisma.constructionTreeNode.findUnique({ where: { id } });
}

export function findBySerialNumber(serialNumber: string): Promise<ProductionOutput | null> {
  return prisma.productionOutput.findUnique({ where: { serialNumber } });
}

export type CreateOutputData = {
  productionRunId: string;
  assemblyId: string;
  serialNumber: string;
  destinationProjectId: string | null;
  destinationTreeNodeId: string | null;
  createdById: string;
};

/**
 * Real create — same transactional "row + its real InventoryItem link, in
 * one write" shape as vehicleRepository.createVehicleWithInventoryItem()
 * and logisticsMaterialRepository.createMaterialWithInventoryItem(). A
 * ProductionOutput can never exist without a real InventoryItem behind it
 * (unlike LogisticsModule/GenealogyNode, whose link stayed nullable for
 * backward compatibility with rows that predate this pattern).
 */
export function createOutputWithInventoryItem(
  data: CreateOutputData,
  inventoryTitle: string
): Promise<ProductionOutput> {
  return prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.create({
      data: { title: inventoryTitle, kind: "production_output", location: null },
    });
    return tx.productionOutput.create({
      data: { ...data, inventoryItemId: item.id },
    });
  });
}

export type TransitionOutputStatusInput = {
  outputId: string;
  fromStatus: ProductionOutputStatus | null;
  toStatus: ProductionOutputStatus;
  fromQcStatus: QcStatus | null;
  toQcStatus: QcStatus | null;
  reason: string | null;
  changedById: string;
  producedAt: Date | null;
};

/** Real, transactional status change -- the ONLY way ProductionOutput.status/qcStatus ever move, same shape as flowPointRepository.transitionStatus(). */
export async function transitionStatus(
  input: TransitionOutputStatusInput
): Promise<{ output: ProductionOutput; event: ProductionOutputStatusEvent }> {
  return prisma.$transaction(async (tx) => {
    const output = await tx.productionOutput.update({
      where: { id: input.outputId },
      data: {
        status: input.toStatus,
        ...(input.toQcStatus !== null ? { qcStatus: input.toQcStatus } : {}),
        ...(input.producedAt !== null ? { producedAt: input.producedAt } : {}),
      },
    });
    const event = await tx.productionOutputStatusEvent.create({
      data: {
        productionOutputId: input.outputId,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        fromQcStatus: input.fromQcStatus,
        toQcStatus: input.toQcStatus,
        reason: input.reason,
        changedById: input.changedById,
      },
    });
    return { output, event };
  });
}

export function findStatusEvents(productionOutputId: string): Promise<ProductionOutputStatusEvent[]> {
  return prisma.productionOutputStatusEvent.findMany({
    where: { productionOutputId },
    orderBy: { changedAt: "asc" },
  });
}
