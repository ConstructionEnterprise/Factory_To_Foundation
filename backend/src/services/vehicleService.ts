import type { LogisticsDispatch } from "@prisma/client";

import { NotFoundError } from "../lib/httpErrors";
import * as repo from "../repositories/vehicleRepository";
import type { VehicleWithTruck } from "../repositories/vehicleRepository";

export type VehicleDto = {
  id: string;
  identifier: string;
  vehicleClass: string;
  status: string;
  location: string | null;
  inventoryItemId: string | null;
  /** Real identifier of the LogisticsTruck this vehicle specializes into, when one exists (truck-class vehicles only) -- see Vehicle.logisticsTruck's schema.prisma doc comment. */
  logisticsTruckIdentifier: string | null;
  createdAt: string;
};

function toDto(row: VehicleWithTruck): VehicleDto {
  return {
    id: row.id,
    identifier: row.identifier,
    vehicleClass: row.vehicleClass,
    status: row.status,
    location: row.location,
    inventoryItemId: row.inventoryItemId,
    logisticsTruckIdentifier: row.logisticsTruck?.identifier ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export type VehicleDispatchSummaryDto = {
  id: string;
  status: string;
  destinationProjectId: string;
  route: string | null;
  eta: string | null;
  miles: number | null;
  dispatchedAt: string;
};

function toDispatchSummaryDto(row: LogisticsDispatch): VehicleDispatchSummaryDto {
  return {
    id: row.id,
    status: row.status,
    destinationProjectId: row.destinationProjectId,
    route: row.route,
    eta: row.eta ? row.eta.toISOString() : null,
    miles: row.miles,
    dispatchedAt: row.dispatchedAt.toISOString(),
  };
}

export async function listVehicles(): Promise<VehicleDto[]> {
  const rows = await repo.findAllVehicles();
  return rows.map(toDto);
}

export type VehicleDetailDto = VehicleDto & { dispatches: VehicleDispatchSummaryDto[] };

/** Real vehicle detail + its real generalized dispatch history (via LogisticsDispatch.vehicleId, Phase 3.3). */
export async function getVehicle(id: string): Promise<VehicleDetailDto> {
  const row = await repo.findVehicleById(id);
  if (!row) throw new NotFoundError(`No vehicle with id "${id}"`);

  const dispatches = await repo.findDispatchesByVehicleId(id);
  return { ...toDto(row), dispatches: dispatches.map(toDispatchSummaryDto) };
}
