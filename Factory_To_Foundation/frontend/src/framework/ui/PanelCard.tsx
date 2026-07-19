import type { ReactNode } from "react";
import "./PanelCard.css";

type PanelCardProps = {
  /** Rendered in the header row, uppercased via CSS — pass normal case. Omit entirely to render no header row at all. */
  title?: string;
  /** Optional controls rendered alongside the title (e.g. a small action button). */
  toolbar?: ReactNode;
  children: ReactNode;
  /** Extra classes on the outer card — typically a height, e.g. "h-[560px]". */
  className?: string;
  /**
   * Classes for the body wrapper. Defaults to a padded, scrollable area —
   * override for content that manages its own scrolling/clipping, like a
   * camera-driven Viewport, which needs a bare `flex-1 relative` instead.
   */
  bodyClassName?: string;
};

const DEFAULT_BODY_CLASS = "ff-panel-card-body flex-1 overflow-auto";

/**
 * Shared panel shell — a flat docked panel (thin border, minimal
 * radius, no shadow), not a floating SaaS card. This is the one panel
 * wrapper every left/center/right panel across every feature renders
 * through — no feature-specific logic lives here.
 */
export default function PanelCard({
  title,
  toolbar,
  children,
  className,
  bodyClassName,
}: PanelCardProps) {
  return (
    <div
      className={`ff-panel-card flex flex-col${className ? ` ${className}` : ""}`}
    >
      {title && (
        <div className="ff-panel-card-header flex items-center justify-between">
          <h3 className="ff-panel-card-title">
            {title}
          </h3>

          {toolbar}
        </div>
      )}

      <div className={bodyClassName ?? DEFAULT_BODY_CLASS}>
        {children}
      </div>
    </div>
  );
}
