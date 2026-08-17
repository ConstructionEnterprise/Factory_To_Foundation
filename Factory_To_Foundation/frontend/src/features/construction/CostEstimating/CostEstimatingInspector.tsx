import { useEffect, useState } from "react";

import { DetailRow, PanelCard, ToolbarButton } from "@/framework/ui";

import { deleteScenario, fetchScenarioBreakdown, type CostEstimateScenario, type ScenarioBreakdown } from "./costEstimateApi";

function formatDollars(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatDollarsPrecise(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

/** Small local row -- same shape as framework/ui's DetailRow, indented for a line item nested under a takeoff. */
function LineItemRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 pl-4 text-xs" style={{ borderBottom: "1px solid var(--ff-content-bg)" }}>
      <span style={{ color: "var(--ff-text-muted)" }}>{label}</span>
      <span style={{ color: "var(--ff-text-secondary)" }}>{value}</span>
    </div>
  );
}

type CostEstimatingInspectorProps = {
  scenario: CostEstimateScenario | null;
  onDeleted: () => void;
};

/**
 * Real selected-scenario detail + delete for Cost Estimating (Phase 1.2,
 * 2026-08-16 rollout). Phase 6 (2026-08-17) added the real SKU-level
 * breakdown section below the flat fields -- the first real consumer of
 * the Phase 4.4 bridge (ProjectQuantityTakeoff.costEstimateScenarioId).
 */
export default function CostEstimatingInspector({ scenario, onDeleted }: CostEstimatingInspectorProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [breakdown, setBreakdown] = useState<ScenarioBreakdown | null>(null);
  const [breakdownError, setBreakdownError] = useState<string | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  useEffect(() => {
    setBreakdown(null);
    setBreakdownError(null);
    if (!scenario) return;
    setBreakdownLoading(true);
    fetchScenarioBreakdown(scenario.id)
      .then(setBreakdown)
      .catch((err) => setBreakdownError(err instanceof Error ? err.message : String(err)))
      .finally(() => setBreakdownLoading(false));
  }, [scenario?.id]);

  const handleDelete = async () => {
    if (!scenario) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteScenario(scenario.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <PanelCard title="Scenario Detail" className="h-full" bodyClassName="flex-1 overflow-auto p-5">
      <div className="mt-4">
        <h2 className="text-xl font-bold" style={{ color: "var(--ff-text-primary)" }}>
          {scenario?.name ?? "Nothing Selected"}
        </h2>
        <p className="mt-1 font-semibold" style={{ color: "var(--ff-accent)" }}>
          {scenario ? formatDollars(scenario.totalCents) : "Select a scenario"}
        </p>
      </div>

      <div className="mt-5 space-y-0.5">
        <DetailRow label="Square Footage" value={scenario ? scenario.squareFootage.toLocaleString() : "--"} />
        <DetailRow label="Rate / SF" value={scenario ? `$${(scenario.ratePerSquareFootCents / 100).toFixed(2)}` : "--"} />
        <DetailRow label="Overhead" value={scenario?.overheadPercent !== null && scenario?.overheadPercent !== undefined ? `${scenario.overheadPercent}%` : "--"} />
        <DetailRow label="Markup" value={scenario?.markupPercent !== null && scenario?.markupPercent !== undefined ? `${scenario.markupPercent}%` : "--"} />
        <DetailRow label="Notes" value={scenario?.notes ?? "--"} />
        <DetailRow label="Created" value={scenario ? new Date(scenario.createdAt).toLocaleString() : "--"} />
      </div>

      {scenario && (
        <div className="mt-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ff-text-secondary)" }}>
            SKU-Level Breakdown
          </h3>

          {breakdownLoading && (
            <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
              Loading…
            </p>
          )}
          {breakdownError && (
            <p className="text-xs" style={{ color: "var(--ff-status-critical)" }}>
              Couldn't load real breakdown ({breakdownError})
            </p>
          )}

          {breakdown && breakdown.takeoffs.length === 0 && (
            <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
              No real quantity takeoff is linked to this scenario yet — the total above is still a blended $/SF rate,
              not itemized by SKU.
            </p>
          )}

          {breakdown &&
            breakdown.takeoffs.map((t) => (
              <div key={t.id} className="mb-3">
                <DetailRow
                  label={t.buildingTitle ? `${t.assemblyName} (${t.buildingTitle})` : t.assemblyName}
                  value={
                    t.calculatedTotalCostCents === null
                      ? "no real cost yet"
                      : `${formatDollars(t.calculatedTotalCostCents)} (${t.quantity.toLocaleString()} ${t.unit})`
                  }
                />
                {t.lineItems.map((li) => (
                  <LineItemRow
                    key={li.id}
                    label={li.itemName}
                    value={`${li.quantityPerUnit} ${li.recordUnit}/${t.unit} × ${formatDollarsPrecise(li.unitCostCents)} = ${formatDollars(li.extendedCostCents)}`}
                  />
                ))}
              </div>
            ))}

          {breakdown && breakdown.itemizedTotalCents !== null && (
            <div className="mt-3 space-y-0.5 border-t pt-2" style={{ borderColor: "var(--ff-panel-border)" }}>
              <DetailRow label="Itemized (real SKU total)" value={formatDollars(breakdown.itemizedTotalCents)} />
              <DetailRow
                label="Unresolved (still blended)"
                value={breakdown.unresolvedCents !== null ? formatDollars(breakdown.unresolvedCents) : "--"}
              />
              <p className="mt-1 text-[0.65rem]" style={{ color: "var(--ff-text-muted)" }}>
                The unresolved amount is the real dollar remainder of this scenario's flat estimate with no
                bottom-up takeoff behind it yet — not a claim about which scope it covers.
              </p>
            </div>
          )}
        </div>
      )}

      {scenario && (
        <div className="mt-5">
          {error && <p className="mb-2 text-xs" style={{ color: "var(--ff-status-critical)" }}>{error}</p>}
          <ToolbarButton onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete Scenario"}
          </ToolbarButton>
        </div>
      )}
    </PanelCard>
  );
}
