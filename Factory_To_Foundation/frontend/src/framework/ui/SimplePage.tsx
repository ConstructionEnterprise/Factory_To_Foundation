import type { ReactNode } from "react";

import CommandRibbon, { type RibbonMenu } from "./CommandRibbon";

type SimplePageProps = {
  /** Shown small, far right of the ribbon — e.g. "Analytics". */
  pageLabel: string;
  /** Native tooltip on the page label; not rendered as visible chrome. */
  pageSubtitle?: string;
  /** Optional ribbon dropdowns, same mechanism FeaturePage uses — most SimplePage consumers won't need any. */
  menus?: RibbonMenu[];
  children: ReactNode;
};

/**
 * Shared shell for pages that don't fit FeaturePage's Browse/Viewport/
 * Selected Workspace shape — Analytics, Reports, and Administration all
 * need the same "ribbon + free content area" instead, a real
 * three-consumer signal to build once rather than duplicate three times.
 * Renders the same CommandRibbon every real feature uses, for visual
 * consistency — not a reversion to the old PageHeader/ComingSoonPage look.
 */
export default function SimplePage({ pageLabel, pageSubtitle, menus, children }: SimplePageProps) {
  return (
    <div className="flex flex-col h-full bg-[var(--ff-content-bg)]">
      <CommandRibbon pageLabel={pageLabel} pageSubtitle={pageSubtitle} menus={menus ?? []} />

      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
