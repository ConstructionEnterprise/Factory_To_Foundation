import type { FlowConnection } from "@prisma/client";

import { prisma } from "../lib/prisma";

export function findAllConnections(): Promise<FlowConnection[]> {
  return prisma.flowConnection.findMany({ orderBy: { createdAt: "asc" } });
}

export function findConnectionById(id: string): Promise<FlowConnection | null> {
  return prisma.flowConnection.findUnique({ where: { id } });
}

export type CreateConnectionInput = {
  sourcePointId: string;
  targetPointId: string;
  relationship: string | null;
  distanceMeters: number | null;
  notes: string | null;
};

export function createConnection(data: CreateConnectionInput): Promise<FlowConnection> {
  return prisma.flowConnection.create({ data });
}

export type UpdateConnectionInput = {
  relationship?: string | null;
  distanceMeters?: number | null;
  notes?: string | null;
};

export function updateConnection(id: string, data: UpdateConnectionInput): Promise<FlowConnection> {
  return prisma.flowConnection.update({ where: { id }, data });
}

export function deleteConnection(id: string): Promise<FlowConnection> {
  return prisma.flowConnection.delete({ where: { id } });
}
