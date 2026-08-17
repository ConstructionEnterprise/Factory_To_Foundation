import type { LogisticsMaterial, MaterialCatalogItem, MaterialInventoryEvent, MaterialInventoryEventType } from "@prisma/client";

import { prisma } from "../lib/prisma";

export function findCatalogItemById(id: string): Promise<MaterialCatalogItem | null> {
  return prisma.materialCatalogItem.findUnique({ where: { id } });
}

export function findAllCatalogItems(): Promise<MaterialCatalogItem[]> {
  return prisma.materialCatalogItem.findMany({ orderBy: { name: "asc" } });
}

export type CreateCatalogItemInput = {
  name: string;
  sku: string | null;
  unit: string;
  createdById: string;
};

export function createCatalogItem(data: CreateCatalogItemInput): Promise<MaterialCatalogItem> {
  return prisma.materialCatalogItem.create({ data });
}

export function findMaterialById(id: string): Promise<LogisticsMaterial | null> {
  return prisma.logisticsMaterial.findUnique({ where: { id } });
}

/** Every real LogisticsMaterial row currently linked to a given real catalog item -- the set materialRequirementService checks availability against. */
export function findMaterialsByCatalogItem(materialCatalogItemId: string): Promise<LogisticsMaterial[]> {
  return prisma.logisticsMaterial.findMany({ where: { materialCatalogItemId } });
}

export function linkMaterialToCatalogItem(materialId: string, materialCatalogItemId: string): Promise<LogisticsMaterial> {
  return prisma.logisticsMaterial.update({ where: { id: materialId }, data: { materialCatalogItemId } });
}

export type InventoryTransactionInput = {
  materialId: string;
  eventType: MaterialInventoryEventType;
  quantity: number;
  quantityOnHandDelta: number;
  quantityReservedDelta: number;
  quantityConsumedDelta: number;
  productionRunId: string | null;
  reason: string | null;
  changedById: string;
};

/**
 * Real, transactional inventory movement -- the ONLY way
 * LogisticsMaterial's three real ledger fields ever move, matching every
 * other transitionStatus()-shaped write in this schema. Every real change
 * is guaranteed a matching real MaterialInventoryEvent row in the same
 * transaction; there is no other real path that touches these fields.
 */
export async function recordInventoryTransaction(
  input: InventoryTransactionInput
): Promise<{ material: LogisticsMaterial; event: MaterialInventoryEvent }> {
  return prisma.$transaction(async (tx) => {
    const material = await tx.logisticsMaterial.update({
      where: { id: input.materialId },
      data: {
        quantityOnHand: { increment: input.quantityOnHandDelta },
        quantityReserved: { increment: input.quantityReservedDelta },
        quantityConsumed: { increment: input.quantityConsumedDelta },
      },
    });
    const event = await tx.materialInventoryEvent.create({
      data: {
        materialId: input.materialId,
        eventType: input.eventType,
        quantity: input.quantity,
        productionRunId: input.productionRunId,
        reason: input.reason,
        changedById: input.changedById,
      },
    });
    return { material, event };
  });
}

export function findEventsByMaterialId(materialId: string): Promise<MaterialInventoryEvent[]> {
  return prisma.materialInventoryEvent.findMany({ where: { materialId }, orderBy: { changedAt: "asc" } });
}

export function findEventsByProductionRunId(productionRunId: string): Promise<MaterialInventoryEvent[]> {
  return prisma.materialInventoryEvent.findMany({ where: { productionRunId }, orderBy: { changedAt: "asc" } });
}
