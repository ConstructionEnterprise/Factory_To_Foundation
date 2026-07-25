import * as repo from "../repositories/constructionSiteRepository";
import { NotFoundError } from "../lib/httpErrors";

/**
 * Mirrors constructionSiteStore.ts's SiteOverride shape exactly ({address?,
 * coords?}) so the frontend's resolveSite()/store merge logic doesn't need
 * to change at all — only where the overrides come from does.
 */
export type SiteDto = {
  projectId: string;
  address?: string;
  coords?: { x: number; z: number };
};

export type SitePatch = {
  address?: string;
  coords?: { x: number; z: number };
};

function toDto(row: { projectId: string; address: string | null; coordsX: number | null; coordsZ: number | null }): SiteDto {
  return {
    projectId: row.projectId,
    address: row.address ?? undefined,
    coords: row.coordsX !== null && row.coordsZ !== null ? { x: row.coordsX, z: row.coordsZ } : undefined,
  };
}

export async function listSites(): Promise<SiteDto[]> {
  const rows = await repo.findAllSites();
  return rows.map(toDto);
}

export async function getSite(projectId: string): Promise<SiteDto | null> {
  const row = await repo.findSite(projectId);
  return row ? toDto(row) : null;
}

/**
 * Partial merge — matches constructionSiteStore.ts's existing
 * setSiteAddress()/setSiteCoords() semantics exactly: a coords-only patch
 * never clobbers a previously-set address, and vice versa. An explicit
 * empty/whitespace-only address clears the address field (same rule the
 * old localStorage setSiteAddress() used: `trimmed || undefined`).
 */
export async function setSite(projectId: string, patch: SitePatch): Promise<SiteDto> {
  const project = await repo.findProjectById(projectId);
  if (!project) throw new NotFoundError(`No construction project with id "${projectId}"`);

  const existing = await repo.findSite(projectId);
  const trimmedAddress = patch.address?.trim();
  const nextAddress = "address" in patch ? (trimmedAddress ? trimmedAddress : null) : (existing?.address ?? null);
  const nextCoordsX = patch.coords ? patch.coords.x : (existing?.coordsX ?? null);
  const nextCoordsZ = patch.coords ? patch.coords.z : (existing?.coordsZ ?? null);

  const row = await repo.upsertSite(projectId, { address: nextAddress, coordsX: nextCoordsX, coordsZ: nextCoordsZ });
  return toDto(row);
}

export function clearSite(projectId: string): Promise<boolean> {
  return repo.deleteSite(projectId);
}
