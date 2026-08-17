import type { FlowConnection, FlowPoint, FlowPointStatus, FlowPointStatusEvent } from "@prisma/client";

import { prisma } from "../lib/prisma";

export function findAllPoints(flowId?: string): Promise<FlowPoint[]> {
  return prisma.flowPoint.findMany({ where: flowId ? { flowId } : undefined, orderBy: { name: "asc" } });
}

export function findPointById(id: string): Promise<FlowPoint | null> {
  return prisma.flowPoint.findUnique({ where: { id } });
}

export function findFlowById(id: string) {
  return prisma.logisticsFlow.findUnique({ where: { id } });
}

/** Every real point + connection for one flow -- the real graph shape blockage propagation walks. */
export async function findFlowGraph(flowId: string): Promise<{ points: FlowPoint[]; connections: FlowConnection[] }> {
  const points = await prisma.flowPoint.findMany({ where: { flowId } });
  const pointIds = points.map((p) => p.id);
  const connections = await prisma.flowConnection.findMany({
    where: { sourcePointId: { in: pointIds }, targetPointId: { in: pointIds } },
  });
  return { points, connections };
}

export function findVehicleById(id: string) {
  return prisma.vehicle.findUnique({ where: { id } });
}

export function findDispatchById(id: string) {
  return prisma.logisticsDispatch.findUnique({ where: { id } });
}

export type CreatePointInput = {
  flowId: string;
  type: string;
  name: string;
  positionX: number;
  positionY: number;
  assetRef: string | null;
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

export type TransitionStatusInput = {
  flowPointId: string;
  fromStatus: FlowPointStatus | null;
  toStatus: FlowPointStatus;
  reason: string | null;
  changedById: string;
};

/** Real, transactional status change -- the ONLY way FlowPoint.status ever moves, matching logisticsDispatchRepository.transitionStatus()'s exact shape. The generic updatePoint() above deliberately cannot touch status, so every real transition is guaranteed a FlowPointStatusEvent row. */
export async function transitionStatus(
  input: TransitionStatusInput
): Promise<{ point: FlowPoint; event: FlowPointStatusEvent }> {
  return prisma.$transaction(async (tx) => {
    const point = await tx.flowPoint.update({
      where: { id: input.flowPointId },
      data: { status: input.toStatus },
    });
    const event = await tx.flowPointStatusEvent.create({
      data: {
        flowPointId: input.flowPointId,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        reason: input.reason,
        changedById: input.changedById,
      },
    });
    return { point, event };
  });
}

/** Every real status event for one point, oldest first -- the real history Reset must never erase. */
export function findStatusEvents(flowPointId: string): Promise<FlowPointStatusEvent[]> {
  return prisma.flowPointStatusEvent.findMany({ where: { flowPointId }, orderBy: { changedAt: "asc" } });
}
