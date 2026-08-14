import { useState } from "react";

import { FeaturePage } from "@/framework/ui";
import { RobotLibraryBrowse, RobotLibraryDetail, RobotLibraryInspector } from "@/features/engineering-assets";

/**
 * Phase 5: read-only browse/inspect UI over the Engineering Asset Catalog
 * built in Phase 4/4.5 from the Phase 1-3B recovery + migration work. No
 * node editor, no load/compose actions -- those are explicitly deferred
 * (see the disabled "Load" button in RobotLibraryInspector).
 *
 * Naming note, not silently resolved: /robotics already has a panel
 * titled "Robot Library" (RoboticsBrowse) for the 4 live twin robots
 * (A1/A2/B1/B2) -- a different thing from this page, which catalogs the
 * 12 archived engineering simulations. Given as a new, separate route
 * rather than colliding with that existing panel's exact title in the
 * same view; the two "Robot Library" labels coexisting across two
 * different pages is a real naming tension this phase did not resolve,
 * flagged here for a future decision rather than pretending it's settled.
 */
export default function RobotLibraryPage() {
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  return (
    <FeaturePage
      pageLabel="Robot Library"
      pageSubtitle="Engineering Asset Catalog — Recovered Simulations"
      left={<RobotLibraryBrowse activeId={selectedId} onSelect={setSelectedId} />}
      center={<RobotLibraryDetail selectedId={selectedId} />}
      right={<RobotLibraryInspector selectedId={selectedId} />}
    />
  );
}
