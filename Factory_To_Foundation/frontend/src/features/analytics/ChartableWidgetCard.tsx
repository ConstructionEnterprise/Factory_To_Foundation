import { useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PanelCard } from "@/framework/ui";

import ViewToggle, { type WidgetView } from "./ViewToggle";

export type ChartDatum = { label: string; value: number };

type ChartableWidgetCardProps = {
  title: string;
  /** Extra toolbar content (e.g. StatusBadge) shown to the left of the Text/Chart toggle. */
  toolbar?: ReactNode;
  /** The exact real content Phase 1 always rendered -- untouched, shown in Text view. */
  children: ReactNode;
  /**
   * A real numeric breakdown of the same data `children` displays as text
   * -- null/empty means this widget's real data has no chartable numeric
   * series yet (e.g. Quality Control's single record), never a fabricated
   * bar to fill the space.
   */
  chartData: ChartDatum[] | null;
};

/**
 * Shared Text/Chart wrapper for every Analytics widget (docs/decisions/
 * 2026-08-16-analytics-observability-phase3-plan.md follow-up, 2026-08-16
 * -- Joshua wanted the widgets he already looks at to show real charts,
 * not just the new metric_graph widget type). Defaults to Chart. Both
 * views read the exact same real data each widget already computed --
 * this component never fetches or derives anything itself.
 */
export default function ChartableWidgetCard({ title, toolbar, children, chartData }: ChartableWidgetCardProps) {
  const [view, setView] = useState<WidgetView>("chart");
  const hasChartData = chartData !== null && chartData.length > 0;

  return (
    <PanelCard
      title={title}
      toolbar={
        <div className="flex items-center gap-2">
          {toolbar}
          <ViewToggle view={view} onChange={setView} />
        </div>
      }
    >
      {view === "text" && children}
      {view === "chart" &&
        (hasChartData ? (
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 24, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--ff-content-bg)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--ff-text-muted)" }} interval={0} angle={-25} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10, fill: "var(--ff-text-muted)" }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--ff-panel-bg, #fff)", border: "1px solid var(--ff-content-bg)", fontSize: 12 }} />
                <Bar dataKey="value" fill="var(--ff-accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
            No real numeric breakdown to chart for this widget yet -- see Text view.
          </p>
        ))}
    </PanelCard>
  );
}
