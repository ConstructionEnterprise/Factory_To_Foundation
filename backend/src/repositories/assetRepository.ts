import type { Asset } from "@prisma/client";

import { prisma } from "../lib/prisma";

export function findAllAssets(): Promise<Asset[]> {
  return prisma.asset.findMany({ orderBy: { title: "asc" } });
}

export function findAssetById(id: string): Promise<Asset | null> {
  return prisma.asset.findUnique({ where: { id } });
}

export type CreateAssetInput = Omit<Asset, "id">;

export function createAsset(data: CreateAssetInput): Promise<Asset> {
  return prisma.asset.create({ data });
}

export type UpdateAssetInput = Partial<CreateAssetInput>;

export function updateAsset(id: string, data: UpdateAssetInput): Promise<Asset> {
  return prisma.asset.update({ where: { id }, data });
}

export function deleteAsset(id: string): Promise<Asset> {
  return prisma.asset.delete({ where: { id } });
}
