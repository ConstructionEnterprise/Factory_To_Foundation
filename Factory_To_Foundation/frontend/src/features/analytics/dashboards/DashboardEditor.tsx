import { useEffect, useState } from "react";

import { usePermission } from "@/context/AuthContext";
import { PanelCard, ToolbarButton, ToolbarSelect } from "@/framework/ui";

import { fetchMetricCatalog, type MetricCatalogEntry } from "@/features/analytics/metrics";

import { addWidget, deleteWidget, reorderWidgets, type AnalyticsDashboard, type AnalyticsWidgetType } from "./analyticsDashboardsApi";
import { EXISTING_SUMMARY_WIDGET_KEYS, labelForSummaryWidgetKey, type ExistingSummaryWidgetKey } from "./existingSummaryWidgetKeys";

type DashboardEditorProps = {
  dashboard: AnalyticsDashboard;
  onChanged: () => void;
};

/**
 * Real widget add/reorder/remove editor (Phase 3.4, plan doc §5). Only
 * rendered while the picker's "Edit Widgets" toggle is on. Every add
 * requires a real, selected catalog entry -- there's no free-text key
 * field, so the widget list can never reference something that doesn't
 * exist (the backend enforces this too, this just can't offer the bad
 * request in the first place).
 */
export default function DashboardEditor({ dashboard, onChanged }: DashboardEditorProps) {
  const updatePermission = usePermission("analytics", "update");

  const [catalog, setCatalog] = useState<MetricCatalogEntry[]>([]);
  const [widgetType, setWidgetType] = useState<AnalyticsWidgetType>("metric_graph");
  const [metricKey, setMetricKey] = useState("");
  const [summaryWidgetKey, setSummaryWidgetKey] = useState<ExistingSummaryWidgetKey>(EXISTING_SUMMARY_WIDGET_KEYS[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchMetricCatalog().then(setCatalog).catch(() => {});
  }, []);

  const handleAdd = async () => {
    setBusy(true);
    setError(null);
    try {
      await addWidget(dashboard.id, {
        widgetType,
        metricKey: widgetType === "metric_graph" ? metricKey : undefined,
        summaryWidgetKey: widgetType === "existing_summary" ? summaryWidgetKey : undefined,
      });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (widgetId: string) => {
    setBusy(true);
    setError(null);
    try {
      await deleteWidget(dashboard.id, widgetId);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= dashboard.widgets.length) return;
    const ids = dashboard.widgets.map((w) => w.id);
    [ids[index], ids[targetIndex]] = [ids[targetIndex], ids[index]];
    setBusy(true);
    setError(null);
    try {
      await reorderWidgets(dashboard.id, ids);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelCard title={`Editing "${dashboard.title}"`} className="mb-4">
      {error && <p className="mb-2 text-xs" style={{ color: "var(--ff-status-critical)" }}>{error}</p>}

      <div className="space-y-2">
        {dashboard.widgets.map((w, i) => (
          <div key={w.id} className="flex items-center justify-between rounded-lg px-3 py-1.5" style={{ border: "1px solid var(--ff-content-bg)" }}>
            <span className="text-xs" style={{ color: "var(--ff-text-primary)" }}>
              {w.widgetType === "metric_graph" && (catalog.find((c) => c.key === w.metricKey)?.label ?? w.metricKey)}
              {w.widgetType === "events_feed" && "Events"}
              {w.widgetType === "existing_summary" && labelForSummaryWidgetKey(w.summaryWidgetKey as ExistingSummaryWidgetKey)}
            </span>
            <div className="flex items-center gap-1">
              <ToolbarButton onClick={() => handleMove(i, -1)} disabled={!updatePermission.allowed || busy || i === 0}>↑</ToolbarButton>
              <ToolbarButton onClick={() => handleMove(i, 1)} disabled={!updatePermission.allowed || busy || i === dashboard.widgets.length - 1}>↓</ToolbarButton>
              <ToolbarButton onClick={() => handleRemove(w.id)} disabled={!updatePermission.allowed || busy} title={updatePermission.reason}>Remove</ToolbarButton>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ToolbarSelect value={widgetType} disabled={!updatePermission.allowed} onChange={(e) => setWidgetType(e.target.value as AnalyticsWidgetType)}>
          <option value="metric_graph">Metric Graph</option>
          <option value="events_feed">Events Feed</option>
          <option value="existing_summary">Existing Widget</option>
        </ToolbarSelect>

        {widgetType === "metric_graph" && (
          <ToolbarSelect value={metricKey} disabled={!updatePermission.allowed} onChange={(e) => setMetricKey(e.target.value)}>
            <option value="">Select a real metric…</option>
            {catalog.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </ToolbarSelect>
        )}

        {widgetType === "existing_summary" && (
          <ToolbarSelect value={summaryWidgetKey} disabled={!updatePermission.allowed} onChange={(e) => setSummaryWidgetKey(e.target.value as ExistingSummaryWidgetKey)}>
            {EXISTING_SUMMARY_WIDGET_KEYS.map((key) => (
              <option key={key} value={key}>{labelForSummaryWidgetKey(key)}</option>
            ))}
          </ToolbarSelect>
        )}

        <ToolbarButton
          onClick={handleAdd}
          disabled={!updatePermission.allowed || busy || (widgetType === "metric_graph" && !metricKey)}
          title={updatePermission.reason}
        >
          {busy ? "Adding…" : "+ Add Widget"}
        </ToolbarButton>
      </div>
    </PanelCard>
  );
}
