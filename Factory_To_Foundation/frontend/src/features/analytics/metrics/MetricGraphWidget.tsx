import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PanelCard, StatusBadge, ToolbarSelect, type StatusTone } from "@/framework/ui";

import ViewToggle, { type WidgetView } from "@/features/analytics/ViewToggle";

import { fetchMetricCurrentValue, fetchMetricSeries, type MetricCatalogEntry, type MetricCurrentValue, type MetricSeriesPoint } from "./analyticsMetricsApi";

type RangeOption = { label: string; rangeMs: number; bucketMinutes: number };

// CloudWatch-style fixed presets (plan doc §5) -- each targets ~12 real
// buckets. No "custom" range picker in v1: nothing has asked for one yet,
// and the 6 fixed presets already cover the real CloudWatch interaction
// model this phase is adopting.
const RANGE_OPTIONS: Record<string, RangeOption> = {
  "1h": { label: "1h", rangeMs: 3_600_000, bucketMinutes: 5 },
  "3h": { label: "3h", rangeMs: 3 * 3_600_000, bucketMinutes: 15 },
  "12h": { label: "12h", rangeMs: 12 * 3_600_000, bucketMinutes: 60 },
  "1d": { label: "1d", rangeMs: 24 * 3_600_000, bucketMinutes: 120 },
  "3d": { label: "3d", rangeMs: 3 * 24 * 3_600_000, bucketMinutes: 360 },
  "1w": { label: "1w", rangeMs: 7 * 24 * 3_600_000, bucketMinutes: 840 },
};

const STATE_TONE: Record<MetricCurrentValue["state"], StatusTone> = {
  ok: "positive",
  alarm: "critical",
  no_threshold: "neutral",
};

const STATE_LABEL: Record<MetricCurrentValue["state"], string> = {
  ok: "OK",
  alarm: "ALARM",
  no_threshold: "No Threshold",
};

function formatBucketLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" });
}

type MetricGraphWidgetProps = {
  entry: MetricCatalogEntry;
};

/**
 * Real Recharts time-series widget (Phase 3.3, docs/decisions/
 * 2026-08-16-analytics-observability-phase3-plan.md §5). Every point comes
 * from the real /analytics/metrics/:key/series endpoint -- no client-side
 * interpolation or smoothing across real buckets. The alarm badge reuses
 * the real live-evaluated /current endpoint, not a client-side threshold
 * comparison against the series (the series and the current-value window
 * are allowed to differ -- the badge always reflects the real current
 * state, not "whatever the graph happens to show").
 */
export default function MetricGraphWidget({ entry }: MetricGraphWidgetProps) {
  const [view, setView] = useState<WidgetView>("chart");
  const [rangeKey, setRangeKey] = useState<keyof typeof RANGE_OPTIONS>("1d");
  const [series, setSeries] = useState<MetricSeriesPoint[]>([]);
  const [current, setCurrent] = useState<MetricCurrentValue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const range = RANGE_OPTIONS[rangeKey];
    const rangeEnd = new Date();
    const rangeStart = new Date(rangeEnd.getTime() - range.rangeMs);

    setLoading(true);
    setError(null);
    Promise.all([
      fetchMetricSeries(entry.key, rangeStart.toISOString(), rangeEnd.toISOString(), range.bucketMinutes),
      fetchMetricCurrentValue(entry.key),
    ])
      .then(([seriesRows, currentValue]) => {
        setSeries(seriesRows);
        setCurrent(currentValue);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [entry.key, rangeKey]);

  const chartData = series.map((p) => ({ label: formatBucketLabel(p.bucketStart), value: p.value }));
  const valueSuffix = entry.shape === "percent" ? "%" : "";

  return (
    <PanelCard
      title={entry.label}
      toolbar={
        <div className="flex items-center gap-2">
          {current && <StatusBadge label={STATE_LABEL[current.state]} tone={STATE_TONE[current.state]} />}
          <ToolbarSelect value={rangeKey} onChange={(e) => setRangeKey(e.target.value as keyof typeof RANGE_OPTIONS)}>
            {Object.entries(RANGE_OPTIONS).map(([key, opt]) => (
              <option key={key} value={key}>{opt.label}</option>
            ))}
          </ToolbarSelect>
          <ViewToggle view={view} onChange={setView} />
        </div>
      }
    >
      {error && <p className="text-xs" style={{ color: "var(--ff-status-critical)" }}>{error}</p>}
      {!error && loading && series.length === 0 && <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>Loading real metric data…</p>}
      {!error && !loading && series.every((p) => p.value === 0) && (
        <p className="mb-2 text-xs" style={{ color: "var(--ff-text-muted)" }}>
          No real activity in this range yet -- an honest empty/flat {view === "chart" ? "line" : "series"}, not fabricated density.
        </p>
      )}
      {!error && view === "chart" && chartData.length > 0 && (
        <div style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--ff-content-bg)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--ff-text-muted)" }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "var(--ff-text-muted)" }} allowDecimals={false} unit={valueSuffix} />
              <Tooltip
                contentStyle={{ background: "var(--ff-panel-bg, #fff)", border: "1px solid var(--ff-content-bg)", fontSize: 12 }}
                formatter={(value) => [`${value}${valueSuffix}`, entry.label]}
              />
              <Line type="monotone" dataKey="value" stroke="var(--ff-accent)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {!error && view === "text" && series.length > 0 && (
        <div className="space-y-1">
          {series.map((p) => (
            <div key={p.bucketStart} className="flex justify-between py-1 text-xs" style={{ borderBottom: "1px solid var(--ff-content-bg)" }}>
              <span style={{ color: "var(--ff-text-muted)" }}>{formatBucketLabel(p.bucketStart)}</span>
              <span className="font-medium" style={{ color: "var(--ff-text-primary)" }}>{p.value}{valueSuffix}</span>
            </div>
          ))}
        </div>
      )}
      {current && (
        <p className="mt-2 text-xs" style={{ color: "var(--ff-text-muted)" }}>
          Current ({current.windowMinutes}m window): {current.value}{valueSuffix}
          {current.threshold && ` · threshold ${current.threshold.comparator === "greater_than" ? ">" : "<"} ${current.threshold.value}${valueSuffix}`}
        </p>
      )}
    </PanelCard>
  );
}
