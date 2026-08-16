import { useState } from "react";

import { DetailRow, PanelCard, ToolbarButton } from "@/framework/ui";

import { deleteScenario, type CostEstimateScenario } from "./costEstimateApi";

function formatDollars(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

type CostEstimatingInspectorProps = {
  scenario: CostEstimateScenario | null;
  onDeleted: () => void;
};

/** Real selected-scenario detail + delete for Cost Estimating (Phase 1.2, 2026-08-16 rollout). */
export default function CostEstimatingInspector({ scenario, onDeleted }: CostEstimatingInspectorProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
