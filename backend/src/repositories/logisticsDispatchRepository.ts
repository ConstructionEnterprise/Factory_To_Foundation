import type { LogisticsDispatch } from "@prisma/client";

import { prisma } from "../lib/prisma";

export function findAllDispatches(): Promise<LogisticsDispatch[]> {
  return prisma.logisticsDispatch.findMany({ orderBy: { dispatchedAt: "desc" } });
}

export function findTruckById(id: string) {
  return prisma.logisticsTruck.findUnique({ where: { id } });
}

export function findDriverById(id: string) {
  return prisma.logisticsDriver.findUnique({ where: { id } });
}

/** Real validation against the actual seeded/created project — never trust a client-supplied destinationProjectId without checking it exists. */
export function findConstructionProjectById(id: string) {
  return prisma.constructionProject.findUnique({ where: { id } });
}

export type CreateDispatchInput = {
  truckId: string;
  driverId: string;
  destinationProjectId: string;
  eta: Date | null;
  route: string | null;
  traffic: string | null;
};

export function createDispatch(data: CreateDispatchInput): Promise<LogisticsDispatch> {
  return prisma.logisticsDispatch.create({ data });
}
