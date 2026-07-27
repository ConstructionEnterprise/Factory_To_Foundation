import type { LogisticsModule } from "@prisma/client";

import { prisma } from "../lib/prisma";

export function findAllModules(): Promise<LogisticsModule[]> {
  return prisma.logisticsModule.findMany({ orderBy: { name: "asc" } });
}

export function findDispatchById(id: string) {
  return prisma.logisticsDispatch.findUnique({ where: { id } });
}

export type CreateModuleInput = {
  name: string;
  location: string | null;
  dispatchId: string | null;
};

export function createModule(data: CreateModuleInput): Promise<LogisticsModule> {
  return prisma.logisticsModule.create({ data });
}
