import type { LogisticsMaterial, MaterialCatalogItem, MaterialInventoryEvent } from "@prisma/client";

import { NotFoundError, ValidationError } from "../lib/httpErrors";
import * as repo from "../repositories/materialInventoryRepository";

export type MaterialCatalogItemDto = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  createdAt: string;
};

function toCatalogItemDto(row: MaterialCatalogItem): MaterialCatalogItemDto {
  return { id: row.id, name: row.name, sku: row.sku, unit: row.unit, createdAt: row.createdAt.toISOString() };
}

export async function listCatalogItems(): Promise<MaterialCatalogItemDto[]> {
  const rows = await repo.findAllCatalogItems();
  return rows.map(toCatalogItemDto);
}

export type CreateCatalogItemInput = { name: string; sku?: string; unit: string };

/** The real, stable material-type identity's only creation path (Phase 8, 2026-08-17) -- see MaterialCatalogItem's own schema doc comment for why this exists instead of reusing MarketCostRecord directly. */
export async function createCatalogItem(input: CreateCatalogItemInput, createdById: string): Promise<MaterialCatalogItemDto> {
  const row = await repo.createCatalogItem({
    name: input.name.trim(),
    sku: input.sku?.trim() || null,
    unit: input.unit.trim(),
    createdById,
  });
  return toCatalogItemDto(row);
}

/** Links a real, already-existing LogisticsMaterial row to a real, already-existing MaterialCatalogItem -- the bridge that makes BOM->inventory resolution possible for that material. */
export async function linkMaterialToCatalogItem(materialId: string, materialCatalogItemId: string): Promise<void> {
  const material = await repo.findMaterialById(materialId);
  if (!material) throw new NotFoundError(`No material with id "${materialId}"`);
  const catalogItem = await repo.findCatalogItemById(materialCatalogItemId);
  if (!catalogItem) throw new NotFoundError(`No material catalog item with id "${materialCatalogItemId}"`);
  await repo.linkMaterialToCatalogItem(materialId, materialCatalogItemId);
}

export type MaterialInventoryEventDto = {
  id: string;
  materialId: string;
  eventType: string;
  quantity: number;
  productionRunId: string | null;
  reason: string | null;
  changedById: string;
  changedAt: string;
};

function toEventDto(row: MaterialInventoryEvent): MaterialInventoryEventDto {
  return {
    id: row.id,
    materialId: row.materialId,
    eventType: row.eventType,
    quantity: row.quantity,
    productionRunId: row.productionRunId,
    reason: row.reason,
    changedById: row.changedById,
    changedAt: row.changedAt.toISOString(),
  };
}

export async function listEventsForMaterial(materialId: string): Promise<MaterialInventoryEventDto[]> {
  const material = await repo.findMaterialById(materialId);
  if (!material) throw new NotFoundError(`No material with id "${materialId}"`);
  const rows = await repo.findEventsByMaterialId(materialId);
  return rows.map(toEventDto);
}

function assertPositive(quantity: number, label: string) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new ValidationError(`${label} must be a real positive whole number.`);
  }
}

async function requireMaterial(materialId: string): Promise<LogisticsMaterial> {
  const material = await repo.findMaterialById(materialId);
  if (!material) throw new NotFoundError(`No material with id "${materialId}"`);
  return material;
}

/**
 * Real stock receipt (Phase 8, 2026-08-17) -- the only way quantityOnHand
 * ever increases. Used for CE_Forge's one-time initial supply and any
 * later real restock; never called by production/execution code.
 */
export async function receiveStock(
  materialId: string,
  quantity: number,
  changedById: string,
  reason?: string
): Promise<MaterialInventoryEventDto> {
  assertPositive(quantity, "Received quantity");
  await requireMaterial(materialId);
  const { event } = await repo.recordInventoryTransaction({
    materialId,
    eventType: "receive",
    quantity,
    quantityOnHandDelta: quantity,
    quantityReservedDelta: 0,
    quantityConsumedDelta: 0,
    productionRunId: null,
    reason: reason?.trim() || null,
    changedById,
  });
  return toEventDto(event);
}

/**
 * Real reservation -- validates real availability (onHand - reserved)
 * before committing, with an honest shortfall message rather than a
 * generic failure. This is the real "CAN EXECUTE?" check from a resource
 * perspective: reserving is itself the real, non-simulated act of
 * committing inventory to a specific real production run.
 */
export async function reserveQuantity(
  materialId: string,
  quantity: number,
  productionRunId: string,
  changedById: string,
  reason?: string
): Promise<MaterialInventoryEventDto> {
  assertPositive(quantity, "Reserved quantity");
  const material = await requireMaterial(materialId);
  const available = material.quantityOnHand - material.quantityReserved;
  if (available < quantity) {
    throw new ValidationError(
      `Insufficient material "${material.name}": ${available} available, ${quantity} required (${quantity - available} short).`
    );
  }
  const { event } = await repo.recordInventoryTransaction({
    materialId,
    eventType: "reserve",
    quantity,
    quantityOnHandDelta: 0,
    quantityReservedDelta: quantity,
    quantityConsumedDelta: 0,
    productionRunId,
    reason: reason?.trim() || null,
    changedById,
  });
  return toEventDto(event);
}

/** Real release of a real prior reservation (e.g. a cancelled/re-scoped run) -- never below zero reserved. */
export async function releaseReservation(
  materialId: string,
  quantity: number,
  productionRunId: string,
  changedById: string,
  reason?: string
): Promise<MaterialInventoryEventDto> {
  assertPositive(quantity, "Released quantity");
  const material = await requireMaterial(materialId);
  if (material.quantityReserved < quantity) {
    throw new ValidationError(`Cannot release ${quantity} -- only ${material.quantityReserved} real quantity of "${material.name}" is currently reserved.`);
  }
  const { event } = await repo.recordInventoryTransaction({
    materialId,
    eventType: "release",
    quantity,
    quantityOnHandDelta: 0,
    quantityReservedDelta: -quantity,
    quantityConsumedDelta: 0,
    productionRunId,
    reason: reason?.trim() || null,
    changedById,
  });
  return toEventDto(event);
}

/**
 * Real consumption -- can only consume what was actually reserved first
 * (enforces the real reserve-before-consume flow, never a skip-ahead
 * decrement). Moves the quantity out of both onHand and reserved into
 * consumed in one real transaction.
 */
export async function consumeQuantity(
  materialId: string,
  quantity: number,
  productionRunId: string,
  changedById: string,
  reason?: string
): Promise<MaterialInventoryEventDto> {
  assertPositive(quantity, "Consumed quantity");
  const material = await requireMaterial(materialId);
  if (material.quantityReserved < quantity) {
    throw new ValidationError(
      `Cannot consume ${quantity} of "${material.name}" -- only ${material.quantityReserved} real quantity is currently reserved. Reserve before consuming.`
    );
  }
  const { event } = await repo.recordInventoryTransaction({
    materialId,
    eventType: "consume",
    quantity,
    quantityOnHandDelta: -quantity,
    quantityReservedDelta: -quantity,
    quantityConsumedDelta: quantity,
    productionRunId,
    reason: reason?.trim() || null,
    changedById,
  });
  return toEventDto(event);
}
