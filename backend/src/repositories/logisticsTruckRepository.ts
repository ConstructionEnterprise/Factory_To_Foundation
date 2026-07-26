import type { LogisticsTruck } from "@prisma/client";

import { prisma } from "../lib/prisma";

export function findAllTrucks(): Promise<LogisticsTruck[]> {
  return prisma.logisticsTruck.findMany({ orderBy: { identifier: "asc" } });
}

export function findTruckById(id: string): Promise<LogisticsTruck | null> {
  return prisma.logisticsTruck.findUnique({ where: { id } });
}

export function createTruck(identifier: string): Promise<LogisticsTruck> {
  return prisma.logisticsTruck.create({ data: { identifier } });
}
