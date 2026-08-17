import { NotFoundError, ValidationError } from "../lib/httpErrors";
import * as repo from "../repositories/costAssemblyRepository";
import type { AssemblyWithComponents } from "../repositories/costAssemblyRepository";

export type AssemblyComponentDto = {
  id: string;
  marketCostRecordId: string;
  itemName: string;
  unitCostCents: number;
  recordUnit: string;
  quantityPerUnit: number;
  quantitySourceName: string;
  quantityNotes: string | null;
  /// Real, derived here -- unitCostCents * quantityPerUnit -- never stored.
  componentCostCents: number;
  /// Real, optional traceability -- set when quantityPerUnit was derived
  /// from a real ProductivityRecord rather than a direct citation.
  productivityRecordId: string | null;
  productivityRecordTask: string | null;
};

export type AssemblyDto = {
  id: string;
  name: string;
  unit: string;
  description: string | null;
  assumptionNotes: string | null;
  components: AssemblyComponentDto[];
  /// Real, derived from summing every component's own derived cost --
  /// never stored, same "never trust/store a derived number" discipline
  /// as CostEstimateScenario.totalCents. Null (not zero) when the
  /// assembly has zero components yet -- an empty assembly has no real
  /// cost to report, not a real $0 cost.
  estimatedCostPerUnitCents: number | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

function toDto(row: AssemblyWithComponents): AssemblyDto {
  const components: AssemblyComponentDto[] = row.components.map((c) => ({
    id: c.id,
    marketCostRecordId: c.marketCostRecordId,
    itemName: c.marketCostRecord.itemName,
    unitCostCents: c.marketCostRecord.unitCostCents,
    recordUnit: c.marketCostRecord.unit,
    quantityPerUnit: c.quantityPerUnit,
    quantitySourceName: c.quantitySourceName,
    quantityNotes: c.quantityNotes,
    componentCostCents: Math.round(c.marketCostRecord.unitCostCents * c.quantityPerUnit),
    productivityRecordId: c.productivityRecordId,
    productivityRecordTask: c.productivityRecord?.task ?? null,
  }));

  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    description: row.description,
    assumptionNotes: row.assumptionNotes,
    components,
    estimatedCostPerUnitCents:
      components.length === 0 ? null : components.reduce((sum, c) => sum + c.componentCostCents, 0),
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listAssemblies(): Promise<AssemblyDto[]> {
  const rows = await repo.findAllAssemblies();
  return rows.map(toDto);
}

export async function getAssembly(id: string): Promise<AssemblyDto> {
  const row = await repo.findAssemblyById(id);
  if (!row) throw new NotFoundError(`No cost assembly with id "${id}"`);
  return toDto(row);
}

export type CreateAssemblyInput = {
  name: string;
  unit: string;
  description?: string;
  assumptionNotes?: string;
  createdById: string;
};

export async function createAssembly(input: CreateAssemblyInput): Promise<AssemblyDto> {
  const row = await repo.createAssembly({
    name: input.name.trim(),
    unit: input.unit.trim(),
    description: input.description?.trim() || null,
    assumptionNotes: input.assumptionNotes?.trim() || null,
    createdById: input.createdById,
  });
  return getAssembly(row.id);
}

export type AddComponentInput = {
  marketCostRecordId: string;
  quantityPerUnit: number;
  quantitySourceName: string;
  quantityNotes?: string;
  productivityRecordId?: string;
};

/**
 * Real create -- refuses a non-positive quantity and a blank quantity
 * source, same "an unsourced number is exactly the fabrication this model
 * exists to prevent" posture as marketCostRecordService.createRecord.
 */
export async function addComponent(assemblyId: string, input: AddComponentInput): Promise<AssemblyDto> {
  const assembly = await repo.findAssemblyById(assemblyId);
  if (!assembly) throw new NotFoundError(`No cost assembly with id "${assemblyId}"`);

  const record = await repo.findMarketCostRecordById(input.marketCostRecordId);
  if (!record) throw new NotFoundError(`No market cost record with id "${input.marketCostRecordId}"`);

  if (input.productivityRecordId) {
    const productivity = await repo.findProductivityRecordById(input.productivityRecordId);
    if (!productivity) throw new NotFoundError(`No productivity record with id "${input.productivityRecordId}"`);
  }

  if (input.quantityPerUnit <= 0) throw new ValidationError("Quantity per unit must be a real, positive number.");
  if (!input.quantitySourceName.trim())
    throw new ValidationError("A real quantity source is required -- never add a component with no real basis for its quantity.");

  await repo.createComponent({
    assemblyId,
    marketCostRecordId: input.marketCostRecordId,
    quantityPerUnit: input.quantityPerUnit,
    quantitySourceName: input.quantitySourceName.trim(),
    quantityNotes: input.quantityNotes?.trim() || null,
    productivityRecordId: input.productivityRecordId ?? null,
  });

  return getAssembly(assemblyId);
}
