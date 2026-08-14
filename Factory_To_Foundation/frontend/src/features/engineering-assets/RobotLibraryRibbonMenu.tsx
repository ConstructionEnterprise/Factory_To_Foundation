import { useState } from "react";

import RobotLibraryBrowse from "./RobotLibraryBrowse";
import RobotLibraryDetail from "./RobotLibraryDetail";
import RobotLibraryInspector from "./RobotLibraryInspector";

/**
 * Factory command-ribbon content for the "Robot Library" dropdown.
 *
 * Deliberately NOT a rebuild: RobotLibraryBrowse/Detail/Inspector are
 * reused completely unchanged (same components that powered the standalone
 * /robot-library page) -- only the surrounding layout changes, from
 * FeaturePage's full-width three-column Workspace to a compact flex row
 * sized to fit a CommandRibbon dropdown panel (which caps at
 * `calc(100vw - 2rem)`, not a fixed small size -- see DropdownMenu.css --
 * so there's real room for three narrow columns, just not a full page).
 *
 * The standalone /robot-library route is retired in favor of this --
 * Robot Library is now a Factory capability, not a competing top-level
 * destination, resolving the earlier /robotics-panel naming collision by
 * removing the second nav entry rather than renaming either "Robot
 * Library."
 */
export default function RobotLibraryRibbonMenu() {
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  return (
    <div className="w-[46rem] max-w-full h-[28rem] flex gap-2">
      <div className="w-[14rem] shrink-0 h-full">
        <RobotLibraryBrowse activeId={selectedId} onSelect={setSelectedId} />
      </div>
      <div className="flex-1 h-full min-w-0">
        <RobotLibraryDetail selectedId={selectedId} />
      </div>
      <div className="w-[14rem] shrink-0 h-full">
        <RobotLibraryInspector selectedId={selectedId} />
      </div>
    </div>
  );
}
