import { FeaturePage } from "@/framework/ui";

import ScheduleWorkspace from "@/features/scheduling/ScheduleWorkspace";

/**
 * No Metrics dropdown — the 5-stage pipeline topology itself is still a
 * rollup of data owned by other features (Factory, Logistics,
 * Construction), none of which have real schedule data yet; a topology-
 * level KPI here would just be invented. The real Gantt/Heat Map data
 * below (A7) is genuinely Scheduling's own, but doesn't need a Metrics
 * dropdown either — it's already always-visible in its own panels, not
 * hidden behind a summary.
 *
 * Bespoke `workspace` override (A7), same real "promote to framework/ only
 * on a 3rd consumer" discipline as Factory's own Gantt addition — adds a
 * real Interactive Gantt Timeline + Schedule Heat Map row beneath the
 * existing Browse/Function-Blocks/Inspector row, untouched.
 */
export default function SchedulingPage() {
  return (
    <FeaturePage
      pageLabel="Scheduling"
      pageSubtitle="Production & Project Scheduling"
      workspace={<ScheduleWorkspace />}
    />
  );
}
