import type { InventoryItem, Asset, GenealogyNode } from "@prisma/client";

import { prisma } from "../lib/prisma";

export type InventoryItemWithDetail = InventoryItem & {
  asset: Asset | null;
  genealogyNode: GenealogyNode | null;
};

export function findAllItems(): Promise<InventoryItemWithDetail[]> {
  return prisma.inventoryItem.findMany({
    include: { asset: true, genealogyNode: true },
    orderBy: { title: "asc" },
  });
}

export function findItemById(id: string): Promise<InventoryItemWithDetail | null> {
  return prisma.inventoryItem.findUnique({
    where: { id },
    include: { asset: true, genealogyNode: true },
  });
}
