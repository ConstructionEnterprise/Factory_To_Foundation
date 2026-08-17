import { FeaturePage, KpiList, type KpiDefinition } from "@/framework/ui";

import { FactoryInstructions, FactoryProduction, FactoryToolbar, FactoryWorkspace } from "@/features/factory";
import { RobotLibraryRibbonMenu } from "@/features/engineering-assets";

const factoryKpis: KpiDefinition[] = [
  { title: "Active Lines", value: "2 / 2" },
  { title: "Machines Online", value: "9 / 11" },
  { title: "Overall Utilization", value: "74%" },
  { title: "Units Produced (MTD)", value: "3,214" },
  { title: "Downtime Alerts", value: "2" },
  { title: "OEE", value: "81.5%" },
];

export default function FactoryPage() {
  return (
    <FeaturePage
      pageLabel="Factory"
      pageSubtitle="Digital Twin Manufacturing Operations"
      kpis={<KpiList kpis={factoryKpis} />}
      toolbar={<FactoryToolbar />}
      extraMenus={[
        { label: "Instructions", content: <FactoryInstructions /> },
        // Real Phase 9 physical-result state (ProductionRun/Output) --
        // Manufacturing prepares (Instructions, above); Factory executes
        // and this is that execution's real output, not a second
        // Manufacturing surface.
        { label: "Production", content: <FactoryProduction /> },
        { label: "Robot Library", content: <RobotLibraryRibbonMenu /> },
      ]}
      workspace={<FactoryWorkspace />}
    />
  );
}
