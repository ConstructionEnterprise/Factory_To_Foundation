import type { LogisticsModule } from "@prisma/client";

import { NotFoundError } from "../lib/httpErrors";
import * as repo from "../repositories/logisticsModuleRepository";

export type LogisticsModuleDto = {
  id: string;
  name: string;
  location: string | null;
  dispatchId: string | null;
};

function toDto(row: LogisticsModule): LogisticsModuleDto {
  return { id: row.id, name: row.name, location: row.location, dispatchId: row.dispatchId };
}

export async function listModules(): Promise<LogisticsModuleDto[]> {
  const rows = await repo.findAllModules();
  return rows.map(toDto);
}

export type CreateModuleInput = {
  name: string;
  location?: string;
  dispatchId?: string;
};

/**
 * Real create — the only way a real LogisticsModule row comes to exist,
 * closing the same Phase-6-flagged gap as LogisticsMaterial. `dispatchId`
 * is optional (a module can be staged in the Yard with no haul assigned
 * yet, per the schema's own design) but if given, must reference a real
 * Dispatch — same "assert real, don't trust the client" discipline used
 * everywhere else in this module.
 */
export async function createModule(input: CreateModuleInput): Promise<LogisticsModuleDto> {
  if (input.dispatchId) {
    const dispatch = await repo.findDispatchById(input.dispatchId);
    if (!dispatch) throw new NotFoundError(`No logistics dispatch with id "${input.dispatchId}"`);
  }

  const row = await repo.createModule({
    name: input.name.trim(),
    location: input.location?.trim() || null,
    dispatchId: input.dispatchId ?? null,
  });
  return toDto(row);
}
