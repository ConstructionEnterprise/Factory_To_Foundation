import type { ProductionOutput, ProductionOutputStatus, ProductionOutputStatusEvent, QcStatus } from "@prisma/client";

import { NotFoundError, ValidationError } from "../lib/httpErrors";
import * as repo from "../repositories/productionOutputRepository";

export type ProductionOutputDto = {
  id: string;
  productionRunId: string;
  assemblyId: string;
  assemblyName: string;
  serialNumber: string;
  inventoryItemId: string;
  destinationProjectId: string | null;
  destinationTreeNodeId: string | null;
  status: ProductionOutputStatus;
  qcStatus: QcStatus;
  producedAt: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

async function toDto(row: ProductionOutput): Promise<ProductionOutputDto> {
  const assembly = await repo.findAssemblyById(row.assemblyId);
  return {
    id: row.id,
    productionRunId: row.productionRunId,
    assemblyId: row.assemblyId,
    assemblyName: assembly!.name,
    serialNumber: row.serialNumber,
    inventoryItemId: row.inventoryItemId,
    destinationProjectId: row.destinationProjectId,
    destinationTreeNodeId: row.destinationTreeNodeId,
    status: row.status,
    qcStatus: row.qcStatus,
    producedAt: row.producedAt ? row.producedAt.toISOString() : null,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** `productionRunId` is an optional real filter -- omitted, lists every real output across every run. */
export async function listOutputs(productionRunId?: string): Promise<ProductionOutputDto[]> {
  const rows = await repo.findAllOutputs(productionRunId);
  return Promise.all(rows.map(toDto));
}

export async function getOutput(id: string): Promise<ProductionOutputDto> {
  const row = await repo.findOutputById(id);
  if (!row) throw new NotFoundError(`No production output with id "${id}"`);
  return toDto(row);
}

export type CreateOutputInput = {
  productionRunId: string;
  serialNumber: string;
  destinationProjectId?: string;
  destinationTreeNodeId?: string;
  createdById: string;
};

/**
 * Real create — asserts the real run exists and is still real (not
 * necessarily complete; outputs can be recorded while a run is still
 * in_progress). `assemblyId` is deliberately NOT a client input — it's
 * always copied from the real parent run's own assemblyId, so an output
 * can never claim a different assembly than the run that made it.
 * Destination is independently real per output (a batch run's units are
 * not assumed to share one destination).
 */
export async function createOutput(input: CreateOutputInput): Promise<ProductionOutputDto> {
  const run = await repo.findRunById(input.productionRunId);
  if (!run) throw new NotFoundError(`No production run with id "${input.productionRunId}"`);

  if (!input.serialNumber.trim()) {
    throw new ValidationError("A real serial number is required.");
  }
  const existing = await repo.findBySerialNumber(input.serialNumber.trim());
  if (existing) {
    throw new ValidationError(`Serial number "${input.serialNumber.trim()}" is already in use by a real production output.`);
  }

  if (input.destinationProjectId) {
    const project = await repo.findProjectById(input.destinationProjectId);
    if (!project) throw new NotFoundError(`No construction project with id "${input.destinationProjectId}"`);
  }
  if (input.destinationTreeNodeId) {
    const node = await repo.findTreeNodeById(input.destinationTreeNodeId);
    if (!node) throw new NotFoundError(`No construction tree node with id "${input.destinationTreeNodeId}"`);
  }

  const row = await repo.createOutputWithInventoryItem(
    {
      productionRunId: input.productionRunId,
      assemblyId: run.assemblyId,
      serialNumber: input.serialNumber.trim(),
      destinationProjectId: input.destinationProjectId ?? null,
      destinationTreeNodeId: input.destinationTreeNodeId ?? null,
      createdById: input.createdById,
    },
    input.serialNumber.trim()
  );
  return toDto(row);
}

export type ProductionOutputStatusEventDto = {
  id: string;
  productionOutputId: string;
  fromStatus: ProductionOutputStatus | null;
  toStatus: ProductionOutputStatus;
  fromQcStatus: QcStatus | null;
  toQcStatus: QcStatus | null;
  reason: string | null;
  changedById: string;
  changedAt: string;
};

function toEventDto(row: ProductionOutputStatusEvent): ProductionOutputStatusEventDto {
  return {
    id: row.id,
    productionOutputId: row.productionOutputId,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    fromQcStatus: row.fromQcStatus,
    toQcStatus: row.toQcStatus,
    reason: row.reason,
    changedById: row.changedById,
    changedAt: row.changedAt.toISOString(),
  };
}

export async function listStatusEvents(productionOutputId: string): Promise<ProductionOutputStatusEventDto[]> {
  const output = await repo.findOutputById(productionOutputId);
  if (!output) throw new NotFoundError(`No production output with id "${productionOutputId}"`);
  const rows = await repo.findStatusEvents(productionOutputId);
  return rows.map(toEventDto);
}

/**
 * Real transition. `status` is one-way (in_production -> complete only),
 * same "no going back" posture as ProductionRun's own completion and
 * LogisticsStatus's real lifecycle. `qcStatus` is freely transitionable in
 * any direction -- a real QC correction after rework is a genuinely
 * recoverable condition, same reasoning FlowPointStatus already
 * established. A reason is required when the QC verdict is being set to
 * "failed" (an undisclosed failure isn't a real, useful record); optional
 * otherwise. `producedAt` is set to now the first time status becomes
 * "complete", never touched again after that.
 */
export async function transitionOutputStatus(
  outputId: string,
  toStatus: ProductionOutputStatus,
  changedById: string,
  toQcStatus?: QcStatus,
  reason?: string
): Promise<ProductionOutputStatusEventDto> {
  const existing = await repo.findOutputById(outputId);
  if (!existing) throw new NotFoundError(`No production output with id "${outputId}"`);

  const statusChanged = existing.status !== toStatus;
  const qcChanged = toQcStatus !== undefined && existing.qcStatus !== toQcStatus;
  if (!statusChanged && !qcChanged) {
    throw new ValidationError("Nothing real changed — this output is already in that status/QC state.");
  }
  if (existing.status === "complete" && toStatus === "in_production") {
    throw new ValidationError('A completed production output cannot real-transition back to "in_production".');
  }
  if (toQcStatus === "failed" && !reason?.trim()) {
    throw new ValidationError("A reason is required when recording a real QC failure.");
  }

  const { event } = await repo.transitionStatus({
    outputId,
    // When only qcStatus changed, fromStatus/toStatus are both set to the
    // real current status (not null) -- this event row is honestly "QC
    // changed, production status did not," never mistakeable for a
    // fabricated creation event (which is the only real case fromStatus
    // is ever actually null).
    fromStatus: existing.status,
    toStatus: statusChanged ? toStatus : existing.status,
    fromQcStatus: qcChanged ? existing.qcStatus : null,
    toQcStatus: qcChanged ? (toQcStatus ?? null) : null,
    reason: reason?.trim() || null,
    changedById,
    producedAt: statusChanged && toStatus === "complete" && !existing.producedAt ? new Date() : null,
  });
  return toEventDto(event);
}
