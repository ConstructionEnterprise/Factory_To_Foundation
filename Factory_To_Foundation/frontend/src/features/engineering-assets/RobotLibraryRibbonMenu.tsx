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
 *
 * Resizable, not just a fixed dropdown: the outer box uses the native CSS
 * `resize: both` (Tailwind's `resize` utility) rather than a custom drag
 * library -- the browser already draws the standard diagonal handle at the
 * bottom-right corner for free. DropdownMenu.css's `.dropdown-menu-panel`
 * has no fixed width/height of its own (it wraps its content, capped only
 * at `calc(100vw - 2rem)`), so it grows/shrinks naturally as this box is
 * dragged, without needing any change there. Browse and Inspector keep
 * fixed widths; Detail (center) is the flexible column, so dragging wider
 * gives the engineering-detail read more room first, matching what a
 * larger inspection session would actually want more of.
 */
export default function RobotLibraryRibbonMenu() {
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  return (
    <div
      className="resize overflow-auto"
      style={{
        width: "46rem",
        height: "28rem",
        minWidth: "32rem",
        minHeight: "18rem",
        maxWidth: "min(90vw, 80rem)",
        maxHeight: "min(85vh, 60rem)",
      }}
    >
      <div className="flex gap-2 h-full min-w-[30rem] min-h-[16rem]">
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
    </div>
  );
}
