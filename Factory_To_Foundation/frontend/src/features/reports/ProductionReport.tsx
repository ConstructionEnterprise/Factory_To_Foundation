import { useEffect, useState } from "react";

import { PanelCard, StatusBadge } from "@/framework/ui";
import { listProductionOutputs, type ProductionOutput } from "@/features/factory/productionApi";

const QC_COLOR: Record<ProductionOutput["qcStatus"], string> = {
  pending: "var(--ff-text-muted)",
  passed: "var(--ff-status-positive)",
  failed: "var(--ff-status-critical)",
};

/**
 * Real Production report (Reports rebuild, 2026-08-18) -- calls the same
 * real, already-unscoped `listProductionOutputs()` Factory's own
 * Production tab reads (no `productionRunId` filter passed), never a
 * second read path.
 */
export default function ProductionReport() {
  const [outputs, setOutputs] = useState<ProductionOutput[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listProductionOutputs()
      .then(setOutputs)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load real production outputs"));
  }, []);

  return (
    <PanelCard
      title="Production"
      className="h-full"
      bodyClassName="flex-1 overflow-auto p-5"
      toolbar={outputs && <StatusBadge label={`${outputs.length} Real Outputs`} tone="neutral" />}
    >
      {error && (
        <p className="mb-3 text-sm" style={{ color: "var(--ff-status-critical)" }}>
          {error}
        </p>
      )}
      {!outputs && !error && (
        <p className="text-sm" style={{ color: "var(--ff-text-muted)" }}>
          Loading real outputs…
        </p>
      )}
      {outputs && outputs.length === 0 && (
        <p className="text-sm" style={{ color: "var(--ff-text-muted)" }}>
          No real production outputs yet.
        </p>
      )}
      {outputs && outputs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr style={{ borderBottom: "2px solid var(--ff-panel-border)" }}>
                {["Serial", "Assembly", "Status", "QC", "Produced"].map((h) => (
                  <th key={h} className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ff-text-muted)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {outputs.map((o) => (
                <tr key={o.id} style={{ borderBottom: "1px solid var(--ff-content-bg)" }}>
                  <td className="py-2 pr-4 font-semibold" style={{ color: "var(--ff-text-primary)" }}>
                    {o.serialNumber}
                  </td>
                  <td className="py-2 pr-4" style={{ color: "var(--ff-text-primary)" }}>
                    {o.assemblyName}
                  </td>
                  <td className="py-2 pr-4" style={{ color: o.status === "complete" ? "var(--ff-status-positive)" : "var(--ff-text-muted)" }}>
                    {o.status}
                  </td>
                  <td className="py-2 pr-4" style={{ color: QC_COLOR[o.qcStatus] }}>
                    {o.qcStatus}
                  </td>
                  <td className="py-2 pr-4" style={{ color: "var(--ff-text-muted)" }}>
                    {o.producedAt ? new Date(o.producedAt).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PanelCard>
  );
}
