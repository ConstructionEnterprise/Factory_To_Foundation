import type { Asset, AssetCategory, AssetStatus } from "@prisma/client";

import { NotFoundError } from "../lib/httpErrors";
import * as repo from "../repositories/assetRepository";

export type AssetDto = {
  id: string;
  title: string;
  subtitle: string;
  category: AssetCategory;
  family: string;
  status: AssetStatus;
  manufacturer: string;
  model: string;
  serialNumber: string;
  assetTag: string;
  location: string;
  acquisitionDate: string;
  lastService: string;
  nextService: string | null;
  notes: string | null;
};

function toDto(row: Asset): AssetDto {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    category: row.category,
    family: row.family,
    status: row.status,
    manufacturer: row.manufacturer,
    model: row.model,
    serialNumber: row.serialNumber,
    assetTag: row.assetTag,
    location: row.location,
    acquisitionDate: row.acquisitionDate.toISOString(),
    lastService: row.lastService.toISOString(),
    nextService: row.nextService ? row.nextService.toISOString() : null,
    notes: row.notes,
  };
}

export async function listAssets(): Promise<AssetDto[]> {
  const rows = await repo.findAllAssets();
  return rows.map(toDto);
}

export type CreateAssetInput = {
  title: string;
  subtitle: string;
  category: AssetCategory;
  family: string;
  status: AssetStatus;
  manufacturer: string;
  model: string;
  serialNumber: string;
  assetTag: string;
  location: string;
  acquisitionDate: string;
  lastService: string;
  /** Real absence, never a placeholder -- omitted/null means genuinely no next service scheduled. */
  nextService?: string | null;
  notes?: string | null;
};

export async function createAsset(input: CreateAssetInput): Promise<AssetDto> {
  const row = await repo.createAsset({
    title: input.title,
    subtitle: input.subtitle,
    category: input.category,
    family: input.family,
    status: input.status,
    manufacturer: input.manufacturer,
    model: input.model,
    serialNumber: input.serialNumber,
    assetTag: input.assetTag,
    location: input.location,
    acquisitionDate: new Date(input.acquisitionDate),
    lastService: new Date(input.lastService),
    nextService: input.nextService ? new Date(input.nextService) : null,
    notes: input.notes ?? null,
  });
  return toDto(row);
}

export type UpdateAssetInput = Partial<CreateAssetInput>;

export async function updateAsset(id: string, input: UpdateAssetInput): Promise<AssetDto> {
  const existing = await repo.findAssetById(id);
  if (!existing) throw new NotFoundError(`No asset with id "${id}"`);

  const row = await repo.updateAsset(id, {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.subtitle !== undefined ? { subtitle: input.subtitle } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.family !== undefined ? { family: input.family } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.manufacturer !== undefined ? { manufacturer: input.manufacturer } : {}),
    ...(input.model !== undefined ? { model: input.model } : {}),
    ...(input.serialNumber !== undefined ? { serialNumber: input.serialNumber } : {}),
    ...(input.assetTag !== undefined ? { assetTag: input.assetTag } : {}),
    ...(input.location !== undefined ? { location: input.location } : {}),
    ...(input.acquisitionDate !== undefined ? { acquisitionDate: new Date(input.acquisitionDate) } : {}),
    ...(input.lastService !== undefined ? { lastService: new Date(input.lastService) } : {}),
    ...(input.nextService !== undefined ? { nextService: input.nextService ? new Date(input.nextService) : null } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
  });
  return toDto(row);
}

export async function deleteAsset(id: string): Promise<void> {
  const existing = await repo.findAssetById(id);
  if (!existing) throw new NotFoundError(`No asset with id "${id}"`);
  await repo.deleteAsset(id);
}
