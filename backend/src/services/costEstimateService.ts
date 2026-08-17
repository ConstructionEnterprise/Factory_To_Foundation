import type { CostEstimateScenario } from "@prisma/client";

import { NotFoundError, ValidationError } from "../lib/httpErrors";
import * as repo from "../repositories/costEstimateRepository";
import * as takeoffRepo from "../repositories/projectQuantityTakeoffRepository";
import * as assemblyService from "./costAssemblyService";

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

export type ScenarioBreakdownLineItemDto = {
  id: string;
  itemName: string;
  unitCostCents: number;
  recordUnit: string;
  /// Real, per real assembly unit (e.g. per SF of exterior wall) --
  /// carried through from CostAssemblyComponent, never re-derived.
  quantityPerUnit: number;
  /// Real -- unitCostCents * quantityPerUnit * this takeoff's own real
  /// quantity. The one real number this endpoint adds beyond what
  /// CostAssembly already exposes: a component's cost extended across an
  /// actual measured project quantity, not just per one assembly unit.
  extendedCostCents: number;
};

export type ScenarioBreakdownTakeoffDto = {
  id: string;
  assemblyId: string;
  assemblyName: string;
  buildingTitle: string | null;
  quantity: number;
  unit: string;
  assemblyCostPerUnitCents: number | null;
  /// Same real number as ProjectQuantityTakeoffDto.calculatedTotalCostCents
  /// -- recomputed here from the same real inputs, never duplicated as a
  /// stored value that could drift.
  calculatedTotalCostCents: number | null;
  lineItems: ScenarioBreakdownLineItemDto[];
};

export type ScenarioBreakdownDto = {
  scenarioId: string;
  scenarioName: string;
  /// The scenario's own existing flat blended-rate total -- unchanged,
  /// still authoritative for the whole project scope.
  scenarioTotalCents: number;
  takeoffs: ScenarioBreakdownTakeoffDto[];
  /// Real sum of every takeoff's own real calculatedTotalCostCents. Null
  /// (not zero) when there are zero real takeoffs, or every linked
  /// takeoff's assembly has zero components -- "nothing itemized yet" is
  /// not the same real state as "itemized at $0."
  itemizedTotalCents: number | null;
  /// scenarioTotalCents - itemizedTotalCents: the real dollar remainder
  /// of this scenario's flat estimate that has NO bottom-up takeoff behind
  /// it yet -- still a blended-rate figure, not itemized. Deliberately NOT
  /// a claim about which physical scope that remainder covers (a takeoff's
  /// quantity/unit isn't assumed commensurable with the scenario's own
  /// square footage) -- purely a dollar reconciliation between the two
  /// real numbers this project already has. Can be negative if real
  /// takeoffs sum to more than the flat estimate -- shown as-is, never
  /// clamped or hidden. Null exactly when itemizedTotalCents is null.
  unresolvedCents: number | null;
};

/** Real, single source of truth for the derivation -- shared with toDto() above so the flat total this reconciles against is never computed two different ways. */
function scenarioTotalCents(row: Pick<CostEstimateScenario, "squareFootage" | "ratePerSquareFootCents" | "overheadPercent" | "markupPercent">): number {
  return deriveTotalCents(row);
}

/**
 * Real SKU-level breakdown for one scenario (Phase 6, 2026-08-17) -- the
 * first real consumer of the Phase 4.4 bridge FK
 * (ProjectQuantityTakeoff.costEstimateScenarioId) beyond a smoke test.
 * Every takeoff linked to this scenario, each resolved down to its real
 * assembly components (MarketCostRecord-sourced $/unit), each extended
 * across that takeoff's own real measured quantity. Reuses
 * assemblyService.getAssembly() rather than re-deriving component costs a
 * second way.
 */
export async function getScenarioBreakdown(scenarioId: string): Promise<ScenarioBreakdownDto> {
  const scenario = await repo.findScenarioById(scenarioId);
  if (!scenario) throw new NotFoundError(`No cost estimate scenario with id "${scenarioId}"`);

  const takeoffRows = await takeoffRepo.findByScenario(scenarioId);
  const takeoffs: ScenarioBreakdownTakeoffDto[] = await Promise.all(
    takeoffRows.map(async (row) => {
      const assembly = await assemblyService.getAssembly(row.assemblyId);
      const calculatedTotalCostCents =
        assembly.estimatedCostPerUnitCents === null ? null : Math.round(row.quantity * assembly.estimatedCostPerUnitCents);
      return {
        id: row.id,
        assemblyId: row.assemblyId,
        assemblyName: assembly.name,
        buildingTitle: row.buildingTreeNode?.title ?? null,
        quantity: row.quantity,
        unit: row.unit,
        assemblyCostPerUnitCents: assembly.estimatedCostPerUnitCents,
        calculatedTotalCostCents,
        lineItems: assembly.components.map((c) => ({
          id: c.id,
          itemName: c.itemName,
          unitCostCents: c.unitCostCents,
          recordUnit: c.recordUnit,
          quantityPerUnit: c.quantityPerUnit,
          extendedCostCents: Math.round(c.componentCostCents * row.quantity),
        })),
      };
    })
  );

  const realTotals = takeoffs.map((t) => t.calculatedTotalCostCents).filter((v): v is number => v !== null);
  const itemizedTotalCents = realTotals.length === 0 ? null : realTotals.reduce((sum, v) => sum + v, 0);
  const totalCents = scenarioTotalCents(scenario);

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    scenarioTotalCents: totalCents,
    takeoffs,
    itemizedTotalCents,
    unresolvedCents: itemizedTotalCents === null ? null : totalCents - itemizedTotalCents,
  };
}
