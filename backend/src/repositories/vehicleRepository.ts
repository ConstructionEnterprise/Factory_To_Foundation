import type { LogisticsDispatch, Vehicle } from "@prisma/client";

import { prisma } from "../lib/prisma";

export type VehicleWithTruck = Vehicle & { logisticsTruck: { identifier: string } | null };

export function findAllVehicles(): Promise<VehicleWithTruck[]> {
  return prisma.vehicle.findMany({
    include: { logisticsTruck: { select: { identifier: true } } },
    orderBy: { identifier: "asc" },
  });
}

export function findVehicleById(id: string): Promise<VehicleWithTruck | null> {
  return prisma.vehicle.findUnique({
    where: { id },
    include: { logisticsTruck: { select: { identifier: true } } },
  });
}

export function findDispatchesByVehicleId(vehicleId: string): Promise<LogisticsDispatch[]> {
  return prisma.logisticsDispatch.findMany({
    where: { vehicleId },
    orderBy: { dispatchedAt: "desc" },
  });
}
