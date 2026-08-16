import type { CostEstimateScenario } from "@prisma/client";

import { prisma } from "../lib/prisma";

export type CreateScenarioInput = {
  projectId: string;
  name: string;
  squareFootage: number;
  ratePerSquareFootCents: number;
  overheadPercent: number | null;
  markupPercent: number | null;
  notes: string | null;
  createdById: string;
};

export type UpdateScenarioInput = Partial<
  Pick<CreateScenarioInput, "name" | "squareFootage" | "ratePerSquareFootCents" | "overheadPercent" | "markupPercent" | "notes">
>;

export function findScenariosByProject(projectId: string): Promise<CostEstimateScenario[]> {
  return prisma.costEstimateScenario.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } });
}

export function findScenarioById(id: string): Promise<CostEstimateScenario | null> {
  return prisma.costEstimateScenario.findUnique({ where: { id } });
}

export function findProjectById(projectId: string) {
  return prisma.constructionProject.findUnique({ where: { id: projectId } });
}

export function createScenario(input: CreateScenarioInput): Promise<CostEstimateScenario> {
  return prisma.costEstimateScenario.create({ data: input });
}

export function updateScenario(id: string, input: UpdateScenarioInput): Promise<CostEstimateScenario> {
  return prisma.costEstimateScenario.update({ where: { id }, data: input });
}

export function deleteScenario(id: string): Promise<CostEstimateScenario> {
  return prisma.costEstimateScenario.delete({ where: { id } });
}
