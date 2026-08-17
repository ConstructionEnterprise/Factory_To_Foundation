import type { CostAssembly, CostAssemblyComponent, MarketCostRecord, ProductivityRecord } from "@prisma/client";

import { prisma } from "../lib/prisma";

export type AssemblyWithComponents = CostAssembly & {
  components: (CostAssemblyComponent & { marketCostRecord: MarketCostRecord; productivityRecord: ProductivityRecord | null })[];
};

const withComponents = {
  components: { include: { marketCostRecord: true, productivityRecord: true } },
} as const;

export function findAllAssemblies(): Promise<AssemblyWithComponents[]> {
  return prisma.costAssembly.findMany({ include: withComponents, orderBy: { createdAt: "desc" } });
}

export function findAssemblyById(id: string): Promise<AssemblyWithComponents | null> {
  return prisma.costAssembly.findUnique({ where: { id }, include: withComponents });
}

export function findMarketCostRecordById(id: string): Promise<MarketCostRecord | null> {
  return prisma.marketCostRecord.findUnique({ where: { id } });
}

export type CreateAssemblyData = {
  name: string;
  unit: string;
  description: string | null;
  assumptionNotes: string | null;
  createdById: string;
};

export function createAssembly(data: CreateAssemblyData): Promise<CostAssembly> {
  return prisma.costAssembly.create({ data });
}

export type CreateComponentData = {
  assemblyId: string;
  marketCostRecordId: string;
  quantityPerUnit: number;
  quantitySourceName: string;
  quantityNotes: string | null;
  productivityRecordId: string | null;
};

export function createComponent(data: CreateComponentData): Promise<CostAssemblyComponent> {
  return prisma.costAssemblyComponent.create({ data });
}

export function findProductivityRecordById(id: string) {
  return prisma.productivityRecord.findUnique({ where: { id } });
}
