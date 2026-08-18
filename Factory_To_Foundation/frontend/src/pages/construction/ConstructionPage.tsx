import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { FeaturePage } from "@/framework/ui";

import {
  ConstructionDataMapBrowse,
  ConstructionDataMapInspector,
  ConstructionDataMapView,
  ConstructionDocumentViewer,
  ConstructionMap,
  ConstructionProjectObjects,
  ConstructionProjects,
  CostEstimatingInspector,
  CostEstimatingPanel,
  SequencingInspector,
  SequencingPanel,
  Timeliner,
  type ConstructionDispatchSummary,
  type CostEstimateScenario,
  type ModuleSequenceGraphEntry,
} from "@/features/construction";
import { useDocumentPreview } from "@/features/construction/constructionDocumentPreviewStore";

type ConstructionCapability = "map" | "dataMap" | "estimating" | "sequencing";

/**
 * Real Construction Data Map capability (Phase 1.1, 2026-08-16 rollout) --
 * same ribbon onClick/active pattern already proven by Inventory's
 * Assets/Genealogy switch and Logistics/Fleet. Construction Enterprises
 * Map stays the default, completely unchanged; Data Map is an additional
 * real capability, never a replacement.
 */
const CONSTRUCTION_CAPABILITIES: ConstructionCapability[] = ["map", "dataMap", "estimating", "sequencing"];

export default function ConstructionPage() {
  // Real, minimal deep-link support (Phase 2 interoperability, 2026-08-17)
  // -- read once on mount only, same "seed initial state, don't fight the
  // user's own subsequent ribbon clicks" posture as every other one-shot
  // initial-value read in this codebase. Unlike Logistics/Scheduling/
  // Factory, Construction's capability + per-capability project selection
  // is plain local useState with no SelectionContext participation and no
  // prior URL-param support at all -- this is the smallest real addition
  // that lets an external projection (e.g. Scheduling's Modular Sequence
  // timeline) land a caller on the right tab + project. It does NOT
  // extend to pre-selecting a specific ModuleSequenceEntry within that
  // project -- that selection lives deeper in SequencingPanel/Inspector's
  // own local state, a real, disclosed, un-closed gap, not silently
  // papered over.
  const [searchParams] = useSearchParams();
  const initialCapability = (() => {
    const raw = searchParams.get("capability");
    return CONSTRUCTION_CAPABILITIES.includes(raw as ConstructionCapability) ? (raw as ConstructionCapability) : "map";
  })();

  const [capability, setCapability] = useState<ConstructionCapability>(initialCapability);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedDispatch, setSelectedDispatch] = useState<ConstructionDispatchSummary | null>(null);

  const [estimatingProjectId, setEstimatingProjectId] = useState<string | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<CostEstimateScenario | null>(null);
  // Bumped after a real delete in the Inspector so the Panel's own list
  // refetches without the Inspector owning that read path itself.
  const [scenarioRefreshKey, setScenarioRefreshKey] = useState(0);

  const [sequencingProjectId, setSequencingProjectId] = useState<string | null>(searchParams.get("project"));
  const [sequenceEntries, setSequenceEntries] = useState<ModuleSequenceGraphEntry[]>([]);
  const [selectedSequenceEntry, setSelectedSequenceEntry] = useState<ModuleSequenceGraphEntry | null>(null);
  // Bumped after a real status/position/dependency change so the Panel's
  // own list refetches without the Inspector owning that read path itself.
  const [sequenceRefreshKey, setSequenceRefreshKey] = useState(0);

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
    { label: "Sequencing", onClick: () => setCapability("sequencing"), active: capability === "sequencing" },
  ];

  if (capability === "sequencing") {
    return (
      <FeaturePage
        pageLabel="Construction"
        pageSubtitle="Modular Sequencing — Real Handoff-Gated Timeline"
        extraMenus={extraMenus}
        left={
          <ConstructionDataMapBrowse
            title="Sequencing"
            selectedProjectId={sequencingProjectId}
            onSelectProject={(id) => {
              setSequencingProjectId(id);
              setSelectedSequenceEntry(null);
            }}
          />
        }
        center={
          <div className="flex h-full flex-col">
            <SequencingPanel
              projectId={sequencingProjectId}
              selectedEntryId={selectedSequenceEntry?.id ?? null}
              onSelectEntry={setSelectedSequenceEntry}
              refreshKey={sequenceRefreshKey}
              onEntriesLoaded={(entries) => {
                setSequenceEntries(entries);
                setSelectedSequenceEntry((prev) => (prev ? entries.find((e) => e.id === prev.id) ?? prev : prev));
              }}
            />
            <Timeliner entries={sequenceEntries} />
          </div>
        }
        right={
          <SequencingInspector
            entry={selectedSequenceEntry}
            otherEntries={sequenceEntries}
            onChanged={() => setSequenceRefreshKey((k) => k + 1)}
          />
        }
      />
    );
  }

  if (capability === "estimating") {
    return (
      <FeaturePage
        pageLabel="Construction"
        pageSubtitle="Cost Estimating — Real Project Scenarios"
        extraMenus={extraMenus}
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
      left={<ConstructionProjects />}
      center={file ? <ConstructionDocumentViewer /> : <ConstructionMap />}
      right={<ConstructionProjectObjects />}
    />
  );
}
