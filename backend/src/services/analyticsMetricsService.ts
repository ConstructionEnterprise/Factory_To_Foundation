import { ANALYTICS_METRIC_CATALOG, getMetricCatalogEntry, isRealMetricKey, type MetricCatalogEntry, type MetricKey } from "../lib/analyticsCatalog";
import { ValidationError } from "../lib/httpErrors";
import * as metricsRepo from "../repositories/analyticsMetricsRepository";
import * as thresholdRepo from "../repositories/analyticsThresholdRepository";
import { toThresholdDto, type AnalyticsThresholdDto } from "./analyticsThresholdService";

type RawPoint = { timestamp: Date; ok?: boolean };

/** Real per-metric row fetch -- the only place that maps a metricKey to its real backing table. */
async function fetchRawPoints(metricKey: MetricKey, start: Date, end: Date): Promise<RawPoint[]> {
  switch (metricKey) {
    case "logistics.custodyEvents.count":
      return (await metricsRepo.findLogisticsCustodyEventsInRange(start, end)).map((r) => ({ timestamp: r.changedAt }));
    case "scheduling.statusEvents.count":
      return (await metricsRepo.findScheduleTaskStatusEventsInRange(start, end)).map((r) => ({ timestamp: r.changedAt }));
    case "factory.executions.count":
    case "factory.executions.failureRate":
      return (await metricsRepo.findInstructionExecutionsInRange(start, end)).map((r) => ({ timestamp: r.executedAt, ok: r.ok }));
    case "construction.moduleSequenceEvents.count":
      return (await metricsRepo.findModuleSequenceEventsInRange(start, end)).map((r) => ({ timestamp: r.changedAt }));
  }
}

function aggregate(entry: MetricCatalogEntry, points: RawPoint[]): number {
  if (entry.shape === "count") return points.length;
  // percent shape (currently only factory.executions.failureRate): real
  // failed/total, 0 on an empty window rather than NaN -- an honest "no
  // data" 0, not a fabricated rate.
  if (points.length === 0) return 0;
  const failed = points.filter((p) => p.ok === false).length;
  return Math.round((failed / points.length) * 100);
}

function assertRealMetricKey(metricKey: string): asserts metricKey is MetricKey {
  if (!isRealMetricKey(metricKey)) {
    throw new ValidationError(`"${metricKey}" is not a real metric -- see the fixed catalog at GET /analytics/metrics.`);
  }
}

export function getMetricCatalog(): MetricCatalogEntry[] {
  return ANALYTICS_METRIC_CATALOG;
}

export type MetricSeriesPoint = { bucketStart: string; value: number };

/**
 * Real time-bucketed series. Buckets computed in JS after a plain
 * findMany over the range (not a raw-SQL date_trunc/GROUP BY) -- matches
 * the real audit-trail volume today (§0 of the plan doc: 59 rows total
 * across every domain), not built for hypothetical scale.
 */
export async function computeMetricSeries(
  metricKeyRaw: string,
  rangeStartRaw: string,
  rangeEndRaw: string,
  bucketMinutes: number
): Promise<MetricSeriesPoint[]> {
  assertRealMetricKey(metricKeyRaw);
  const entry = getMetricCatalogEntry(metricKeyRaw);

  const start = new Date(rangeStartRaw);
  const end = new Date(rangeEndRaw);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new ValidationError("rangeStart/rangeEnd must be real ISO timestamps.");
  if (!(start.getTime() < end.getTime())) throw new ValidationError("rangeStart must be before rangeEnd.");
  if (!(bucketMinutes > 0)) throw new ValidationError("bucketMinutes must be a positive number.");

  const points = await fetchRawPoints(metricKeyRaw, start, end);

  const bucketMs = bucketMinutes * 60_000;
  const buckets = new Map<number, RawPoint[]>();
  for (let t = start.getTime(); t < end.getTime(); t += bucketMs) buckets.set(t, []);
  for (const point of points) {
    const offset = Math.floor((point.timestamp.getTime() - start.getTime()) / bucketMs) * bucketMs;
    const bucketStartMs = start.getTime() + offset;
    const bucket = buckets.get(bucketStartMs);
    if (bucket) bucket.push(point);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([bucketStartMs, pts]) => ({ bucketStart: new Date(bucketStartMs).toISOString(), value: aggregate(entry, pts) }));
}

export type MetricCurrentValueDto = {
  metricKey: string;
  value: number;
  windowMinutes: number;
  threshold: AnalyticsThresholdDto | null;
  state: "ok" | "alarm" | "no_threshold";
};

/**
 * Real, live-evaluated current value + alarm state (plan doc §2.3) -- no
 * cron/worker. Evaluated fresh on every read against the real underlying
 * table, only the threshold itself is stored.
 */
export async function getMetricCurrentValue(metricKeyRaw: string, windowMinutesParam?: number): Promise<MetricCurrentValueDto> {
  assertRealMetricKey(metricKeyRaw);
  const entry = getMetricCatalogEntry(metricKeyRaw);

  const threshold = await thresholdRepo.findByMetricKey(metricKeyRaw);
  const windowMinutes = windowMinutesParam ?? threshold?.windowMinutes ?? 60;
  if (!(windowMinutes > 0)) throw new ValidationError("windowMinutes must be a positive number.");

  const end = new Date();
  const start = new Date(end.getTime() - windowMinutes * 60_000);
  const points = await fetchRawPoints(metricKeyRaw, start, end);
  const value = aggregate(entry, points);

  let state: MetricCurrentValueDto["state"] = "no_threshold";
  if (threshold) {
    const breached = threshold.comparator === "greater_than" ? value > threshold.value : value < threshold.value;
    state = breached ? "alarm" : "ok";
  }

  return { metricKey: metricKeyRaw, value, windowMinutes, threshold: threshold ? toThresholdDto(threshold) : null, state };
}
