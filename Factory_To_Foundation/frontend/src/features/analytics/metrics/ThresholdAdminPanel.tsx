import { useEffect, useState } from "react";

import { usePermission } from "@/context/AuthContext";
import { PanelCard, ToolbarButton, ToolbarInput, ToolbarSelect } from "@/framework/ui";

import {
  clearThreshold,
  fetchMetricCatalog,
  fetchThresholds,
  setThreshold,
  type AlarmComparator,
  type AnalyticsThreshold,
  type MetricCatalogEntry,
} from "./analyticsMetricsApi";

type DraftState = { comparator: AlarmComparator; value: string; windowMinutes: string };

function emptyDraft(): DraftState {
  return { comparator: "greater_than", value: "", windowMinutes: "60" };
}

/**
 * Real threshold admin panel (Phase 3.3, plan doc §5). Every row is one
 * of the fixed 5 catalog metrics -- there is no way to reference a metric
 * that isn't real, since the picker itself only ever lists the catalog.
 * Write controls are gated in the UI on analytics:update (real enforcement
 * already lives on the backend, §2.4/§4 -- this only prevents *offering*
 * an action the backend would refuse).
 */
export default function ThresholdAdminPanel() {
  const updatePermission = usePermission("analytics", "update");
  const deletePermission = usePermission("analytics", "delete");

  const [catalog, setCatalog] = useState<MetricCatalogEntry[]>([]);
  const [thresholds, setThresholds] = useState<Record<string, AnalyticsThreshold>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<Record<string, string>>({});

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([fetchMetricCatalog(), fetchThresholds()])
      .then(([entries, rows]) => {
        setCatalog(entries);
        setThresholds(Object.fromEntries(rows.map((r) => [r.metricKey, r])));
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const draftFor = (metricKey: string): DraftState => drafts[metricKey] ?? emptyDraft();
  const updateDraft = (metricKey: string, patch: Partial<DraftState>) =>
    setDrafts((prev) => ({ ...prev, [metricKey]: { ...draftFor(metricKey), ...patch } }));

  const handleSet = async (metricKey: string) => {
    const draft = draftFor(metricKey);
    const value = Number(draft.value);
    const windowMinutes = Number(draft.windowMinutes);
    setSaveError((prev) => ({ ...prev, [metricKey]: "" }));
    if (!Number.isFinite(value)) {
      setSaveError((prev) => ({ ...prev, [metricKey]: "Enter a real threshold value." }));
      return;
    }
    if (!(windowMinutes > 0)) {
      setSaveError((prev) => ({ ...prev, [metricKey]: "Enter a real, positive window (minutes)." }));
      return;
    }
    setSavingKey(metricKey);
    try {
      await setThreshold(metricKey, draft.comparator, value, windowMinutes);
      load();
    } catch (err) {
      setSaveError((prev) => ({ ...prev, [metricKey]: err instanceof Error ? err.message : String(err) }));
    } finally {
      setSavingKey(null);
    }
  };

  const handleClear = async (metricKey: string) => {
    setSavingKey(metricKey);
    try {
      await clearThreshold(metricKey);
      load();
    } catch (err) {
      setSaveError((prev) => ({ ...prev, [metricKey]: err instanceof Error ? err.message : String(err) }));
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <PanelCard title="Thresholds" className="h-full" bodyClassName="flex-1 overflow-auto p-5">
      {loading && <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>Loading real thresholds…</p>}
      {error && <p className="text-xs" style={{ color: "var(--ff-status-critical)" }}>{error}</p>}
      {!loading && !error && (
        <div className="space-y-3">
          {catalog.map((entry) => {
            const existing = thresholds[entry.key];
            const draft = draftFor(entry.key);
            const rowError = saveError[entry.key];
            return (
              <div key={entry.key} className="rounded-lg p-3" style={{ border: "1px solid var(--ff-content-bg)" }}>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold" style={{ color: "var(--ff-text-primary)" }}>{entry.label}</div>
                  {existing && (
                    <div className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
                      Currently: {existing.comparator === "greater_than" ? ">" : "<"} {existing.value}{entry.shape === "percent" ? "%" : ""} over {existing.windowMinutes}m
                    </div>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <ToolbarSelect
                    value={draft.comparator}
                    disabled={!updatePermission.allowed}
                    onChange={(e) => updateDraft(entry.key, { comparator: e.target.value as AlarmComparator })}
                  >
                    <option value="greater_than">greater than</option>
                    <option value="less_than">less than</option>
                  </ToolbarSelect>
                  <ToolbarInput
                    type="number"
                    placeholder={`Value${entry.shape === "percent" ? " (%)" : ""}`}
                    value={draft.value}
                    disabled={!updatePermission.allowed}
                    onChange={(e) => updateDraft(entry.key, { value: e.target.value })}
                  />
                  <ToolbarInput
                    type="number"
                    placeholder="Window (min)"
                    value={draft.windowMinutes}
                    disabled={!updatePermission.allowed}
                    onChange={(e) => updateDraft(entry.key, { windowMinutes: e.target.value })}
                  />
                  <ToolbarButton
                    onClick={() => handleSet(entry.key)}
                    disabled={!updatePermission.allowed || savingKey === entry.key}
                    title={updatePermission.reason}
                  >
                    {savingKey === entry.key ? "Saving…" : existing ? "Replace" : "Set"}
                  </ToolbarButton>
                  {existing && (
                    <ToolbarButton
                      onClick={() => handleClear(entry.key)}
                      disabled={!deletePermission.allowed || savingKey === entry.key}
                      title={deletePermission.reason}
                    >
                      Clear
                    </ToolbarButton>
                  )}
                </div>
                {rowError && <p className="mt-1 text-xs" style={{ color: "var(--ff-status-critical)" }}>{rowError}</p>}
              </div>
            );
          })}
        </div>
      )}
    </PanelCard>
  );
}
