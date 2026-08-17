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

export function findRecordById(id: string): Promise<MarketCostRecord | null> {
  return prisma.marketCostRecord.findUnique({ where: { id } });
}

/** Real bridge to a stable MaterialCatalogItem (Phase 8, 2026-08-17) -- see MaterialCatalogItem's own schema doc comment for why this exists. */
export function linkCatalogItem(id: string, materialCatalogItemId: string): Promise<MarketCostRecord> {
  return prisma.marketCostRecord.update({ where: { id }, data: { materialCatalogItemId } });
}
