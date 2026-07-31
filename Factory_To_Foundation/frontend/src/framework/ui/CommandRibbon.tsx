import { useState, type ReactNode } from "react";

import AccountMenu from "./AccountMenu";
import SettingsMenu from "./SettingsMenu";
import DropdownMenu from "./DropdownMenu";
import "./CommandRibbon.css";

export type RibbonMenu = {
  label: string;
  content: ReactNode;
};

type CommandRibbonProps = {
  /** Shown small, far right — e.g. "Factory", "Genealogy". */
  pageLabel: string;
  /** Shown as a native tooltip on the page label, not rendered visibly. */
  pageSubtitle?: string;
  /** Dropdown-triggered menus — e.g. Metrics, Filters. */
  menus: RibbonMenu[];
};

/**
 * The single slim menu bar every FeaturePage renders through, replacing
 * the old full-height PageHeader. Menus are floating dropdowns (Blender's
 * File/Edit/Render style) — they never push the workspace down. Only one
 * menu can be open at a time, matching how a real menu bar behaves.
 */
export default function CommandRibbon({
  pageLabel,
  pageSubtitle,
  menus,
}: CommandRibbonProps) {
  const [openLabel, setOpenLabel] = useState<string | null>(null);

  return (
    <div className="command-ribbon">

      <div className="command-ribbon-menus">
        {menus.map((menu) => (
          <DropdownMenu
            key={menu.label}
            label={menu.label}
            open={openLabel === menu.label}
            onToggle={() =>
              setOpenLabel((current) =>
                current === menu.label ? null : menu.label
              )
            }
            onClose={() => setOpenLabel(null)}
          >
            {menu.content}
          </DropdownMenu>
        ))}
      </div>

      <div className="command-ribbon-right">
        <span
          className="command-ribbon-page-label"
          title={pageSubtitle}
        >
          {pageLabel}
        </span>

        <SettingsMenu />
        <AccountMenu />
      </div>

    </div>
  );
}
