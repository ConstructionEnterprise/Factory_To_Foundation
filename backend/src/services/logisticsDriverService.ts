import type { LogisticsDriver } from "@prisma/client";

import * as repo from "../repositories/logisticsDriverRepository";

export type LogisticsDriverDto = {
  id: string;
  name: string;
};

function toDto(row: LogisticsDriver): LogisticsDriverDto {
  return { id: row.id, name: row.name };
}

export async function listDrivers(): Promise<LogisticsDriverDto[]> {
  const rows = await repo.findAllDrivers();
  return rows.map(toDto);
}

/** Real create — the only way a real LogisticsDriver row comes to exist, same reasoning as logisticsTruckService.ts's createTruck(). */
export async function createDriver(name: string): Promise<LogisticsDriverDto> {
  const row = await repo.createDriver(name.trim());
  return toDto(row);
}
