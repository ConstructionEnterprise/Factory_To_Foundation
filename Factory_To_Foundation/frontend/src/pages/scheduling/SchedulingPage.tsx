import { FeaturePage } from "@/framework/ui";

import {
  ScheduleBrowse,
  ScheduleInspector,
  ScheduleLayout,
  ScheduleToolbar,
} from "@/features/scheduling";

/**
 * No Metrics dropdown — Scheduling is a rollup of data owned by other
 * features (Factory, Logistics, Construction), none of which have real
 * schedule data yet. KPIs here would just be invented numbers.
 */
export default function SchedulingPage() {
  return (
    <FeaturePage
      pageLabel="Scheduling"
      pageSubtitle="Production & Project Scheduling"
      toolbar={<ScheduleToolbar />}
      left={<ScheduleBrowse />}
      center={<ScheduleLayout />}
      right={<ScheduleInspector />}
    />
  );
}
