import { FeaturePage } from "@/framework/ui";

import {
  RoboticsBrowse,
  RoboticsInspector,
  RoboticsLayout,
  RoboticsToolbar,
} from "@/features/robotics";

/**
 * No Metrics dropdown: the old fixture KPIs ("142 tool changes today",
 * "1 fault") were fabricated placeholders. Real per-robot telemetry is now
 * live (see the Inspector), but nothing rolls it into real KPI-shaped
 * aggregates yet, so inventing a summary would misrepresent the page.
 */
export default function RoboticsPage() {
  return (
    <FeaturePage
      pageLabel="Robotics"
      pageSubtitle="Robot Library — Live Isolated Robot Views"
      toolbar={<RoboticsToolbar />}
      left={<RoboticsBrowse />}
      center={<RoboticsLayout />}
      right={<RoboticsInspector />}
    />
  );
}
