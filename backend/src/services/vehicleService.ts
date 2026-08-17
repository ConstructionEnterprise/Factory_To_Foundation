import type { LogisticsDispatch, VehicleClass, VehicleStatus } from "@prisma/client";

import { NotFoundError, ValidationError } from "../lib/httpErrors";
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

export type CreateVehicleInput = {
  identifier: string;
  vehicleClass: VehicleClass;
  status?: VehicleStatus;
  location?: string;
};

/**
 * Real create — closes the gap where truck-class vehicles get a Vehicle
 * row via the LogisticsTruck backfill path but the other 3 real
 * VehicleClass values (autonomous_dolly, trailer, forklift) had no path
 * to exist at all. Deliberately rejects vehicleClass="truck" here: a
 * truck-class Vehicle is only ever meant to specialize a real
 * LogisticsTruck (see Vehicle.logisticsTruck's schema doc comment), and
 * that link is established exclusively via POST /logistics-trucks + the
 * vehicle-fleet backfill, never invented standalone.
 */
export async function createVehicle(input: CreateVehicleInput): Promise<VehicleDto> {
  if (input.vehicleClass === "truck") {
    throw new ValidationError(
      'vehicleClass "truck" cannot be created directly -- create the LogisticsTruck via POST /logistics-trucks instead, which links to a Vehicle automatically.'
    );
  }

  const row = await repo.createVehicleWithInventoryItem({
    identifier: input.identifier.trim(),
    vehicleClass: input.vehicleClass,
    status: input.status ?? "active",
    location: input.location?.trim() || null,
  });
  return toDto(row);
}
