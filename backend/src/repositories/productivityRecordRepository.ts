import type { ProductivityRecord } from "@prisma/client";

import { prisma } from "../lib/prisma";

export function findAllRecords(): Promise<ProductivityRecord[]> {
  return prisma.productivityRecord.findMany({ orderBy: { observedAt: "desc" } });
}

export function findRecordById(id: string): Promise<ProductivityRecord | null> {
  return prisma.productivityRecord.findUnique({ where: { id } });
}

export type CreateRecordData = {
  task: string;
  value: number;
  unit: string;
  crewSize: number | null;
  applicabilityNotes: string | null;
  region: string | null;
  sourceName: string;
  sourceUrl: string | null;
  observedAt: Date;
  notes: string | null;
  createdById: string;
};

export function createRecord(data: CreateRecordData): Promise<ProductivityRecord> {
  return prisma.productivityRecord.create({ data });
}
