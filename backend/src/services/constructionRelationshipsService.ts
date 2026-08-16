import { NotFoundError } from "../lib/httpErrors";
import * as repo from "../repositories/constructionRelationshipsRepository";

export type ConstructionTreeNodeDto = {
  id: string;
  parentId: string | null;
  title: string;
  objectType: string;
  progress: string | null;
  trade: string | null;
  inspector: string | null;
  punchListCount: string | null;
};

export type ConstructionDispatchSummaryDto = {
  id: string;
  status: string;
  route: string | null;
  eta: string | null;
  miles: number | null;
  dispatchedAt: string;
  truckIdentifier: string;
  driverName: string;
  vehicle: { id: string; identifier: string; vehicleClass: string } | null;
};

export type ConstructionProjectRelationshipsDto = {
  projectId: string;
  projectTitle: string;
  site: { address: string | null; coordsX: number | null; coordsZ: number | null } | null;
  treeNodes: ConstructionTreeNodeDto[];
  fileCount: number;
  dispatches: ConstructionDispatchSummaryDto[];
};

/**
 * Real relationship view for Construction Data Map -- every field here
 * traces to a real FK `ConstructionProject` already has. No fabricated
 * relationships (e.g. no Genealogy linkage -- GenealogyNode's Project
 * tier has no real FK to ConstructionProject, see
 * docs/decisions/2026-08-16-construction-data-map-cost-estimating-plan.md
 * §1.1).
 */
export async function getProjectRelationships(projectId: string): Promise<ConstructionProjectRelationshipsDto> {
  const data = await repo.findProjectRelationships(projectId);
  if (!data) throw new NotFoundError(`No construction project with id "${projectId}"`);

  return {
    projectId: data.project.id,
    projectTitle: data.project.title,
    site: data.site ? { address: data.site.address, coordsX: data.site.coordsX, coordsZ: data.site.coordsZ } : null,
    treeNodes: data.treeNodes.map((n) => ({
      id: n.id,
      parentId: n.parentId,
      title: n.title,
      objectType: n.objectType,
      progress: n.progress,
      trade: n.trade,
      inspector: n.inspector,
      punchListCount: n.punchListCount,
    })),
    fileCount: data.fileCount,
    dispatches: data.dispatches.map((d) => ({
      id: d.id,
      status: d.status,
      route: d.route,
      eta: d.eta ? d.eta.toISOString() : null,
      miles: d.miles,
      dispatchedAt: d.dispatchedAt.toISOString(),
      truckIdentifier: d.truck.identifier,
      driverName: d.driver.name,
      vehicle: d.vehicle
        ? { id: d.vehicle.id, identifier: d.vehicle.identifier, vehicleClass: d.vehicle.vehicleClass }
        : null,
    })),
  };
}
