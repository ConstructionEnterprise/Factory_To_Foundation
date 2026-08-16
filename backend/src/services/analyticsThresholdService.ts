import type { AlarmComparator, AnalyticsThreshold } from "@prisma/client";

import { isRealMetricKey } from "../lib/analyticsCatalog";
import { NotFoundError, ValidationError } from "../lib/httpErrors";
import * as repo from "../repositories/analyticsThresholdRepository";

export type AnalyticsThresholdDto = {
  metricKey: string;
  comparator: AlarmComparator;
  value: number;
  windowMinutes: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export function toThresholdDto(row: AnalyticsThreshold): AnalyticsThresholdDto {
  return {
    metricKey: row.metricKey,
    comparator: row.comparator,
    value: row.value,
    windowMinutes: row.windowMinutes,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listThresholds(): Promise<AnalyticsThresholdDto[]> {
  const rows = await repo.findAll();
  return rows.map(toThresholdDto);
}

/**
 * Real handoff-contract-style validation (plan doc §2.1/§2.2): a
 * threshold can only ever reference a metric that's in the fixed
 * catalog, never an arbitrary string a client could invent.
 */
export async function setThreshold(
  metricKey: string,
  comparator: AlarmComparator,
  value: number,
  windowMinutes: number,
  createdById: string
): Promise<AnalyticsThresholdDto> {
  if (!isRealMetricKey(metricKey)) {
    throw new ValidationError(`"${metricKey}" is not a real metric -- see the fixed catalog at GET /analytics/metrics.`);
  }
  if (!(windowMinutes > 0)) throw new ValidationError("windowMinutes must be a positive number.");

  const row = await repo.upsertThreshold(metricKey, { comparator, value, windowMinutes, createdById });
  return toThresholdDto(row);
}

export async function clearThreshold(metricKey: string): Promise<void> {
  const existing = await repo.findByMetricKey(metricKey);
  if (!existing) throw new NotFoundError(`No real threshold set for metric "${metricKey}".`);
  await repo.deleteThreshold(metricKey);
}
