import type { FlowPoint } from "@prisma/client";

import { prisma } from "../lib/prisma";

export function findAllPoints(): Promise<FlowPoint[]> {
  return prisma.flowPoint.findMany({ orderBy: { name: "asc" } });
}

export function findPointById(id: string): Promise<FlowPoint | null> {
  return prisma.flowPoint.findUnique({ where: { id } });
}

export type CreatePointInput = {
  type: string;
  name: string;
  positionX: number;
  positionY: number;
  assetRef: string | null;
  status: string | null;
  notes: string | null;
};

export function createPoint(data: CreatePointInput): Promise<FlowPoint> {
  return prisma.flowPoint.create({ data });
}

export type UpdatePointInput = Partial<CreatePointInput>;

export function updatePoint(id: string, data: UpdatePointInput): Promise<FlowPoint> {
  return prisma.flowPoint.update({ where: { id }, data });
}

export function deletePoint(id: string): Promise<FlowPoint> {
  return prisma.flowPoint.delete({ where: { id } });
}
