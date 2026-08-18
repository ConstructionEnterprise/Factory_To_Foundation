import { useEffect, useState } from "react";

import { FeaturePage } from "@/framework/ui";

import {
  FactoryFlowBrowse,
  FactoryFlowInspector,
  FactoryFlowMap,
  FactoryInstructions,
  FactoryProduction,
  FactoryWorkspace,
  fetchFactoryFlow,
  listFactoryFlowRuns,
  type FactoryFlow,
  type FactoryFlowProductionRun,
  type FactoryFlowStageKey,
} from "@/features/factory";
import { RobotLibraryBrowse, RobotLibraryDetail, RobotLibraryInspector } from "@/features/engineering-assets";

type FactoryCapability = "twin" | "instructions" | "production" | "factory-flow" | "robot-library";

/**
 * Real command-ribbon standardization (Phase 10, 2026-08-18): Instructions,
 * Production, and Robot Library used to be dropdown panels (Robot Library
 * was a fully custom draggable/resizable floating window specifically
 * engineered to live inside a dropdown -- see the old
 * RobotLibraryRibbonMenu.tsx for what that took). Joshua's explicit
 * instruction: no more dropdowns for these, same real onClick/active
 * capability-switch treatment as every other first-class capability.
 * Instructions/Production keep their own existing internal layout (each
 * is its own real list/panel, not naturally a 3-panel Browse/Detail/
 * Inspector shape) via the `workspace` override, matching Factory's own
 * Twin view precedent. Robot Library gets a real left/center/right layout
 * reusing RobotLibraryBrowse/Detail/Inspector directly -- none of the old
 * floating-window drag/resize/maximize machinery is needed once this is a
 * real page instead of dropdown content.
 *
 * Metrics/Filters removed (Phase 10, 2026-08-18 second pass) -- both were
 * confirmed-decorative (factoryKpis was a static fixture array, no real
 * server-computed data; FactoryToolbar had zero onClick/onChange anywhere)
 * per Joshua's explicit "remove metrics and filters from every command
 * ribbon" instruction. Nothing real was lost -- see FactoryToolbar's own
 * removal.
 */
export default function FactoryPage() {
  const [capability, setCapability] = useState<FactoryCapability>("twin");

  const [runs, setRuns] = useState<FactoryFlowProductionRun[] | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [flow, setFlow] = useState<FactoryFlow | null>(null);
  const [selectedStage, setSelectedStage] = useState<FactoryFlowStageKey | null>(null);

  useEffect(() => {
    if (capability !== "factory-flow" || runs) return;
    listFactoryFlowRuns()
      .then((r) => {
        setRuns(r);
        if (r.length > 0) setSelectedRunId(r[0].id);
      })
      .catch(() => setRuns([]));
  }, [capability, runs]);

  useEffect(() => {
    if (!selectedRunId) return;
    setFlow(null);
    fetchFactoryFlow(selectedRunId).then((f) => {
      setFlow(f);
      setSelectedStage(f.currentStage);
    });
  }, [selectedRunId]);

  const [selectedRobotId, setSelectedRobotId] = useState<string | undefined>(undefined);

  const extraMenus = [
    { label: "Twin", onClick: () => setCapability("twin"), active: capability === "twin" },
    { label: "Instructions", onClick: () => setCapability("instructions"), active: capability === "instructions" },
    // Real Phase 9 physical-result state (ProductionRun/Output) --
    // Manufacturing prepares (Instructions, above); Factory executes
    // and this is that execution's real output, not a second
    // Manufacturing surface.
    { label: "Production", onClick: () => setCapability("production"), active: capability === "production" },
    { label: "Factory Flow", onClick: () => setCapability("factory-flow"), active: capability === "factory-flow" },
    { label: "Robot Library", onClick: () => setCapability("robot-library"), active: capability === "robot-library" },
  ];

  if (capability === "factory-flow") {
    return (
      <FeaturePage
        pageLabel="Factory"
        pageSubtitle="Factory Flow — Instructions Received to Logistics Handoff"
        extraMenus={extraMenus}
        left={<FactoryFlowBrowse runs={runs} selectedRunId={selectedRunId} onSelectRun={setSelectedRunId} />}
        center={<FactoryFlowMap flow={flow} selectedStage={selectedStage} onSelectStage={setSelectedStage} />}
        right={<FactoryFlowInspector flow={flow} selectedStage={selectedStage} />}
      />
    );
  }

  if (capability === "instructions") {
    return (
      <FeaturePage
        pageLabel="Factory"
        pageSubtitle="Instructions — Real Planning Drafts"
        extraMenus={extraMenus}
        workspace={<FactoryInstructions />}
      />
    );
  }

  if (capability === "production") {
    return (
      <FeaturePage
        pageLabel="Factory"
        pageSubtitle="Production — Real ProductionRun/ProductionOutput"
        extraMenus={extraMenus}
        workspace={<FactoryProduction />}
      />
    );
  }

  if (capability === "robot-library") {
    return (
      <FeaturePage
        pageLabel="Factory"
        pageSubtitle="Robot Library"
        extraMenus={extraMenus}
        left={<RobotLibraryBrowse activeId={selectedRobotId} onSelect={setSelectedRobotId} />}
        center={<RobotLibraryDetail selectedId={selectedRobotId} />}
        right={<RobotLibraryInspector selectedId={selectedRobotId} />}
      />
    );
  }

  return (
    <FeaturePage
      pageLabel="Factory"
      pageSubtitle="Digital Twin Manufacturing Operations"
      extraMenus={extraMenus}
      workspace={<FactoryWorkspace />}
    />
  );
}
