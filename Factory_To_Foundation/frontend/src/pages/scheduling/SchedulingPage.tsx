import { useState } from "react";

import { FeaturePage } from "@/framework/ui";

import ScheduleWorkspace from "@/features/scheduling/ScheduleWorkspace";
import ScheduleGantt from "@/features/scheduling/ScheduleGantt/ScheduleGantt";
import ScheduleHeatMap from "@/features/scheduling/ScheduleHeatMap/ScheduleHeatMap";

type SchedulingCapability = "schedule" | "gantt" | "map";

/**
 * No Metrics dropdown — the 5-stage pipeline topology itself is still a
 * rollup of data owned by other features (Factory, Logistics,
 * Construction), none of which have real schedule data yet; a topology-
 * level KPI here would just be invented.
 *
 * Real command-ribbon correction (Phase 10, 2026-08-18): the Interactive
 * Gantt Timeline and Schedule Heat Map used to be two fixed rows inside
 * ScheduleWorkspace's own bespoke layout. Both are real, self-contained
 * views (each independently fetches its own real ScheduleTask data, no
 * shared state with the rest of the workspace) — genuinely first-class
 * capabilities in their own right, same real category as Factory's
 * Instructions/Production/Robot Library. Promoted to real ribbon
 * capability-switch buttons ("Gantt Timeline"/"Schedule Map"), matching
 * Factory's own extraMenus onClick/active shape exactly.
 */
export default function SchedulingPage() {
  const [capability, setCapability] = useState<SchedulingCapability>("schedule");

  const extraMenus = [
    { label: "Schedule", onClick: () => setCapability("schedule"), active: capability === "schedule" },
    { label: "Gantt Timeline", onClick: () => setCapability("gantt"), active: capability === "gantt" },
    { label: "Schedule Map", onClick: () => setCapability("map"), active: capability === "map" },
  ];

  if (capability === "gantt") {
    return (
      <FeaturePage
        pageLabel="Scheduling"
        pageSubtitle="Gantt Timeline"
        extraMenus={extraMenus}
        workspace={<ScheduleGantt />}
      />
    );
  }

  if (capability === "map") {
    return (
      <FeaturePage
        pageLabel="Scheduling"
        pageSubtitle="Schedule Map"
        extraMenus={extraMenus}
        workspace={<ScheduleHeatMap />}
      />
    );
  }

  return (
    <FeaturePage
      pageLabel="Scheduling"
      pageSubtitle="Production & Project Scheduling"
      extraMenus={extraMenus}
      workspace={<ScheduleWorkspace />}
    />
  );
}
