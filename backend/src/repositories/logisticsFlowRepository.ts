import type { LogisticsFlow } from "@prisma/client";

import { prisma } from "../lib/prisma";

export function findAllFlows(projectId?: string): Promise<LogisticsFlow[]> {
  return prisma.logisticsFlow.findMany({
    where: projectId ? { constructionProjectId: projectId } : undefined,
    orderBy: { createdAt: "asc" },
  });
}

export function findFlowById(id: string): Promise<LogisticsFlow | null> {
  return prisma.logisticsFlow.findUnique({ where: { id } });
}

export function findProjectById(id: string) {
  return prisma.constructionProject.findUnique({ where: { id } });
}

export type CreateFlowData = {
  name: string;
  constructionProjectId: string;
  createdById: string;
};

export function createFlow(data: CreateFlowData): Promise<LogisticsFlow> {
  return prisma.logisticsFlow.create({ data });
}
