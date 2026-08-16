/**
 * Frontend mirror of the backend's fixed `EXISTING_SUMMARY_WIDGET_KEYS`
 * (backend/src/lib/analyticsCatalog.ts) -- the 12 pre-existing real Phase
 * 1 Analytics widgets, referenced by key. Kept as a plain literal here
 * rather than fetched from the backend since it's compile-time-fixed
 * (drives the DashboardEditor's picker and widgetRegistry.tsx's
 * `Record<...>` exhaustiveness check), same duplication precedent as
 * moduleSequenceApi.ts's own ModuleSequenceStatus mirror.
 */
export const EXISTING_SUMMARY_WIDGET_KEYS = [
  "factory",
  "genealogy",
  "manufacturing",
  "construction",
  "costEstimating",
  "scheduling",
  "assets",
  "productionOutput",
  "workCellPerformance",
  "scheduleCriticalPath",
  "digitalTwinLifecycle",
  "qualityControl",
] as const;

export type ExistingSummaryWidgetKey = (typeof EXISTING_SUMMARY_WIDGET_KEYS)[number];

const LABELS: Record<ExistingSummaryWidgetKey, string> = {
  factory: "Factory — Digital Twin",
  genealogy: "Genealogy",
  manufacturing: "Manufacturing — Loaded Model",
  construction: "Construction",
  costEstimating: "Cost Estimating",
  scheduling: "Scheduling",
  assets: "Assets",
  productionOutput: "Production Output",
  workCellPerformance: "Work Cell Performance — Equipment Utilization",
  scheduleCriticalPath: "Production Schedule Performance — Critical Path",
  digitalTwinLifecycle: "Digital Twin Lifecycle",
  qualityControl: "Quality Control",
};

export function labelForSummaryWidgetKey(key: ExistingSummaryWidgetKey): string {
  return LABELS[key];
}
