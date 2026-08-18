import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { FeaturePage } from "@/framework/ui";

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
  MileageRateManager,
  fetchVehicles,
  type VehicleRecord,
} from "@/features/logistics";

type LogisticsCapability = "operations" | "flow" | "fleet";

/**
 * Real command-ribbon correction (Phase 10, 2026-08-18): Operations and
 * Logistics Flow used to be a `mode` toggle buried inside LogisticsToolbar
 * (rendered via the "Filters" dropdown) -- both are genuine first-class
 * capabilities that swap the whole workspace, exactly like Fleet already
 * does, so they get the same real CommandRibbon onClick/active mechanism
 * Fleet always used. See CommandRibbon.tsx's own doc comment for the
 * real distinction this now correctly follows.
 *
 * Metrics/Filters removed entirely (Phase 10, second pass, same day) --
 * the real, functional dispatch actions (+New Material/+New Module/
 * +New Dispatch/Track Dispatches/Mileage Rate) that used to live inside
 * "Filters" moved to a real "Dispatch" tab inside LogisticsBrowse's own
 * panel header (mirrors ManufacturingBrowse's Objects/Shop Drawings
 * toggle exactly) -- see LogisticsBrowse.tsx's own doc comment. The
 * generic search/zone/status/Filters/Reset controls that sat alongside
 * them were confirmed decorative and dropped, not relocated. KPI numbers
 * were real but purely informational, same as every other domain's
 * removed Metrics this phase -- nothing functional was lost.
 */
export default function LogisticsPage() {
  const [searchParams] = useSearchParams();
  const capabilityParam = searchParams.get("capability");
  const [capability, setCapability] = useState<LogisticsCapability>(
    capabilityParam === "flow" || capabilityParam === "fleet" ? capabilityParam : "operations"
  );
  // Real cross-domain deep link (e.g. LogisticsFlowInspector's Transportation
  // Handoff dispatch reference navigating here via ?dispatch=<id>), same
  // convention ModularSequenceTimeline.tsx established for Scheduling ->
  // Construction's ?capability=/?project= link. Synced via effect, not just
  // read once at mount -- LogisticsPage stays mounted across a same-route
  // client-side navigate() (Flow -> Operations via this exact link), so the
  // useState initializer alone would miss a param change after first mount.
  useEffect(() => {
    if (capabilityParam === "flow" || capabilityParam === "fleet" || capabilityParam === "operations") {
      setCapability(capabilityParam);
    }
  }, [capabilityParam]);
  const initialDispatchId = searchParams.get("dispatch");
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
          left={
            <LogisticsBrowse
              key={browseRefreshKey}
              initialDispatchId={initialDispatchId}
              onNewMaterial={() => setShowMaterialForm(true)}
              onNewModule={() => setShowModuleForm(true)}
              onNewDispatch={() => setShowDispatchForm(true)}
              onTrackDispatches={() => setShowDispatchTracker(true)}
              onMileageRate={() => setShowMileageRateManager(true)}
            />
          }
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
