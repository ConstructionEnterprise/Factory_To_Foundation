import type { CostEstimateScenario } from "@prisma/client";

import { NotFoundError, ValidationError } from "../lib/httpErrors";
import * as repo from "../repositories/costEstimateRepository";

export type CostEstimateScenarioDto = {
  id: string;
  projectId: string;
  name: string;
  squareFootage: number;
  ratePerSquareFootCents: number;
  overheadPercent: number | null;
  markupPercent: number | null;
  notes: string | null;
  /// Always derived here, never stored -- squareFootage * rate, then
  /// overhead/markup applied in that order. A scenario with no
  /// overhead/markup set derives its total from squareFootage/rate alone.
  totalCents: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

/** Real, single source of truth for the derivation -- never duplicated client-side. */
function deriveTotalCents(row: Pick<CostEstimateScenario, "squareFootage" | "ratePerSquareFootCents" | "overheadPercent" | "markupPercent">): number {
  let cents = row.squareFootage * row.ratePerSquareFootCents;
  if (row.overheadPercent !== null) cents *= 1 + row.overheadPercent / 100;
  if (row.markupPercent !== null) cents *= 1 + row.markupPercent / 100;
  return Math.round(cents);
}

function toDto(row: CostEstimateScenario): CostEstimateScenarioDto {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    squareFootage: row.squareFootage,
    ratePerSquareFootCents: row.ratePerSquareFootCents,
    overheadPercent: row.overheadPercent,
    markupPercent: row.markupPercent,
    notes: row.notes,
    totalCents: deriveTotalCents(row),
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listScenarios(projectId: string): Promise<CostEstimateScenarioDto[]> {
  const project = await repo.findProjectById(projectId);
  if (!project) throw new NotFoundError(`No construction project with id "${projectId}"`);

  const rows = await repo.findScenariosByProject(projectId);
  return rows.map(toDto);
}

export type CreateScenarioInput = {
  projectId: string;
  name: string;
  squareFootage: number;
  ratePerSquareFootCents: number;
  overheadPercent?: number;
  markupPercent?: number;
  notes?: string;
  createdById: string;
};

function assertRealInputs(squareFootage: number, ratePerSquareFootCents: number) {
  if (squareFootage <= 0) throw new ValidationError("Square footage must be a real, positive number.");
  if (ratePerSquareFootCents <= 0) throw new ValidationError("Rate per square foot must be a real, positive amount.");
}

export async function createScenario(input: CreateScenarioInput): Promise<CostEstimateScenarioDto> {
  const project = await repo.findProjectById(input.projectId);
  if (!project) throw new NotFoundError(`No construction project with id "${input.projectId}"`);

  assertRealInputs(input.squareFootage, input.ratePerSquareFootCents);

  const row = await repo.createScenario({
    projectId: input.projectId,
    name: input.name,
    squareFootage: input.squareFootage,
    ratePerSquareFootCents: input.ratePerSquareFootCents,
    overheadPercent: input.overheadPercent ?? null,
    markupPercent: input.markupPercent ?? null,
    notes: input.notes ?? null,
    createdById: input.createdById,
  });
  return toDto(row);
}

export type UpdateScenarioInput = {
  name?: string;
  squareFootage?: number;
  ratePerSquareFootCents?: number;
  overheadPercent?: number | null;
  markupPercent?: number | null;
  notes?: string | null;
};

export async function updateScenario(id: string, input: UpdateScenarioInput): Promise<CostEstimateScenarioDto> {
  const existing = await repo.findScenarioById(id);
  if (!existing) throw new NotFoundError(`No cost estimate scenario with id "${id}"`);

  const squareFootage = input.squareFootage ?? existing.squareFootage;
  const ratePerSquareFootCents = input.ratePerSquareFootCents ?? existing.ratePerSquareFootCents;
  assertRealInputs(squareFootage, ratePerSquareFootCents);

  const row = await repo.updateScenario(id, input);
  return toDto(row);
}

export async function deleteScenario(id: string): Promise<void> {
  const existing = await repo.findScenarioById(id);
  if (!existing) throw new NotFoundError(`No cost estimate scenario with id "${id}"`);
  await repo.deleteScenario(id);
}
