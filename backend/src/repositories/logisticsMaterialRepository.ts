import type { LogisticsMaterial } from "@prisma/client";

import { prisma } from "../lib/prisma";

export function findAllMaterials(): Promise<LogisticsMaterial[]> {
  return prisma.logisticsMaterial.findMany({ orderBy: { name: "asc" } });
}

export function findMaterialById(id: string): Promise<LogisticsMaterial | null> {
  return prisma.logisticsMaterial.findUnique({ where: { id } });
}

export type CreateMaterialInput = {
  name: string;
  quantityOnHand: number;
  location: string | null;
};

/**
 * Real create — same transactional "row + its real InventoryItem link, in
 * one write" shape as vehicleRepository.createVehicleWithInventoryItem()
 * (Phase 3, 2026-08-17: Material joins Inventory's shared identity layer).
 * A LogisticsMaterial row can no longer exist without a real InventoryItem
 * behind it, matching the schema's now-required inventoryItemId.
 * `quantityOnHand` is the real starting stock (Phase 8, 2026-08-17) --
 * reserved/consumed always start at 0 for a brand new row.
 */
export function createMaterialWithInventoryItem(data: CreateMaterialInput): Promise<LogisticsMaterial> {
  return prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.create({
      data: { title: data.name, kind: "material", location: data.location },
    });
    return tx.logisticsMaterial.create({
      data: { name: data.name, quantityOnHand: data.quantityOnHand, location: data.location, inventoryItemId: item.id },
    });
  });
}
