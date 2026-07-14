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
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
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
  left,
  center,
  right,
}: FeaturePageProps) {
  const menus: RibbonMenu[] = [];

  if (kpis) menus.push({ label: "Metrics", content: kpis });
  if (toolbar) menus.push({ label: "Filters", content: toolbar });

  return (
    <div className="flex flex-col h-full bg-[var(--ff-content-bg)]">
      <CommandRibbon
        pageLabel={pageLabel}
        pageSubtitle={pageSubtitle}
        menus={menus}
      />

      <main className="flex-1 overflow-auto p-8">
        <div className="h-[900px]">
          <Workspace left={left} center={center} right={right} />
        </div>
      </main>
    </div>
  );
}
