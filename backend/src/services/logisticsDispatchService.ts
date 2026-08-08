import type { LogisticsCustodyEvent, LogisticsDispatch, LogisticsStatus } from "@prisma/client";

import { NotFoundError, ValidationError } from "../lib/httpErrors";
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
  odometerStart: number | null;
  odometerEnd: number | null;
  miles: number | null;
  businessPurpose: string | null;
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
    odometerStart: row.odometerStart,
    odometerEnd: row.odometerEnd,
    miles: row.miles,
    businessPurpose: row.businessPurpose,
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
  /** Real starting odometer reading — known before the haul departs, unlike odometerEnd (see recordMileage() for how the trip is later closed out). */
  odometerStart?: number;
  businessPurpose?: string;
  createdById: string;
};

/**
 * Real validation before writing anything — a client-supplied truckId/
 * driverId/destinationProjectId must reference a row that genuinely
 * exists, same "assert real, don't trust the client" discipline as
 * projectFileService.ts's assertRealProjectAndTreeNode() and
 * logisticsDocumentService.ts's assertRealDispatch(). Also writes the real
 * first chain-of-custody event (Phase 7) — a dispatch's custody history
 * starts at creation, not at its first status change.
 */
export async function createDispatch(input: CreateDispatchInput): Promise<LogisticsDispatchDto> {
  const truck = await repo.findTruckById(input.truckId);
  if (!truck) throw new NotFoundError(`No logistics truck with id "${input.truckId}"`);

  const driver = await repo.findDriverById(input.driverId);
  if (!driver) throw new NotFoundError(`No logistics driver with id "${input.driverId}"`);

  const project = await repo.findConstructionProjectById(input.destinationProjectId);
  if (!project) throw new NotFoundError(`No construction project with id "${input.destinationProjectId}"`);

  const { dispatch } = await repo.createDispatch({
    truckId: input.truckId,
    driverId: input.driverId,
    destinationProjectId: input.destinationProjectId,
    eta: input.eta ? new Date(input.eta) : null,
    route: input.route ?? null,
    traffic: input.traffic ?? null,
    odometerStart: input.odometerStart ?? null,
    businessPurpose: input.businessPurpose ?? null,
    createdById: input.createdById,
  });
  return toDto(dispatch);
}

export type RecordMileageInput = {
  odometerStart?: number;
  odometerEnd?: number;
  businessPurpose?: string;
};

/**
 * Real, honest mileage recording — miles is always derived here from real
 * odometer readings (existing + newly-supplied, merged), never accepted
 * directly from the client as an independent number. A caller can record
 * just the starting reading (e.g. at trip departure), just the ending
 * reading (e.g. at delivery), or both at once; whichever of the two is
 * missing after the merge leaves `miles` honestly null rather than a
 * fabricated partial figure.
 */
export async function recordMileage(dispatchId: string, input: RecordMileageInput): Promise<LogisticsDispatchDto> {
  const existing = await repo.findDispatchById(dispatchId);
  if (!existing) throw new NotFoundError(`No logistics dispatch with id "${dispatchId}"`);

  const odometerStart = input.odometerStart ?? existing.odometerStart ?? null;
  const odometerEnd = input.odometerEnd ?? existing.odometerEnd ?? null;
  const businessPurpose = input.businessPurpose ?? existing.businessPurpose ?? null;

  let miles: number | null = null;
  if (odometerStart !== null && odometerEnd !== null) {
    if (odometerEnd < odometerStart) {
      throw new ValidationError(
        `Ending odometer reading (${odometerEnd}) cannot be less than the starting reading (${odometerStart}).`
      );
    }
    miles = odometerEnd - odometerStart;
  }

  const dispatch = await repo.updateMileage(dispatchId, { odometerStart, odometerEnd, miles, businessPurpose });
  return toDto(dispatch);
}

/**
 * Real, closed state machine — the only two legal real-world moves a
 * dispatch's status can make (staged -> in_transit -> delivered), matching
 * LogisticsModule's own "derived from dispatch status" design and the
 * schema's doc comment on LogisticsStatus. No skipping ahead (staged
 * straight to delivered), no going backward, no re-confirming the same
 * status — each would either fabricate a custody event for something that
 * didn't really happen in that order, or silently allow a no-op "change."
 * `delivered` is real and terminal: nothing transitions out of it here
 * (a real correction, if one is ever needed, is a later, separately-scoped
 * decision, not silently allowed by this map).
 */
const VALID_TRANSITIONS: Record<LogisticsStatus, LogisticsStatus[]> = {
  staged: ["in_transit"],
  in_transit: ["delivered"],
  delivered: [],
};

export async function transitionStatus(
  dispatchId: string,
  toStatus: LogisticsStatus,
  changedById: string,
  notes?: string
): Promise<LogisticsDispatchDto> {
  const existing = await repo.findDispatchById(dispatchId);
  if (!existing) throw new NotFoundError(`No logistics dispatch with id "${dispatchId}"`);

  const allowed = VALID_TRANSITIONS[existing.status];
  if (!allowed.includes(toStatus)) {
    const allowedText = allowed.length > 0 ? allowed.join(", ") : "none — this dispatch is already delivered";
    throw new ValidationError(
      `Cannot transition this dispatch from "${existing.status}" to "${toStatus}" — valid next state(s): ${allowedText}`
    );
  }

  const { dispatch } = await repo.transitionStatus({
    dispatchId,
    fromStatus: existing.status,
    toStatus,
    changedById,
    notes: notes ?? null,
  });
  return toDto(dispatch);
}

export type LogisticsCustodyEventDto = {
  id: string;
  dispatchId: string;
  fromStatus: string | null;
  toStatus: string;
  changedById: string;
  changedAt: string;
  notes: string | null;
};

function toEventDto(row: LogisticsCustodyEvent): LogisticsCustodyEventDto {
  return {
    id: row.id,
    dispatchId: row.dispatchId,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    changedById: row.changedById,
    changedAt: row.changedAt.toISOString(),
    notes: row.notes,
  };
}

/** The real, full chain-of-custody trail for one dispatch, oldest event first. */
export async function listCustodyEvents(dispatchId: string): Promise<LogisticsCustodyEventDto[]> {
  const existing = await repo.findDispatchById(dispatchId);
  if (!existing) throw new NotFoundError(`No logistics dispatch with id "${dispatchId}"`);

  const rows = await repo.findCustodyEvents(dispatchId);
  return rows.map(toEventDto);
}
