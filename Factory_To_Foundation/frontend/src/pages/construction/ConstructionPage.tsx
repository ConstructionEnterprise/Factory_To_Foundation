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
  type ConstructionDispatchSummary,
} from "@/features/construction";
import { useDocumentPreview } from "@/features/construction/constructionDocumentPreviewStore";

const constructionKpis: KpiDefinition[] = [
  { title: "Buildings Complete", value: "1 / 3" },
  { title: "Open Punch Items", value: "8" },
  { title: "Modules Installed", value: "22" },
  { title: "Avg Progress", value: "54%" },
];

type ConstructionCapability = "map" | "dataMap";

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
  ];

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
