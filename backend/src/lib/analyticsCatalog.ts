/**
 * Real, fixed, code-defined catalogs for Phase 3 Analytics Observability
 * (docs/decisions/2026-08-16-analytics-observability-phase3-plan.md §2.1).
 * Neither catalog is a database table -- both are constants an admin UI
 * can only ever *select from*, never write to. Adding a new metric or
 * summary widget is a code change (a PR), never a runtime action, so
 * every graphable/selectable thing here stays traceable to a real query
 * or a real existing component.
 */

export type MetricShape = "count" | "percent";

export type MetricKey =
  | "logistics.custodyEvents.count"
  | "scheduling.statusEvents.count"
  | "factory.executions.count"
  | "factory.executions.failureRate"
  | "construction.moduleSequenceEvents.count";

export type MetricCatalogEntry = {
  key: MetricKey;
  label: string;
  domain: string;
  shape: MetricShape;
};

/** Each entry is backed by one of the 4 real time-series tables that exist today -- see analyticsMetricsRepository.ts. */
export const ANALYTICS_METRIC_CATALOG: MetricCatalogEntry[] = [
  { key: "logistics.custodyEvents.count", label: "Logistics Custody Events", domain: "logistics", shape: "count" },
  { key: "scheduling.statusEvents.count", label: "Schedule Task Status Events", domain: "scheduling", shape: "count" },
  { key: "factory.executions.count", label: "Factory Executions", domain: "factory", shape: "count" },
  { key: "factory.executions.failureRate", label: "Factory Execution Failure Rate", domain: "factory", shape: "percent" },
  { key: "construction.moduleSequenceEvents.count", label: "Module Sequence Events", domain: "construction", shape: "count" },
];

export function isRealMetricKey(key: string): key is MetricKey {
  return ANALYTICS_METRIC_CATALOG.some((e) => e.key === key);
}

export function getMetricCatalogEntry(key: MetricKey): MetricCatalogEntry {
  const entry = ANALYTICS_METRIC_CATALOG.find((e) => e.key === key);
  if (!entry) throw new Error(`Unreachable: "${key}" passed isRealMetricKey but has no catalog entry.`);
  return entry;
}

/**
 * The 12 pre-existing real Phase 1 Analytics widgets (AnalyticsDashboard.tsx),
 * referenced by key rather than rebuilt, plus "costIntelligence" (added
 * 2026-08-17, cost-data acquisition iteration 5 -- the first widget added
 * through this exact mechanism since Phase 3, confirming it's real and
 * systematic, not a one-time Phase 1 artifact). EventsWidget is deliberately
 * excluded -- it's its own AnalyticsWidgetType ("events_feed"), not an
 * existing_summary entry, per §3.2/§5 of the plan doc.
 */
export const EXISTING_SUMMARY_WIDGET_KEYS = [
  "factory",
  "genealogy",
  "manufacturing",
  "construction",
  "costEstimating",
  "costIntelligence",
  "projectOperations",
  "scheduling",
  "assets",
  "productionOutput",
  "workCellPerformance",
  "scheduleCriticalPath",
  "digitalTwinLifecycle",
  "qualityControl",
] as const;

export type ExistingSummaryWidgetKey = (typeof EXISTING_SUMMARY_WIDGET_KEYS)[number];

export function isRealSummaryWidgetKey(key: string): key is ExistingSummaryWidgetKey {
  return (EXISTING_SUMMARY_WIDGET_KEYS as readonly string[]).includes(key);
}
