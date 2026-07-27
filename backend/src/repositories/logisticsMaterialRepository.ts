import type { LogisticsMaterial } from "@prisma/client";

import { prisma } from "../lib/prisma";

export function findAllMaterials(): Promise<LogisticsMaterial[]> {
  return prisma.logisticsMaterial.findMany({ orderBy: { name: "asc" } });
}

export type CreateMaterialInput = {
  name: string;
  quantity: number | null;
  location: string | null;
};

export function createMaterial(data: CreateMaterialInput): Promise<LogisticsMaterial> {
  return prisma.logisticsMaterial.create({ data });
}
