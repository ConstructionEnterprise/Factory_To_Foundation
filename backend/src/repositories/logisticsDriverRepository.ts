import type { LogisticsDriver } from "@prisma/client";

import { prisma } from "../lib/prisma";

export function findAllDrivers(): Promise<LogisticsDriver[]> {
  return prisma.logisticsDriver.findMany({ orderBy: { name: "asc" } });
}

export function findDriverById(id: string): Promise<LogisticsDriver | null> {
  return prisma.logisticsDriver.findUnique({ where: { id } });
}

export function createDriver(name: string): Promise<LogisticsDriver> {
  return prisma.logisticsDriver.create({ data: { name } });
}
