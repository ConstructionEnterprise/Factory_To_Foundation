import { NotFoundError } from "../lib/httpErrors";
import * as materialRepo from "../repositories/materialInventoryRepository";
import * as repo from "../repositories/productionRunRepository";

export type MaterialRequirementLineDto = {
  costAssemblyComponentId: string;
  materialCatalogItemId: string | null;
  materialCatalogItemName: string | null;
  /** Real ids of every LogisticsMaterial row linked to this catalog item -- what a real reservation would target. */
  materialIds: string[];
  requiredQuantity: number | null;
  /** Non-null only when requiredQuantity couldn't be determined -- the honest reason, never a fabricated number. */
  unresolvedReason: string | null;
  availableQuantity: number | null;
  sufficient: boolean | null;
};

export type MaterialRequirementReportDto = {
  productionRunId: string;
  sourceModelNodeId: string | null;
  lines: MaterialRequirementLineDto[];
  allResolved: boolean;
  allSufficient: boolean;
};

const METERS_TO_FEET = 3.280839895;

/**
 * Real, deliberately narrow geometry-derived quantity resolution (Phase 8,
 * 2026-08-17) -- `stud_count` is the ONE confirmed real extras key this
 * schema currently captures (see ManufacturingInspector.tsx /
 * instructionGeneration.ts's own real use of it). Matches only when the
 * real MaterialCatalogItem's name mentions "stud".
 *
 * The real Cedarwood "LGS Stud" MarketCostRecord (linked via
 * MaterialCatalogItem) is priced and tracked in linear_foot, not discrete
 * pieces (confirmed: CostAssemblyComponent.quantityPerUnit = 0.75 LF of
 * stud per SF of wall) -- so a raw `stud_count` alone isn't the right real
 * unit to compare against real inventory. The real conversion is
 * `stud_count * real stud length`, and the real stud length for THIS
 * panel is its own real measured height (sourceDimensions.y, meters,
 * converted to feet) -- never a fabricated per-stud length. Both
 * `stud_count` and `sourceDimensions.y` must be real and present, or this
 * stays honestly unresolved.
 */
function resolveFromExtras(materialName: string, extras: unknown, dimensions: unknown): number | null {
  if (!materialName.toLowerCase().includes("stud")) return null;
  if (!extras || typeof extras !== "object") return null;

  const rawCount = (extras as Record<string, unknown>)["stud_count"];
  const count = typeof rawCount === "number" ? rawCount : typeof rawCount === "string" ? Number(rawCount) : NaN;
  if (!Number.isFinite(count) || count <= 0) return null;

  if (!dimensions || typeof dimensions !== "object") return null;
  const rawHeight = (dimensions as Record<string, unknown>)["y"];
  const heightM = typeof rawHeight === "number" ? rawHeight : NaN;
  if (!Number.isFinite(heightM) || heightM <= 0) return null;

  // Real inventory quantities in this schema are whole numbers (see
  // LogisticsMaterial's Int-typed ledger) -- ceil so a real reservation
  // against this number never under-reserves the real material needed.
  const requiredLinearFeet = count * heightM * METERS_TO_FEET;
  return Math.ceil(requiredLinearFeet);
}

/**
 * The real "before this step runs, can FF determine whether the resources
 * it needs are available" check (Phase 8, 2026-08-17) -- a pure, read-only
 * WHAT-IF computation; it never reserves/consumes anything itself. Walks
 * the run's real assembly BOM (CostAssemblyComponent -> MarketCostRecord
 * -> MaterialCatalogItem), resolves each component's real physical
 * inventory via the catalog link, and reports the real geometry-derived
 * requirement where the Model actually supplied one -- honestly
 * unresolved otherwise, per Joshua's explicit "do not fabricate the panel
 * quantity" instruction.
 */
export async function computeMaterialRequirements(productionRunId: string): Promise<MaterialRequirementReportDto> {
  const run = await repo.findRunWithRequirementContext(productionRunId);
  if (!run) throw new NotFoundError(`No production run with id "${productionRunId}"`);

  const lines: MaterialRequirementLineDto[] = [];

  for (const component of run.assembly.components) {
    const catalogItem = component.marketCostRecord.materialCatalogItem;

    if (!catalogItem) {
      lines.push({
        costAssemblyComponentId: component.id,
        materialCatalogItemId: null,
        materialCatalogItemName: null,
        materialIds: [],
        requiredQuantity: null,
        unresolvedReason: `"${component.marketCostRecord.itemName}" has no real link to a MaterialCatalogItem yet -- cannot resolve to physical inventory.`,
        availableQuantity: null,
        sufficient: null,
      });
      continue;
    }

    const requiredQuantity = resolveFromExtras(catalogItem.name, run.sourceExtras, run.sourceDimensions);
    if (requiredQuantity === null) {
      lines.push({
        costAssemblyComponentId: component.id,
        materialCatalogItemId: catalogItem.id,
        materialCatalogItemName: catalogItem.name,
        materialIds: [],
        requiredQuantity: null,
        unresolvedReason: run.sourceExtras
          ? `No real geometry-derived quantity for "${catalogItem.name}" in this run's captured source data.`
          : `This run has no real Manufacturing-model source snapshot -- requirement cannot be calculated.`,
        availableQuantity: null,
        sufficient: null,
      });
      continue;
    }

    const materials = await materialRepo.findMaterialsByCatalogItem(catalogItem.id);
    const availableQuantity = materials.reduce((sum, m) => sum + (m.quantityOnHand - m.quantityReserved), 0);
    lines.push({
      costAssemblyComponentId: component.id,
      materialCatalogItemId: catalogItem.id,
      materialCatalogItemName: catalogItem.name,
      materialIds: materials.map((m) => m.id),
      requiredQuantity,
      unresolvedReason: null,
      availableQuantity,
      sufficient: availableQuantity >= requiredQuantity,
    });
  }

  const allResolved = lines.every((l) => l.requiredQuantity !== null);
  const allSufficient = allResolved && lines.every((l) => l.sufficient === true);

  return { productionRunId, sourceModelNodeId: run.sourceModelNodeId, lines, allResolved, allSufficient };
}
