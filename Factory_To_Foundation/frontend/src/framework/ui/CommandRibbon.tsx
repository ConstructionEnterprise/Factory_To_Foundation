import { useState, type ReactNode } from "react";

import AccountMenu from "./AccountMenu";
import SettingsMenu from "./SettingsMenu";
import DropdownMenu from "./DropdownMenu";
import "./CommandRibbon.css";

/**
 * Two real ribbon-item shapes, not one: a **menu** opens a floating
 * dropdown panel (Metrics, Filters, Factory's Instructions) — the caller
 * supplies `content`. A **capability switch** is an instant toggle with no
 * panel of its own (e.g. Inventory's real Assets/Genealogy view switch,
 * Fleet as a sibling of Logistics Flow) — the caller supplies `onClick` (+
 * `active` for the pressed/current-view highlight) instead. Added
 * 2026-08-15 specifically so "capability lives in the CommandRibbon" (the
 * FF standing UI rule) doesn't force every capability through the dropdown
 * shape when the real behavior is "switch what the workspace shows,"
 * not "show me a panel of controls."
 */
export type RibbonMenu =
  | { label: string; content: ReactNode; onClick?: never; active?: never }
  | { label: string; content?: never; onClick: () => void; active?: boolean };

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
        {menus.map((menu) =>
          menu.onClick ? (
            <button
              key={menu.label}
              type="button"
              className={`command-ribbon-action${menu.active ? " command-ribbon-action--active" : ""}`}
              onClick={menu.onClick}
              aria-pressed={!!menu.active}
            >
              {menu.label}
            </button>
          ) : (
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
          )
        )}
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
