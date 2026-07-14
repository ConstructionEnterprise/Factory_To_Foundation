import { FeaturePage, KpiList, type KpiDefinition } from "@/framework/ui";

import {
  RoboticsBrowse,
  RoboticsInspector,
  RoboticsLayout,
  RoboticsToolbar,
} from "@/features/robotics";

const roboticsKpis: KpiDefinition[] = [
  { title: "Cells Online", value: "3 / 4" },
  { title: "Tool Changes (Today)", value: "142" },
  { title: "Avg Cycle Time", value: "31.2s" },
  { title: "Fault Count", value: "1" },
];

export default function RoboticsPage() {
  return (
    <FeaturePage
      pageLabel="Robotics"
      pageSubtitle="Robot Cells & Simulation"
      kpis={<KpiList kpis={roboticsKpis} />}
      toolbar={<RoboticsToolbar />}
      left={<RoboticsBrowse />}
      center={<RoboticsLayout />}
      right={<RoboticsInspector />}
    />
  );
}
