import { useEffect, useState } from "react";

import { PanelCard } from "@/framework/ui";
import { fetchMaterials, type MaterialRecord } from "@/features/materials/materialsApi";
import MaterialsSummary from "@/features/materials/MaterialsSummary/MaterialsSummary";

/**
 * Real Inventory report (Reports rebuild, 2026-08-18) -- calls the same
 * real `fetchMaterials()` Inventory's own Materials capability reads,
 * then renders the exact same real `MaterialsSummary` component (on-hand/
 * reserved/consumed already computed backend-side, Phase 8) rather than
 * building a second summary view over the same data.
 */
export default function InventoryReport() {
  const [materials, setMaterials] = useState<MaterialRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMaterials()
      .then(setMaterials)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load real materials"));
  }, []);

  if (error) {
    return (
      <PanelCard title="Inventory" className="h-full" bodyClassName="flex-1 overflow-auto p-5">
        <p className="text-sm" style={{ color: "var(--ff-status-critical)" }}>
          {error}
        </p>
      </PanelCard>
    );
  }

  if (!materials) {
    return (
      <PanelCard title="Inventory" className="h-full" bodyClassName="flex-1 overflow-auto p-5">
        <p className="text-sm" style={{ color: "var(--ff-text-muted)" }}>
          Loading real materials…
        </p>
      </PanelCard>
    );
  }

  return <MaterialsSummary materials={materials} />;
}
