import { useEffect, useState } from "react";

import { listProductionOutputs, listProductionRuns, type ProductionOutput, type ProductionRun } from "./productionApi";

const STATUS_COLOR: Record<string, string> = {
  in_progress: "var(--ff-status-neutral)",
  in_production: "var(--ff-status-neutral)",
  complete: "var(--ff-status-positive)",
  pending: "var(--ff-status-neutral)",
  passed: "var(--ff-status-positive)",
  failed: "var(--ff-status-critical)",
};

function Badge({ label }: { label: string }) {
  return (
    <span
      className="rounded-[0.2rem] px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase"
      style={{ background: STATUS_COLOR[label] ?? "var(--ff-status-neutral)", color: "white" }}
    >
      {label.replace("_", " ")}
    </span>
  );
}

/**
 * Content for Factory's "Production" CommandRibbon dropdown (vertical-
 * slice follow-up to Phase 9, 2026-08-17) — real, read-only visibility
 * into ProductionRun -> ProductionOutput, the physical-result state
 * Manufacturing's own instructions become once Factory actually executes
 * them. Manufacturing owns the model/shop-drawings/instructions side
 * (FactoryInstructions.tsx, above this in the same ribbon); this is the
 * execution/output side — same domain split Joshua drew explicitly.
 * Same fixed-width dropdown-panel convention as FactoryInstructions.tsx.
 */
export default function FactoryProduction() {
  const [runs, setRuns] = useState<ProductionRun[] | null>(null);
  const [outputs, setOutputs] = useState<ProductionOutput[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listProductionRuns(), listProductionOutputs()])
      .then(([r, o]) => {
        setRuns(r);
        setOutputs(o);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  if (error) {
    return (
      <div className="w-96 p-3 text-xs" style={{ color: "var(--ff-status-critical)" }}>
        Couldn't load real production data ({error})
      </div>
    );
  }

  if (!runs) {
    return (
      <div className="w-96 p-3 text-sm" style={{ color: "var(--ff-text-muted)" }}>
        Loading…
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="w-96 p-3 text-sm" style={{ color: "var(--ff-text-muted)" }}>
        No real production runs yet.
      </div>
    );
  }

  return (
    <div className="w-[28rem] max-w-full max-h-96 overflow-auto p-3">
      {runs
        .slice()
        .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
        .map((run) => {
          const runOutputs = (outputs ?? []).filter((o) => o.productionRunId === run.id);
          return (
            <div key={run.id} className="mb-3 rounded-[0.2rem] p-2" style={{ border: "1px solid var(--ff-panel-border)" }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold" style={{ color: "var(--ff-accent)" }}>
                  {run.assemblyName}
                </span>
                <Badge label={run.status} />
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 text-[0.65rem]" style={{ color: "var(--ff-text-muted)" }}>
                {run.cellRef && (
                  <span>
                    Cell: <span className="font-medium">{run.cellRef}</span>
                  </span>
                )}
                <span>
                  Produced:{" "}
                  <span className="font-medium">
                    {run.actualQuantity}
                    {run.plannedQuantity !== null ? ` / ${run.plannedQuantity} planned` : ""}
                  </span>
                </span>
                <span>Started: {new Date(run.startedAt).toLocaleString()}</span>
              </div>

              {runOutputs.length > 0 && (
                <ol className="mt-2 space-y-1.5">
                  {runOutputs.map((o) => (
                    <li key={o.id} className="rounded-[0.2rem] p-1.5" style={{ background: "var(--ff-chrome-bg)" }}>
                      <div className="flex items-center justify-between">
                        <span className="text-[0.7rem] font-semibold" style={{ color: "var(--ff-text-primary)" }}>
                          {o.serialNumber}
                        </span>
                        <div className="flex gap-1">
                          <Badge label={o.status} />
                          <Badge label={o.qcStatus} />
                        </div>
                      </div>
                      <div className="mt-0.5 text-[0.65rem]" style={{ color: "var(--ff-text-muted)" }}>
                        {o.destinationProjectId ? `Destination: ${o.destinationProjectId}` : "No real destination set yet"}
                        {o.producedAt ? ` — produced ${new Date(o.producedAt).toLocaleString()}` : ""}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
    </div>
  );
}
