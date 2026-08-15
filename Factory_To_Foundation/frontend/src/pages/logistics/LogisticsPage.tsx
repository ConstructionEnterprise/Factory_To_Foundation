import { useEffect, useState } from "react";

import { FeaturePage, KpiList, type KpiDefinition } from "@/framework/ui";

import {
  LogisticsBrowse,
  LogisticsDispatchForm,
  LogisticsDispatchTracker,
  LogisticsFlowBrowse,
  LogisticsFlowInspector,
  LogisticsFlowMap,
  LogisticsInspector,
  LogisticsMap,
  LogisticsMaterialForm,
  LogisticsModuleForm,
  LogisticsToolbar,
  MileageRateManager,
  type LogisticsMode,
} from "@/features/logistics";
import { getLogisticsKpis, type LogisticsKpis } from "@/features/logistics/logisticsOperationsApi";

/**
 * Real KPI row (closes gap #4 — this row was left on its original fixture
 * numbers when Phase 8's Browse panel went real). "Modules Staged"/"In
 * Transit"/"Deliveries (MTD)" are real, server-computed counts
 * (logisticsKpiService.ts). "Dock Utilization" stays an honest, disclosed
 * non-value — no dock/capacity concept exists anywhere in this schema (no
 * LogisticsReceiving model either, per LogisticsBrowse.tsx's own doc
 * comment), and inventing one just to fill a percentage would be
 * fabrication, not a real KPI.
 */
function buildKpis(kpis: LogisticsKpis | null): KpiDefinition[] {
  return [
    { title: "Modules Staged", value: kpis ? String(kpis.modulesStaged) : "…" },
    { title: "In Transit", value: kpis ? String(kpis.modulesInTransit) : "…" },
    { title: "Dock Utilization", value: "No dock model yet" },
    { title: "Deliveries (MTD)", value: kpis ? String(kpis.deliveriesThisMonth) : "…" },
  ];
}

export default function LogisticsPage() {
  const [mode, setMode] = useState<LogisticsMode>("operations");
  const [showDispatchForm, setShowDispatchForm] = useState(false);
  const [showDispatchTracker, setShowDispatchTracker] = useState(false);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [showMileageRateManager, setShowMileageRateManager] = useState(false);

  // Real Browse Logistics panel (Phase 8) fetches on mount only — bumping
  // this key forces a real remount/refetch any time a creation form
  // actually writes a new row, so a newly-created material/module/dispatch
  // shows up in Browse without requiring a manual page reload.
  const [browseRefreshKey, setBrowseRefreshKey] = useState(0);
  const refreshBrowse = () => setBrowseRefreshKey((k) => k + 1);

  const [kpis, setKpis] = useState<LogisticsKpis | null>(null);
  useEffect(() => {
    getLogisticsKpis()
      .then(setKpis)
      .catch(() => setKpis(null));
  }, [browseRefreshKey]);

  return (
    <>
      <FeaturePage
        pageLabel="Logistics"
        pageSubtitle={mode === "operations" ? "Material & Module Flow" : "Logistics Flow — Point-to-Point Map"}
        kpis={<KpiList kpis={buildKpis(kpis)} />}
        toolbar={
          <LogisticsToolbar
            mode={mode}
            onModeChange={setMode}
            onNewMaterial={() => setShowMaterialForm(true)}
            onNewModule={() => setShowModuleForm(true)}
            onNewDispatch={() => setShowDispatchForm(true)}
            onTrackDispatches={() => setShowDispatchTracker(true)}
            onMileageRate={() => setShowMileageRateManager(true)}
          />
        }
        left={mode === "operations" ? <LogisticsBrowse key={browseRefreshKey} /> : <LogisticsFlowBrowse />}
        center={mode === "operations" ? <LogisticsMap /> : <LogisticsFlowMap />}
        right={mode === "operations" ? <LogisticsInspector /> : <LogisticsFlowInspector />}
      />
      {showDispatchForm && (
        <LogisticsDispatchForm onClose={() => setShowDispatchForm(false)} onCreated={refreshBrowse} />
      )}
      {showDispatchTracker && <LogisticsDispatchTracker onClose={() => setShowDispatchTracker(false)} />}
      {showMaterialForm && (
        <LogisticsMaterialForm onClose={() => setShowMaterialForm(false)} onCreated={refreshBrowse} />
      )}
      {showModuleForm && <LogisticsModuleForm onClose={() => setShowModuleForm(false)} onCreated={refreshBrowse} />}
      {showMileageRateManager && <MileageRateManager onClose={() => setShowMileageRateManager(false)} />}
    </>
  );
}
