import { useEffect, useState } from "react";

import { FeaturePage, KpiList, type KpiDefinition } from "@/framework/ui";

import {
  FleetBrowse,
  FleetInspector,
  FleetWorkspace,
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
  fetchVehicles,
  type VehicleRecord,
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

type LogisticsCapability = "operations" | "flow" | "fleet";

export default function LogisticsPage() {
  // Real command-ribbon correction (Phase 10, 2026-08-18): Operations and
  // Logistics Flow used to be a `mode` toggle buried inside LogisticsToolbar
  // (rendered via the "Filters" dropdown) -- both are genuine first-class
  // capabilities that swap the whole workspace, exactly like Fleet already
  // does, so they get the same real CommandRibbon onClick/active mechanism
  // Fleet always used. See CommandRibbon.tsx's own doc comment for the
  // real distinction this now correctly follows.
  const [capability, setCapability] = useState<LogisticsCapability>("operations");
  const [showDispatchForm, setShowDispatchForm] = useState(false);
  const [showDispatchTracker, setShowDispatchTracker] = useState(false);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [showMileageRateManager, setShowMileageRateManager] = useState(false);

  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [vehiclesError, setVehiclesError] = useState<string | null>(null);
  useEffect(() => {
    if (capability !== "fleet") return;
    fetchVehicles()
      .then(setVehicles)
      .catch((err) => setVehiclesError(err instanceof Error ? err.message : String(err)));
  }, [capability]);

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

  const extraMenus = [
    { label: "Operations", onClick: () => setCapability("operations"), active: capability === "operations" },
    { label: "Logistics Flow", onClick: () => setCapability("flow"), active: capability === "flow" },
    { label: "Fleet", onClick: () => setCapability("fleet"), active: capability === "fleet" },
  ];

  return (
    <>
      {capability === "fleet" && (
        <FeaturePage
          pageLabel="Logistics"
          pageSubtitle={vehiclesError ? `Fleet — Vehicle Registry & Dispatch History — ${vehiclesError}` : "Fleet — Vehicle Registry & Dispatch History"}
          extraMenus={extraMenus}
          kpis={
            <KpiList
              kpis={[
                { title: "Total Vehicles", value: String(vehicles.length) },
                { title: "Active", value: String(vehicles.filter((v) => v.status === "active").length) },
                { title: "In Maintenance", value: String(vehicles.filter((v) => v.status === "maintenance").length) },
                { title: "Retired", value: String(vehicles.filter((v) => v.status === "retired").length) },
              ]}
            />
          }
          left={<FleetBrowse vehicles={vehicles} />}
          center={<FleetWorkspace />}
          right={<FleetInspector />}
        />
      )}
      {capability === "flow" && (
        <FeaturePage
          pageLabel="Logistics"
          pageSubtitle="Logistics Flow — Point-to-Point Map"
          extraMenus={extraMenus}
          kpis={<KpiList kpis={buildKpis(kpis)} />}
          left={<LogisticsFlowBrowse />}
          center={<LogisticsFlowMap />}
          right={<LogisticsFlowInspector />}
        />
      )}
      {capability === "operations" && (
        <FeaturePage
          pageLabel="Logistics"
          pageSubtitle="Material & Module Flow"
          extraMenus={extraMenus}
          kpis={<KpiList kpis={buildKpis(kpis)} />}
          toolbar={
            <LogisticsToolbar
              onNewMaterial={() => setShowMaterialForm(true)}
              onNewModule={() => setShowModuleForm(true)}
              onNewDispatch={() => setShowDispatchForm(true)}
              onTrackDispatches={() => setShowDispatchTracker(true)}
              onMileageRate={() => setShowMileageRateManager(true)}
            />
          }
          left={<LogisticsBrowse key={browseRefreshKey} />}
          center={<LogisticsMap />}
          right={<LogisticsInspector />}
        />
      )}
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
