import type { MarketCostRecord, CostCategory } from "@prisma/client";

import { NotFoundError, ValidationError } from "../lib/httpErrors";
import * as repo from "../repositories/marketCostRecordRepository";

export type MarketCostRecordDto = {
  id: string;
  category: CostCategory;
  itemName: string;
  sku: string | null;
  unit: string;
  unitCostCents: number;
  region: string | null;
  sourceName: string;
  sourceUrl: string | null;
  observedAt: string;
  notes: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

function toDto(row: MarketCostRecord): MarketCostRecordDto {
  return {
    id: row.id,
    category: row.category,
    itemName: row.itemName,
    sku: row.sku,
    unit: row.unit,
    unitCostCents: row.unitCostCents,
    region: row.region,
    sourceName: row.sourceName,
    sourceUrl: row.sourceUrl,
    observedAt: row.observedAt.toISOString(),
    notes: row.notes,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listRecords(): Promise<MarketCostRecordDto[]> {
  const rows = await repo.findAllRecords();
  return rows.map(toDto);
}

export type CreateRecordInput = {
  category: CostCategory;
  itemName: string;
  sku?: string;
  unit: string;
  unitCostCents: number;
  region?: string;
  sourceName: string;
  sourceUrl?: string;
  observedAt: string;
  notes?: string;
  createdById: string;
};

/**
 * Real create -- the only way a MarketCostRecord comes to exist. Refuses a
 * non-positive cost (same "assert real, don't trust the client" posture as
 * costEstimateService's assertRealInputs) and refuses a blank source name,
 * since an unsourced row is exactly the fabrication this model exists to
 * prevent.
 */
export async function createRecord(input: CreateRecordInput): Promise<MarketCostRecordDto> {
  if (input.unitCostCents <= 0) throw new ValidationError("Unit cost must be a real, positive amount.");
  if (!input.sourceName.trim()) throw new ValidationError("A real source name is required -- never create an unsourced cost record.");

  const observedAt = new Date(input.observedAt);
  if (Number.isNaN(observedAt.getTime())) throw new ValidationError('"observedAt" must be a real, valid date.');

  const row = await repo.createRecord({
    category: input.category,
    itemName: input.itemName.trim(),
    sku: input.sku?.trim() || null,
    unit: input.unit.trim(),
    unitCostCents: input.unitCostCents,
    region: input.region?.trim() || null,
    sourceName: input.sourceName.trim(),
    sourceUrl: input.sourceUrl?.trim() || null,
    observedAt,
    notes: input.notes?.trim() || null,
    createdById: input.createdById,
  });
  return toDto(row);
}

/** Real bridge to a stable MaterialCatalogItem (Phase 8, 2026-08-17) -- the missing link the audit found: MarketCostRecord itself has no stable itemName/sku identity (several real rows can represent one re-observed material), so it points at the real catalog item rather than physical inventory pointing at one arbitrary priced observation. */
export async function linkCatalogItem(id: string, materialCatalogItemId: string): Promise<MarketCostRecordDto> {
  const existing = await repo.findRecordById(id);
  if (!existing) throw new NotFoundError(`No market cost record with id "${id}"`);
  const row = await repo.linkCatalogItem(id, materialCatalogItemId);
  return toDto(row);
}
