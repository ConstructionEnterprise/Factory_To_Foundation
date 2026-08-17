import type { LogisticsModule } from "@prisma/client";

import { prisma } from "../lib/prisma";

export function findAllModules(): Promise<LogisticsModule[]> {
  return prisma.logisticsModule.findMany({ orderBy: { name: "asc" } });
}

export function findDispatchById(id: string) {
  return prisma.logisticsDispatch.findUnique({ where: { id } });
}

/** Real check (Phase 9, 2026-08-17) -- resolves the real InventoryItem a production-originated module should share, and confirms no other real module already claimed it. */
export function findProductionOutputById(id: string) {
  return prisma.productionOutput.findUnique({ where: { id } });
}

export function findModuleByProductionOutputId(productionOutputId: string): Promise<LogisticsModule | null> {
  return prisma.logisticsModule.findUnique({ where: { productionOutputId } });
}

export type CreateModuleInput = {
  name: string;
  location: string | null;
  dispatchId: string | null;
  /// Real, optional (Phase 9) -- when set, this module shares the exact
  /// same InventoryItem its real ProductionOutput already created, rather
  /// than staying unlinked until a later backfill script runs.
  productionOutputId: string | null;
  inventoryItemId: string | null;
};

export function createModule(data: CreateModuleInput): Promise<LogisticsModule> {
  return prisma.logisticsModule.create({ data });
}
