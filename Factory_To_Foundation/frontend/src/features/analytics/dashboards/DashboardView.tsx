import { useEffect, useState } from "react";

import { EventsWidget, useInstructionExecutionHistory } from "@/features/analytics/AnalyticsDashboard";
import { fetchMetricCatalog, MetricGraphWidget, type MetricCatalogEntry } from "@/features/analytics/metrics";

import type { AnalyticsDashboard } from "./analyticsDashboardsApi";
import { EXECUTION_DEPENDENT_WIDGETS, SELF_CONTAINED_WIDGETS, type ExistingSummaryWidgetKey } from "./widgetRegistry";

type DashboardViewProps = {
  dashboard: AnalyticsDashboard;
};

/**
 * Real dashboard renderer (Phase 3.4, docs/decisions/
 * 2026-08-16-analytics-observability-phase3-plan.md §5) -- routes each
 * real AnalyticsDashboardWidget row to its real component by widgetType,
 * in the dashboard's own real `position` order. Replaces the old
 * hardcoded 13-widget grid; the real default dashboard (Phase 3.1
 * backfill) reproduces that exact layout, so nothing regressed visually.
 */
export default function DashboardView({ dashboard }: DashboardViewProps) {
  const { rows: executionRows, error: executionError } = useInstructionExecutionHistory();
  const [catalog, setCatalog] = useState<MetricCatalogEntry[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    fetchMetricCatalog()
      .then(setCatalog)
      .catch((err) => setCatalogError(err instanceof Error ? err.message : String(err)));
  }, []);

  return (
    <div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {dashboard.widgets.map((widget) => {
          if (widget.widgetType === "events_feed") {
            return <EventsWidget key={widget.id} executionRows={executionRows} />;
          }

          if (widget.widgetType === "metric_graph") {
            const entry = catalog.find((e) => e.key === widget.metricKey);
            if (!entry) {
              return (
                <p key={widget.id} className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
                  {catalogError ?? `Loading real metric "${widget.metricKey}"…`}
                </p>
              );
            }
            return <MetricGraphWidget key={widget.id} entry={entry} />;
          }

          // existing_summary
          const key = widget.summaryWidgetKey as ExistingSummaryWidgetKey;
          if (key === "productionOutput" || key === "workCellPerformance") {
            const Component = EXECUTION_DEPENDENT_WIDGETS[key];
            return <Component key={widget.id} rows={executionRows} error={executionError} />;
          }
          const Component = SELF_CONTAINED_WIDGETS[key];
          if (!Component) {
            return (
              <p key={widget.id} className="text-xs" style={{ color: "var(--ff-status-critical)" }}>
                Unknown real widget key "{widget.summaryWidgetKey}".
              </p>
            );
          }
          return <Component key={widget.id} />;
        })}
      </div>

      <p className="mt-6 text-xs" style={{ color: "var(--ff-text-muted)" }}>
        Logistics and Robotics aren't shown here yet — their KPI values are fixture placeholders,
        not real, so a real-data dashboard doesn't surface them. Robotics' subsystem structure is
        real (seeded from the twin's own object model) but its live values still are not, same
        disclosure as Factory's page.
      </p>
    </div>
  );
}
