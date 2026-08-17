import type { ProductivityRecord } from "@prisma/client";

import { ValidationError } from "../lib/httpErrors";
import * as repo from "../repositories/productivityRecordRepository";

export type ProductivityRecordDto = {
  id: string;
  task: string;
  value: number;
  unit: string;
  crewSize: number | null;
  applicabilityNotes: string | null;
  region: string | null;
  sourceName: string;
  sourceUrl: string | null;
  observedAt: string;
  notes: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

function toDto(row: ProductivityRecord): ProductivityRecordDto {
  return {
    id: row.id,
    task: row.task,
    value: row.value,
    unit: row.unit,
    crewSize: row.crewSize,
    applicabilityNotes: row.applicabilityNotes,
    region: row.region,
    sourceName: row.sourceName,
    sourceUrl: row.sourceUrl,
    observedAt: row.observedAt.toISOString(),
    notes: row.notes,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listRecords(): Promise<ProductivityRecordDto[]> {
  const rows = await repo.findAllRecords();
  return rows.map(toDto);
}

export type CreateRecordInput = {
  task: string;
  value: number;
  unit: string;
  crewSize?: number;
  applicabilityNotes?: string;
  region?: string;
  sourceName: string;
  sourceUrl?: string;
  observedAt: string;
  notes?: string;
  createdById: string;
};

/** Real create -- refuses a non-positive rate and a blank source, same posture as marketCostRecordService.createRecord. */
export async function createRecord(input: CreateRecordInput): Promise<ProductivityRecordDto> {
  if (input.value <= 0) throw new ValidationError("A productivity rate must be a real, positive number.");
  if (!input.sourceName.trim()) throw new ValidationError("A real source name is required -- never create an unsourced productivity record.");

  const observedAt = new Date(input.observedAt);
  if (Number.isNaN(observedAt.getTime())) throw new ValidationError('"observedAt" must be a real, valid date.');

  const row = await repo.createRecord({
    task: input.task.trim(),
    value: input.value,
    unit: input.unit.trim(),
    crewSize: input.crewSize ?? null,
    applicabilityNotes: input.applicabilityNotes?.trim() || null,
    region: input.region?.trim() || null,
    sourceName: input.sourceName.trim(),
    sourceUrl: input.sourceUrl?.trim() || null,
    observedAt,
    notes: input.notes?.trim() || null,
    createdById: input.createdById,
  });
  return toDto(row);
}
