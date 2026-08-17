import type { LogisticsMaterial } from "@prisma/client";

import * as repo from "../repositories/logisticsMaterialRepository";

export type LogisticsMaterialDto = {
  id: string;
  name: string;
  quantity: number | null;
  location: string | null;
};

function toDto(row: LogisticsMaterial): LogisticsMaterialDto {
  return { id: row.id, name: row.name, quantity: row.quantity, location: row.location };
}

export async function listMaterials(): Promise<LogisticsMaterialDto[]> {
  const rows = await repo.findAllMaterials();
  return rows.map(toDto);
}

export type CreateMaterialInput = {
  name: string;
  quantity?: number;
  location?: string;
};

/**
 * Real create — the only way a real LogisticsMaterial row comes to exist.
 * Phase 4 shipped this model as schema-only (zero seeded rows, zero
 * routes); Phase 8's real Storage Browse zone needs a real way to put
 * something in it, the same gap Truck/Driver had before the Dispatch form
 * existed. Phase 3 (2026-08-17) additionally joins it to Inventory's real
 * shared identity layer at create time, same as every other Inventory
 * capability's own create path.
 */
export async function createMaterial(input: CreateMaterialInput): Promise<LogisticsMaterialDto> {
  const row = await repo.createMaterialWithInventoryItem({
    name: input.name.trim(),
    quantity: input.quantity ?? null,
    location: input.location?.trim() || null,
  });
  return toDto(row);
}
