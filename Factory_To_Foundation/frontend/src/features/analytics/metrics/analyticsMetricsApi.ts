import { authFetch } from "@/lib/authFetch";
import { BACKEND_URL } from "@/lib/env";

export type MetricShape = "count" | "percent";

export type MetricCatalogEntry = {
  key: string;
  label: string;
  domain: string;
  shape: MetricShape;
};

export type AlarmComparator = "greater_than" | "less_than";

export type AnalyticsThreshold = {
  metricKey: string;
  comparator: AlarmComparator;
  value: number;
  windowMinutes: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export type MetricSeriesPoint = { bucketStart: string; value: number };

export type MetricCurrentValue = {
  metricKey: string;
  value: number;
  windowMinutes: number;
  threshold: AnalyticsThreshold | null;
  state: "ok" | "alarm" | "no_threshold";
};

async function describeResponseError(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  if (body && typeof body.error === "string") return body.error;
  return `server responded ${res.status}`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(`${BACKEND_URL}${path}`, init);
  if (!res.ok) throw new Error(await describeResponseError(res));
  return res.json() as Promise<T>;
}

export function fetchMetricCatalog(): Promise<MetricCatalogEntry[]> {
  return requestJson("/analytics/metrics");
}

export function fetchMetricSeries(metricKey: string, rangeStart: string, rangeEnd: string, bucketMinutes: number): Promise<MetricSeriesPoint[]> {
  const params = new URLSearchParams({ rangeStart, rangeEnd, bucketMinutes: String(bucketMinutes) });
  return requestJson(`/analytics/metrics/${encodeURIComponent(metricKey)}/series?${params.toString()}`);
}

export function fetchMetricCurrentValue(metricKey: string, windowMinutes?: number): Promise<MetricCurrentValue> {
  const params = windowMinutes ? `?${new URLSearchParams({ windowMinutes: String(windowMinutes) }).toString()}` : "";
  return requestJson(`/analytics/metrics/${encodeURIComponent(metricKey)}/current${params}`);
}

export function fetchThresholds(): Promise<AnalyticsThreshold[]> {
  return requestJson("/analytics/thresholds");
}

export function setThreshold(metricKey: string, comparator: AlarmComparator, value: number, windowMinutes: number): Promise<AnalyticsThreshold> {
  return requestJson(`/analytics/thresholds/${encodeURIComponent(metricKey)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ comparator, value, windowMinutes }),
  });
}

export async function clearThreshold(metricKey: string): Promise<void> {
  const res = await authFetch(`${BACKEND_URL}/analytics/thresholds/${encodeURIComponent(metricKey)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await describeResponseError(res));
}
