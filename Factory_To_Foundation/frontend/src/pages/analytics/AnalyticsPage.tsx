import { useEffect, useState } from "react";

import { SimplePage, ToolbarButton } from "@/framework/ui";

import { DashboardEditor, DashboardPicker, DashboardView, fetchDashboards, type AnalyticsDashboard } from "@/features/analytics/dashboards";
import { ThresholdAdminPanel } from "@/features/analytics/metrics";

/**
 * Real, dashboard-driven Analytics page (Phase 3.4, docs/decisions/
 * 2026-08-16-analytics-observability-phase3-plan.md §5/§6). Replaces the
 * old hardcoded 13-widget grid: this now renders whichever real
 * AnalyticsDashboard is selected (defaulting to the real isDefault row,
 * which reproduces the old grid's exact layout -- see Phase 3.1's
 * backfill), via DashboardView.
 */
export default function AnalyticsPage() {
  const [dashboards, setDashboards] = useState<AnalyticsDashboard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingWidgets, setEditingWidgets] = useState(false);
  const [showThresholds, setShowThresholds] = useState(false);

  const load = () => {
    fetchDashboards()
      .then((rows) => {
        setDashboards(rows);
        setSelectedId((prev) => {
          if (prev && rows.some((d) => d.id === prev)) return prev;
          return rows.find((d) => d.isDefault)?.id ?? rows[0]?.id ?? null;
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  };

  useEffect(load, []);

  const selected = dashboards?.find((d) => d.id === selectedId) ?? null;

  return (
    <SimplePage pageLabel="Analytics" pageSubtitle="Business Intelligence — Real Cross-Feature Data">
      {error && <p className="text-xs" style={{ color: "var(--ff-status-critical)" }}>{error}</p>}
      {!error && !dashboards && <p style={{ color: "var(--ff-text-muted)" }}>Loading real dashboards…</p>}

      {!error && dashboards && dashboards.length === 0 && (
        <p style={{ color: "var(--ff-text-muted)" }}>No real dashboards exist yet.</p>
      )}

      {!error && dashboards && dashboards.length > 0 && selectedId && (
        <>
          <div className="mb-2 flex items-center justify-between">
            <DashboardPicker
              dashboards={dashboards}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onChanged={load}
              editing={editingWidgets}
              onToggleEditing={() => setEditingWidgets((v) => !v)}
            />
            <ToolbarButton onClick={() => setShowThresholds((v) => !v)}>
              {showThresholds ? "Hide Thresholds" : "Thresholds"}
            </ToolbarButton>
          </div>

          {showThresholds && (
            <div className="mb-4">
              <ThresholdAdminPanel />
            </div>
          )}

          {editingWidgets && selected && <DashboardEditor dashboard={selected} onChanged={load} />}

          {selected && <DashboardView dashboard={selected} />}
        </>
      )}
    </SimplePage>
  );
}
