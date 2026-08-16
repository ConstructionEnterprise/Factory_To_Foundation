import type { GenealogyEdge, GenealogyNode } from "@prisma/client";

import { prisma } from "../lib/prisma";

export function findAllNodes(): Promise<GenealogyNode[]> {
  return prisma.genealogyNode.findMany({ orderBy: { title: "asc" } });
}

export function findAllEdges(): Promise<GenealogyEdge[]> {
  return prisma.genealogyEdge.findMany({ orderBy: { id: "asc" } });
}
