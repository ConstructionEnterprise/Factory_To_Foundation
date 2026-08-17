import type { MarketCostRecord, CostCategory } from "@prisma/client";

import { prisma } from "../lib/prisma";

export function findAllRecords(): Promise<MarketCostRecord[]> {
  return prisma.marketCostRecord.findMany({ orderBy: { observedAt: "desc" } });
}

export type CreateRecordData = {
  category: CostCategory;
  itemName: string;
  sku: string | null;
  unit: string;
  unitCostCents: number;
  region: string | null;
  sourceName: string;
  sourceUrl: string | null;
  observedAt: Date;
  notes: string | null;
  createdById: string;
};

export function createRecord(data: CreateRecordData): Promise<MarketCostRecord> {
  return prisma.marketCostRecord.create({ data });
}
