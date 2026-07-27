import { useState } from "react";

import { FeaturePage, KpiList, type KpiDefinition } from "@/framework/ui";

import {
  LogisticsBrowse,
  LogisticsDispatchForm,
  LogisticsDispatchTracker,
  LogisticsInspector,
  LogisticsMap,
  LogisticsMaterialForm,
  LogisticsModuleForm,
  LogisticsToolbar,
} from "@/features/logistics";

// Real KPI-row wiring is a separate, still-disclosed fixture gap (gap #4)
// — untouched by Phase 8, which is scoped to the Browse panel itself, not
// this row. Dock Utilization/Deliveries (MTD) have no real data source to
// back them at all (no dock concept, no delivery-date aggregation
// anywhere); Modules Staged/In Transit COULD be made real cheaply now that
// real Module/Dispatch counts exist, but that's a deliberate, separate
// decision for whoever picks up gap #4 next, not silently bundled in here.
const logisticsKpis: KpiDefinition[] = [
  { title: "Modules Staged", value: "14" },
  { title: "In Transit", value: "2" },
  { title: "Dock Utilization", value: "68%" },
  { title: "Deliveries (MTD)", value: "37" },
];

export default function LogisticsPage() {
  const [showDispatchForm, setShowDispatchForm] = useState(false);
  const [showDispatchTracker, setShowDispatchTracker] = useState(false);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [showModuleForm, setShowModuleForm] = useState(false);

  // Real Browse Logistics panel (Phase 8) fetches on mount only — bumping
  // this key forces a real remount/refetch any time a creation form
  // actually writes a new row, so a newly-created material/module/dispatch
  // shows up in Browse without requiring a manual page reload.
  const [browseRefreshKey, setBrowseRefreshKey] = useState(0);
  const refreshBrowse = () => setBrowseRefreshKey((k) => k + 1);

  return (
    <>
      <FeaturePage
        pageLabel="Logistics"
        pageSubtitle="Material & Module Flow"
        kpis={<KpiList kpis={logisticsKpis} />}
        toolbar={
          <LogisticsToolbar
            onNewMaterial={() => setShowMaterialForm(true)}
            onNewModule={() => setShowModuleForm(true)}
            onNewDispatch={() => setShowDispatchForm(true)}
            onTrackDispatches={() => setShowDispatchTracker(true)}
          />
        }
        left={<LogisticsBrowse key={browseRefreshKey} />}
        center={<LogisticsMap />}
        right={<LogisticsInspector />}
      />
      {showDispatchForm && (
        <LogisticsDispatchForm onClose={() => setShowDispatchForm(false)} onCreated={refreshBrowse} />
      )}
      {showDispatchTracker && <LogisticsDispatchTracker onClose={() => setShowDispatchTracker(false)} />}
      {showMaterialForm && (
        <LogisticsMaterialForm onClose={() => setShowMaterialForm(false)} onCreated={refreshBrowse} />
      )}
      {showModuleForm && <LogisticsModuleForm onClose={() => setShowModuleForm(false)} onCreated={refreshBrowse} />}
    </>
  );
}
