import type { LogisticsModule } from "@prisma/client";

import { NotFoundError, ValidationError } from "../lib/httpErrors";
import * as repo from "../repositories/logisticsModuleRepository";

export type LogisticsModuleDto = {
  id: string;
  name: string;
  location: string | null;
  dispatchId: string | null;
  productionOutputId: string | null;
  inventoryItemId: string | null;
};

function toDto(row: LogisticsModule): LogisticsModuleDto {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    dispatchId: row.dispatchId,
    productionOutputId: row.productionOutputId,
    inventoryItemId: row.inventoryItemId,
  };
}

export async function listModules(): Promise<LogisticsModuleDto[]> {
  const rows = await repo.findAllModules();
  return rows.map(toDto);
}

export type CreateModuleInput = {
  name: string;
  location?: string;
  dispatchId?: string;
  /// Real, optional (Phase 9, 2026-08-17) -- a real ProductionOutput id
  /// this module's physical origin actually is. When given, this module
  /// shares that output's real InventoryItem (never a new one) -- the
  /// shared-identity path Manufacturing -> Inventory -> Logistics was
  /// missing. Omitted, this module gets no real production provenance
  /// (the existing, unchanged default for modules with no known origin).
  productionOutputId?: string;
};

/**
 * Real create — the only way a real LogisticsModule row comes to exist,
 * closing the same Phase-6-flagged gap as LogisticsMaterial. `dispatchId`
 * is optional (a module can be staged in the Yard with no haul assigned
 * yet, per the schema's own design) but if given, must reference a real
 * Dispatch — same "assert real, don't trust the client" discipline used
 * everywhere else in this module. `productionOutputId`, when given, must
 * reference a real ProductionOutput not already claimed by another real
 * module (each real physical output has exactly one real logistics
 * custody record, never two).
 */
export async function createModule(input: CreateModuleInput): Promise<LogisticsModuleDto> {
  if (input.dispatchId) {
    const dispatch = await repo.findDispatchById(input.dispatchId);
    if (!dispatch) throw new NotFoundError(`No logistics dispatch with id "${input.dispatchId}"`);
  }

  let inventoryItemId: string | null = null;
  if (input.productionOutputId) {
    const output = await repo.findProductionOutputById(input.productionOutputId);
    if (!output) throw new NotFoundError(`No production output with id "${input.productionOutputId}"`);
    const claimed = await repo.findModuleByProductionOutputId(input.productionOutputId);
    if (claimed) {
      throw new ValidationError(
        `Production output "${input.productionOutputId}" already has a real logistics module (${claimed.id}) — a physical output gets exactly one.`
      );
    }
    inventoryItemId = output.inventoryItemId;
  }

  const row = await repo.createModule({
    name: input.name.trim(),
    location: input.location?.trim() || null,
    dispatchId: input.dispatchId ?? null,
    productionOutputId: input.productionOutputId ?? null,
    inventoryItemId,
  });
  return toDto(row);
}
