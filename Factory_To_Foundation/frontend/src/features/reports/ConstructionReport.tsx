import { useEffect, useState } from "react";

import { PanelCard, StatusBadge } from "@/framework/ui";
import {
  fetchCostAssemblies,
  fetchMarketCostRecords,
  fetchProductivityRecords,
  type CostAssembly,
} from "@/features/construction/CostIntelligence/costIntelligenceApi";

function formatDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Real Construction report — Cost / Estimate Reconciliation (Reports
 * rebuild, 2026-08-18) — calls the exact same real
 * costIntelligenceApi.ts functions Analytics' CostIntelligenceWidget
 * already reads, presented as a formal reconciliation table (assembly ->
 * its real components -> real estimated cost) rather than the chart-toggle
 * dashboard-widget shape.
 */
export default function ConstructionReport() {
  const [assemblies, setAssemblies] = useState<CostAssembly[] | null>(null);
  const [marketCostCount, setMarketCostCount] = useState<number | null>(null);
  const [productivityCount, setProductivityCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchCostAssemblies(), fetchMarketCostRecords(), fetchProductivityRecords()])
      .then(([a, m, p]) => {
        setAssemblies(a);
        setMarketCostCount(m.length);
        setProductivityCount(p.length);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load real cost data"));
  }, []);

  return (
    <PanelCard
      title="Cost / Estimate Reconciliation"
      className="h-full"
      bodyClassName="flex-1 overflow-auto p-5"
      toolbar={assemblies && <StatusBadge label={`${assemblies.length} Real Assemblies`} tone="neutral" />}
    >
      {error && (
        <p className="mb-3 text-sm" style={{ color: "var(--ff-status-critical)" }}>
          {error}
        </p>
      )}
      {!assemblies && !error && (
        <p className="text-sm" style={{ color: "var(--ff-text-muted)" }}>
          Loading real cost data…
        </p>
      )}
      {assemblies && (
        <>
          <p className="mb-4 text-xs" style={{ color: "var(--ff-text-muted)" }}>
            {marketCostCount} real market cost observations · {productivityCount} real productivity observations
            back the assemblies below.
          </p>
          {assemblies.length === 0 && (
            <p className="text-sm" style={{ color: "var(--ff-text-muted)" }}>
              No real cost assemblies yet.
            </p>
          )}
          <div className="space-y-4">
            {assemblies.map((a) => (
              <div key={a.id} className="rounded-[0.2rem] p-3" style={{ border: "1px solid var(--ff-panel-border)" }}>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-sm font-semibold" style={{ color: "var(--ff-text-primary)" }}>
                    {a.name}
                  </span>
                  <span className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
                    {a.estimatedCostPerUnitCents === null ? "no components" : `${formatDollars(a.estimatedCostPerUnitCents)} / ${a.unit}`}
                  </span>
                </div>
                {a.components.length === 0 ? (
                  <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
                    No real components yet.
                  </p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left" style={{ color: "var(--ff-text-muted)" }}>
                        <th className="py-1 pr-3 font-medium">Component</th>
                        <th className="py-1 pr-3 font-medium">Qty / Unit</th>
                        <th className="py-1 font-medium">Cost</th>
                      </tr>
                    </thead>
                    <tbody style={{ color: "var(--ff-text-primary)" }}>
                      {a.components.map((c) => (
                        <tr key={c.id} style={{ borderTop: "1px solid var(--ff-content-bg)" }}>
                          <td className="py-1.5 pr-3">{c.itemName}</td>
                          <td className="py-1.5 pr-3">
                            {c.quantityPerUnit} {c.recordUnit}
                          </td>
                          <td className="py-1.5">{formatDollars(c.componentCostCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </PanelCard>
  );
}
