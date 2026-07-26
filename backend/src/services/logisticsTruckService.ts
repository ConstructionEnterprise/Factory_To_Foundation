import type { LogisticsTruck } from "@prisma/client";

import * as repo from "../repositories/logisticsTruckRepository";

export type LogisticsTruckDto = {
  id: string;
  identifier: string;
};

function toDto(row: LogisticsTruck): LogisticsTruckDto {
  return { id: row.id, identifier: row.identifier };
}

export async function listTrucks(): Promise<LogisticsTruckDto[]> {
  const rows = await repo.findAllTrucks();
  return rows.map(toDto);
}

/** Real create — the only way a real LogisticsTruck row comes to exist; Phase 4 shipped zero seeded rows on purpose, so every truck a user sees from here on is one a real user actually entered. */
export async function createTruck(identifier: string): Promise<LogisticsTruckDto> {
  const row = await repo.createTruck(identifier.trim());
  return toDto(row);
}
