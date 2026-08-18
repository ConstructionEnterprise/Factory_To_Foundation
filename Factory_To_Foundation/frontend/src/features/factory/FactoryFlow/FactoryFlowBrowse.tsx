import { PanelCard } from "@/framework/ui";

import type { ProductionRun } from "../productionApi";

type FactoryFlowBrowseProps = {
  runs: ProductionRun[] | null;
  selectedRunId: string | null;
  onSelectRun: (id: string) => void;
};

/** Real Browse column (Phase 10, 2026-08-18) -- every real ProductionRun, click to load its real Factory Flow projection. */
export default function FactoryFlowBrowse({ runs, selectedRunId, onSelectRun }: FactoryFlowBrowseProps) {
  return (
    <PanelCard title="Browse Runs" className="h-full" bodyClassName="flex-1 overflow-auto p-3">
      {!runs && <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>Loading…</p>}
      {runs && runs.length === 0 && (
        <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>No real production runs yet.</p>
      )}
      {runs?.map((r) => (
        <button
          key={r.id}
          onClick={() => onSelectRun(r.id)}
          className="mb-1.5 block w-full rounded-lg px-3 py-2 text-left text-sm"
          style={{
            border: r.id === selectedRunId ? "1px solid var(--ff-accent)" : "1px solid var(--ff-content-bg)",
            color: "var(--ff-text-primary)",
          }}
        >
          <div className="font-semibold">{r.assemblyName}</div>
          <div className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
            {r.status} — {r.actualQuantity}
            {r.plannedQuantity !== null ? ` / ${r.plannedQuantity}` : ""}
          </div>
        </button>
      ))}
    </PanelCard>
  );
}
