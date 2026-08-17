import type { LogisticsDispatch, Vehicle, VehicleClass, VehicleStatus } from "@prisma/client";

import { prisma } from "../lib/prisma";

export type VehicleWithTruck = Vehicle & { logisticsTruck: { identifier: string } | null };

export type CreateVehicleData = {
  identifier: string;
  vehicleClass: VehicleClass;
  status: VehicleStatus;
  location: string | null;
};

/** Creates the Vehicle alongside its real InventoryItem link in one transaction — same "Vehicle always has an InventoryItem" invariant the truck-backfill path already established, never a dangling unlinked row. */
export function createVehicleWithInventoryItem(data: CreateVehicleData): Promise<VehicleWithTruck> {
  return prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.create({
      data: { title: data.identifier, kind: "vehicle", location: data.location },
    });
    return tx.vehicle.create({
      data: { ...data, inventoryItemId: item.id },
      include: { logisticsTruck: { select: { identifier: true } } },
    });
  });
}

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
