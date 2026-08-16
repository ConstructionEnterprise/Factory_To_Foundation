import type { AlarmComparator, AnalyticsThreshold } from "@prisma/client";

import { prisma } from "../lib/prisma";

export function findByMetricKey(metricKey: string): Promise<AnalyticsThreshold | null> {
  return prisma.analyticsThreshold.findUnique({ where: { metricKey } });
}

export function findAll(): Promise<AnalyticsThreshold[]> {
  return prisma.analyticsThreshold.findMany({ orderBy: { metricKey: "asc" } });
}

export type UpsertThresholdInput = {
  comparator: AlarmComparator;
  value: number;
  windowMinutes: number;
  createdById: string;
};

/** PUT semantics -- set or replace the one real threshold for this metric. */
export function upsertThreshold(metricKey: string, input: UpsertThresholdInput): Promise<AnalyticsThreshold> {
  return prisma.analyticsThreshold.upsert({
    where: { metricKey },
    create: { metricKey, ...input },
    update: { comparator: input.comparator, value: input.value, windowMinutes: input.windowMinutes },
  });
}

export function deleteThreshold(metricKey: string): Promise<AnalyticsThreshold> {
  return prisma.analyticsThreshold.delete({ where: { metricKey } });
}
