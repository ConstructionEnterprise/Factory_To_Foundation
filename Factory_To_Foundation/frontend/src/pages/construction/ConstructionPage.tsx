import { useState } from "react";

import { FeaturePage, KpiList, type KpiDefinition } from "@/framework/ui";

import {
  ConstructionDataMapBrowse,
  ConstructionDataMapInspector,
  ConstructionDataMapView,
  ConstructionDocumentViewer,
  ConstructionMap,
  ConstructionProjectObjects,
  ConstructionProjects,
  ConstructionToolbar,
  CostEstimatingInspector,
  CostEstimatingPanel,
  type ConstructionDispatchSummary,
  type CostEstimateScenario,
} from "@/features/construction";
import { useDocumentPreview } from "@/features/construction/constructionDocumentPreviewStore";

const constructionKpis: KpiDefinition[] = [
  { title: "Buildings Complete", value: "1 / 3" },
  { title: "Open Punch Items", value: "8" },
  { title: "Modules Installed", value: "22" },
  { title: "Avg Progress", value: "54%" },
];

type ConstructionCapability = "map" | "dataMap" | "estimating";

/**
 * Real Construction Data Map capability (Phase 1.1, 2026-08-16 rollout) --
 * same ribbon onClick/active pattern already proven by Inventory's
 * Assets/Genealogy switch and Logistics/Fleet. Construction Enterprises
 * Map stays the default, completely unchanged; Data Map is an additional
 * real capability, never a replacement.
 */
export default function ConstructionPage() {
  const [capability, setCapability] = useState<ConstructionCapability>("map");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedDispatch, setSelectedDispatch] = useState<ConstructionDispatchSummary | null>(null);

  const [estimatingProjectId, setEstimatingProjectId] = useState<string | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<CostEstimateScenario | null>(null);
  // Bumped after a real delete in the Inspector so the Panel's own list
  // refetches without the Inspector owning that read path itself.
  const [scenarioRefreshKey, setScenarioRefreshKey] = useState(0);

  // Construction tab reorg — the center panel toggles between the map
  // (default) and a document viewer, driven by constructionDocumentPreviewStore.
  // Selecting a document in the left "Construction Projects" tree
  // (FileCard's click-to-preview) sets this; clearDocumentPreview() (an
  // explicit Close, or selecting anything in the right "Project Objects"
  // tree) reverts to the map.
  const { file } = useDocumentPreview();

  const extraMenus = [
    { label: "Map", onClick: () => setCapability("map"), active: capability === "map" },
    { label: "Data Map", onClick: () => setCapability("dataMap"), active: capability === "dataMap" },
    { label: "Estimating", onClick: () => setCapability("estimating"), active: capability === "estimating" },
  ];

  if (capability === "estimating") {
    return (
      <FeaturePage
        pageLabel="Construction"
        pageSubtitle="Cost Estimating — Real Project Scenarios"
        extraMenus={extraMenus}
        kpis={<KpiList kpis={constructionKpis} />}
        left={
          <ConstructionDataMapBrowse
            title="Cost Estimating"
            selectedProjectId={estimatingProjectId}
            onSelectProject={(id) => {
              setEstimatingProjectId(id);
              setSelectedScenario(null);
            }}
          />
        }
        center={
          <CostEstimatingPanel
            projectId={estimatingProjectId}
            selectedScenarioId={selectedScenario?.id ?? null}
            onSelectScenario={setSelectedScenario}
            refreshKey={scenarioRefreshKey}
          />
        }
        right={
          <CostEstimatingInspector
            scenario={selectedScenario}
            onDeleted={() => {
              setSelectedScenario(null);
              setScenarioRefreshKey((k) => k + 1);
            }}
          />
        }
      />
    );
  }

  if (capability === "dataMap") {
    return (
      <FeaturePage
        pageLabel="Construction"
        pageSubtitle="Data Map — Real Project Relationships"
        extraMenus={extraMenus}
        kpis={<KpiList kpis={constructionKpis} />}
        left={
          <ConstructionDataMapBrowse
            selectedProjectId={selectedProjectId}
            onSelectProject={(id) => {
              setSelectedProjectId(id);
              setSelectedDispatch(null);
            }}
          />
        }
        center={
          <ConstructionDataMapView
            projectId={selectedProjectId}
            selectedDispatchId={selectedDispatch?.id ?? null}
            onSelectDispatch={setSelectedDispatch}
          />
        }
        right={<ConstructionDataMapInspector dispatch={selectedDispatch} />}
      />
    );
  }

  return (
    <FeaturePage
      pageLabel="Construction"
      pageSubtitle="Construction Site Operations"
      extraMenus={extraMenus}
      kpis={<KpiList kpis={constructionKpis} />}
      toolbar={<ConstructionToolbar />}
      left={<ConstructionProjects />}
      center={file ? <ConstructionDocumentViewer /> : <ConstructionMap />}
      right={<ConstructionProjectObjects />}
    />
  );
}
