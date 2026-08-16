import { useEffect, useState } from "react";

import { PanelCard, ToolbarButton, ToolbarInput } from "@/framework/ui";

import { createScenario, fetchScenarios, type CostEstimateScenario } from "./costEstimateApi";

function formatDollars(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

type CostEstimatingPanelProps = {
  projectId: string | null;
  selectedScenarioId: string | null;
  onSelectScenario: (scenario: CostEstimateScenario) => void;
  /** Bumped by the Inspector after a real delete, so this panel refetches without owning delete itself. */
  refreshKey: number;
};

/**
 * Real Cost Estimating scenario list + create form (Phase 1.2, 2026-08-16
 * rollout). Flat rate/SF model only -- deliberately not a target-price
 * reverse-derivation, see docs/decisions/
 * 2026-08-15-construction-data-map-cost-estimating-plan.md §2.2. Every
 * total shown is server-derived; this form never computes or sends one.
 */
export default function CostEstimatingPanel({ projectId, selectedScenarioId, onSelectScenario, refreshKey }: CostEstimatingPanelProps) {
  const [scenarios, setScenarios] = useState<CostEstimateScenario[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [squareFootage, setSquareFootage] = useState("");
  const [ratePerSquareFoot, setRatePerSquareFoot] = useState("");
  const [overheadPercent, setOverheadPercent] = useState("");
  const [markupPercent, setMarkupPercent] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    if (!projectId) {
      setScenarios([]);
      return;
    }
    setLoading(true);
    setError(null);
    fetchScenarios(projectId)
      .then(setScenarios)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, [projectId, refreshKey]);

  const resetForm = () => {
    setName("");
    setSquareFootage("");
    setRatePerSquareFoot("");
    setOverheadPercent("");
    setMarkupPercent("");
    setSubmitError(null);
  };

  const handleSubmit = async () => {
    if (!projectId) return;
    const sf = Number(squareFootage);
    const rate = Number(ratePerSquareFoot);
    if (!name.trim()) return setSubmitError("Enter a real scenario name.");
    if (!(sf > 0)) return setSubmitError("Enter a real, positive square footage.");
    if (!(rate > 0)) return setSubmitError("Enter a real, positive rate per square foot.");

    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await createScenario(projectId, {
        name: name.trim(),
        squareFootage: sf,
        ratePerSquareFootCents: Math.round(rate * 100),
        overheadPercent: overheadPercent ? Number(overheadPercent) : undefined,
        markupPercent: markupPercent ? Number(markupPercent) : undefined,
      });
      resetForm();
      setShowForm(false);
      load();
      onSelectScenario(created);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PanelCard title="Cost Estimating" className="h-full" bodyClassName="flex-1 overflow-auto p-5">
      {!projectId && <p style={{ color: "var(--ff-text-muted)" }}>Select a project to see its real cost estimate scenarios.</p>}

      {projectId && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase" style={{ color: "var(--ff-text-muted)" }}>
              Real Scenarios
            </h3>
            <ToolbarButton onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "+ New Scenario"}</ToolbarButton>
          </div>

          {showForm && (
            <div className="space-y-2 rounded-lg p-3" style={{ border: "1px solid var(--ff-content-bg)" }}>
              <ToolbarInput placeholder="Scenario name (e.g. Bid A)" value={name} onChange={(e) => setName(e.target.value)} />
              <div className="flex gap-2">
                <ToolbarInput
                  type="number"
                  placeholder="Square footage"
                  value={squareFootage}
                  onChange={(e) => setSquareFootage(e.target.value)}
                />
                <ToolbarInput
                  type="number"
                  placeholder="Rate / SF ($)"
                  value={ratePerSquareFoot}
                  onChange={(e) => setRatePerSquareFoot(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <ToolbarInput
                  type="number"
                  placeholder="Overhead % (optional)"
                  value={overheadPercent}
                  onChange={(e) => setOverheadPercent(e.target.value)}
                />
                <ToolbarInput
                  type="number"
                  placeholder="Markup % (optional)"
                  value={markupPercent}
                  onChange={(e) => setMarkupPercent(e.target.value)}
                />
              </div>
              {submitError && <p className="text-xs" style={{ color: "var(--ff-status-critical)" }}>{submitError}</p>}
              <ToolbarButton onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Creating…" : "Create Scenario"}
              </ToolbarButton>
            </div>
          )}

          {loading && <p style={{ color: "var(--ff-text-muted)" }}>Loading…</p>}
          {error && <p style={{ color: "var(--ff-status-critical)" }}>{error}</p>}
          {!loading && !error && scenarios.length === 0 && (
            <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>No real scenarios yet for this project.</p>
          )}

          <div className="space-y-2">
            {scenarios.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelectScenario(s)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition"
                style={{ border: s.id === selectedScenarioId ? "1px solid var(--ff-accent)" : "1px solid var(--ff-content-bg)" }}
              >
                <div>
                  <div className="text-sm font-semibold" style={{ color: "var(--ff-text-primary)" }}>{s.name}</div>
                  <div className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
                    {s.squareFootage.toLocaleString()} SF × ${(s.ratePerSquareFootCents / 100).toFixed(2)}/SF
                  </div>
                </div>
                <div className="text-sm font-bold" style={{ color: "var(--ff-accent)" }}>{formatDollars(s.totalCents)}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </PanelCard>
  );
}
