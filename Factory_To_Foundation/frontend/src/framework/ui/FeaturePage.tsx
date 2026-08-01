import type { ReactNode } from "react";

import { Workspace } from "@/framework/workspace";

import CommandRibbon, { type RibbonMenu } from "./CommandRibbon";

type FeaturePageProps = {
  /** Shown small, far right of the ribbon — e.g. "Factory". */
  pageLabel: string;
  /** Native tooltip on the page label; not rendered as visible chrome. */
  pageSubtitle?: string;
  /** Rendered inside a "Metrics" dropdown, if provided. */
  kpis?: ReactNode;
  /** Rendered inside a "Filters" dropdown, if provided. */
  toolbar?: ReactNode;
  /**
   * Additional page-specific ribbon dropdowns beyond the standard
   * Metrics/Filters pair, appended in order after them — e.g. Factory's
   * "Instructions" menu. The generic third-menu-type extension point
   * discussed early in the project, built only once a real consumer
   * needed it rather than speculatively.
   */
  extraMenus?: RibbonMenu[];
  /**
   * A fully custom workspace layout, for a feature whose panel shape
   * doesn't fit the shared three-panel `Workspace` (e.g. Factory's Gantt
   * chart pass added a fourth, spanning panel — see
   * `features/factory/FactoryWorkspace.tsx`). When provided, this renders
   * instead of `left`/`center`/`right` entirely — supply either this OR
   * the three-panel props, never both. Additive extension point, same
   * pattern as `extraMenus`: `Workspace` itself stays untouched, only a
   * real second shape earned this override.
   */
  workspace?: ReactNode;
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
};

/**
 * The shared page shell every feature renders through:
 *   command ribbon (dropdown menus + page identity) / three-panel workspace.
 *
 * Metrics and Filters are floating dropdowns rather than inline blocks —
 * they never push the workspace down, so the viewport gets the space
 * back regardless of whether either menu has ever been opened.
 */
export default function FeaturePage({
  pageLabel,
  pageSubtitle,
  kpis,
  toolbar,
  extraMenus,
  workspace,
  left,
  center,
  right,
}: FeaturePageProps) {
  const menus: RibbonMenu[] = [];

  if (kpis) menus.push({ label: "Metrics", content: kpis });
  if (toolbar) menus.push({ label: "Filters", content: toolbar });
  if (extraMenus) menus.push(...extraMenus);

  return (
    <div className="flex flex-col h-full bg-[var(--ff-content-bg)]">
      <CommandRibbon
        pageLabel={pageLabel}
        pageSubtitle={pageSubtitle}
        menus={menus}
      />

      <main className="flex-1 overflow-auto p-2 md:p-4 xl:p-8">
        <div className="h-full">
          {workspace ?? <Workspace left={left} center={center} right={right} />}
        </div>
      </main>
    </div>
  );
}
