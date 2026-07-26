import type { LogisticsDispatch } from "@prisma/client";

import { NotFoundError } from "../lib/httpErrors";
import * as repo from "../repositories/logisticsDispatchRepository";

export type LogisticsDispatchDto = {
  id: string;
  truckId: string;
  driverId: string;
  destinationProjectId: string;
  status: string;
  route: string | null;
  traffic: string | null;
  eta: string | null;
  dispatchedAt: string;
};

function toDto(row: LogisticsDispatch): LogisticsDispatchDto {
  return {
    id: row.id,
    truckId: row.truckId,
    driverId: row.driverId,
    destinationProjectId: row.destinationProjectId,
    status: row.status,
    route: row.route,
    traffic: row.traffic,
    eta: row.eta ? row.eta.toISOString() : null,
    dispatchedAt: row.dispatchedAt.toISOString(),
  };
}

export async function listDispatches(): Promise<LogisticsDispatchDto[]> {
  const rows = await repo.findAllDispatches();
  return rows.map(toDto);
}

export type CreateDispatchInput = {
  truckId: string;
  driverId: string;
  destinationProjectId: string;
  eta?: string;
  route?: string;
  traffic?: string;
};

/**
 * Real validation before writing anything — a client-supplied truckId/
 * driverId/destinationProjectId must reference a row that genuinely
 * exists, same "assert real, don't trust the client" discipline as
 * projectFileService.ts's assertRealProjectAndTreeNode() and
 * logisticsDocumentService.ts's assertRealDispatch().
 */
export async function createDispatch(input: CreateDispatchInput): Promise<LogisticsDispatchDto> {
  const truck = await repo.findTruckById(input.truckId);
  if (!truck) throw new NotFoundError(`No logistics truck with id "${input.truckId}"`);

  const driver = await repo.findDriverById(input.driverId);
  if (!driver) throw new NotFoundError(`No logistics driver with id "${input.driverId}"`);

  const project = await repo.findConstructionProjectById(input.destinationProjectId);
  if (!project) throw new NotFoundError(`No construction project with id "${input.destinationProjectId}"`);

  const row = await repo.createDispatch({
    truckId: input.truckId,
    driverId: input.driverId,
    destinationProjectId: input.destinationProjectId,
    eta: input.eta ? new Date(input.eta) : null,
    route: input.route ?? null,
    traffic: input.traffic ?? null,
  });
  return toDto(row);
}
