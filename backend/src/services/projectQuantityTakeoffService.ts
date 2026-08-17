import { NotFoundError, ValidationError } from "../lib/httpErrors";
import * as repo from "../repositories/projectQuantityTakeoffRepository";
import type { TakeoffWithRelations } from "../repositories/projectQuantityTakeoffRepository";
import * as assemblyService from "./costAssemblyService";

export type ProjectQuantityTakeoffDto = {
  id: string;
  constructionProjectId: string;
  buildingTreeNodeId: string | null;
  buildingTitle: string | null;
  assemblyId: string;
  assemblyName: string;
  /// Real, optional -- which real CostEstimateScenario (if any) this
  /// takeoff's real cost contributes to (Phase 4.4 audit finding, see
  /// CostEstimateScenario's own schema doc comment). Null is a real,
  /// legitimate state, not an error.
  costEstimateScenarioId: string | null;
  /// Real, observed -- entered by a human, never derived.
  quantity: number;
  unit: string;
  methodology: string;
  sourceNotes: string | null;
  /// Real, sourced -- the assembly's own derived $/unit (see
  /// CostAssembly.estimatedCostPerUnitCents). Null if the linked assembly
  /// currently has zero components (an empty assembly has no real cost).
  assemblyCostPerUnitCents: number | null;
  /// Real, CALCULATED here -- quantity * assemblyCostPerUnitCents. Never
  /// stored. Null (not zero) whenever assemblyCostPerUnitCents is null,
  /// for the same "no real components, no real cost" reason.
  calculatedTotalCostCents: number | null;
  enteredById: string;
  createdAt: string;
  updatedAt: string;
};

async function toDto(row: TakeoffWithRelations): Promise<ProjectQuantityTakeoffDto> {
  const assembly = await assemblyService.getAssembly(row.assemblyId);
  return {
    id: row.id,
    constructionProjectId: row.constructionProjectId,
    buildingTreeNodeId: row.buildingTreeNodeId,
    buildingTitle: row.buildingTreeNode?.title ?? null,
    assemblyId: row.assemblyId,
    assemblyName: assembly.name,
    costEstimateScenarioId: row.costEstimateScenarioId,
    quantity: row.quantity,
    unit: row.unit,
    methodology: row.methodology,
    sourceNotes: row.sourceNotes,
    assemblyCostPerUnitCents: assembly.estimatedCostPerUnitCents,
    calculatedTotalCostCents:
      assembly.estimatedCostPerUnitCents === null ? null : Math.round(row.quantity * assembly.estimatedCostPerUnitCents),
    enteredById: row.enteredById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listTakeoffsForProject(projectId: string): Promise<ProjectQuantityTakeoffDto[]> {
  const project = await repo.findProjectById(projectId);
  if (!project) throw new NotFoundError(`No construction project with id "${projectId}"`);

  const rows = await repo.findByProject(projectId);
  return Promise.all(rows.map(toDto));
}

export type CreateTakeoffInput = {
  constructionProjectId: string;
  buildingTreeNodeId?: string;
  assemblyId: string;
  costEstimateScenarioId?: string;
  quantity: number;
  unit: string;
  methodology: string;
  sourceNotes?: string;
  enteredById: string;
};

/**
 * Real create -- refuses a non-positive quantity and a blank methodology,
 * same "an undisclosed basis is exactly the fabrication this model exists
 * to prevent" posture as every other real-data model this iteration.
 */
export async function createTakeoff(input: CreateTakeoffInput): Promise<ProjectQuantityTakeoffDto> {
  const project = await repo.findProjectById(input.constructionProjectId);
  if (!project) throw new NotFoundError(`No construction project with id "${input.constructionProjectId}"`);

  const assembly = await repo.findAssemblyById(input.assemblyId);
  if (!assembly) throw new NotFoundError(`No cost assembly with id "${input.assemblyId}"`);

  if (input.buildingTreeNodeId) {
    const building = await repo.findBuildingTreeNodeById(input.buildingTreeNodeId);
    if (!building) throw new NotFoundError(`No construction tree node with id "${input.buildingTreeNodeId}"`);
  }

  if (input.costEstimateScenarioId) {
    const scenario = await repo.findScenarioById(input.costEstimateScenarioId);
    if (!scenario) throw new NotFoundError(`No cost estimate scenario with id "${input.costEstimateScenarioId}"`);
    if (scenario.projectId !== input.constructionProjectId) {
      throw new ValidationError("The real scenario must belong to the same real project as this takeoff.");
    }
  }

  if (input.quantity <= 0) throw new ValidationError("Quantity must be a real, positive number.");
  if (!input.methodology.trim())
    throw new ValidationError("A real methodology is required -- never record a takeoff with no disclosed basis.");

  const row = await repo.createTakeoff({
    constructionProjectId: input.constructionProjectId,
    buildingTreeNodeId: input.buildingTreeNodeId ?? null,
    assemblyId: input.assemblyId,
    costEstimateScenarioId: input.costEstimateScenarioId ?? null,
    quantity: input.quantity,
    unit: input.unit.trim(),
    methodology: input.methodology.trim(),
    sourceNotes: input.sourceNotes?.trim() || null,
    enteredById: input.enteredById,
  });
  return toDto(row);
}
