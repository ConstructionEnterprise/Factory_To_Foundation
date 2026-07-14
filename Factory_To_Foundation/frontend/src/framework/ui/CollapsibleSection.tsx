import { useEffect, useState, type ReactNode } from "react";
import "./CollapsibleSection.css";

type CollapsibleSectionProps = {
  title: string;
  /** Unique localStorage key — callers should namespace per feature (e.g. "factory-metrics-collapsed") so pages don't share collapse state. */
  storageKey: string;
  defaultCollapsed?: boolean;
  children: ReactNode;
};

function readStoredCollapsed(storageKey: string, fallback: boolean): boolean {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === null) return fallback;
    return stored === "true";
  } catch {
    // localStorage unavailable (private browsing, etc.) — fall back silently.
    return fallback;
  }
}

/**
 * A titled section that expands/collapses with a smooth height animation
 * and persists its state in localStorage. Used by FeaturePage to wrap the
 * KPI row and toolbar so every feature page gets the same "reclaim
 * viewport space" behavior for free.
 */
export default function CollapsibleSection({
  title,
  storageKey,
  defaultCollapsed = false,
  children,
}: CollapsibleSectionProps) {
  const [collapsed, setCollapsed] = useState(() =>
    readStoredCollapsed(storageKey, defaultCollapsed)
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, String(collapsed));
    } catch {
      // Nothing to do — collapse state just won't persist this session.
    }
  }, [storageKey, collapsed]);

  return (
    <div className="collapsible-section">

      <button
        type="button"
        className="collapsible-section-header"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <svg
          className={`collapsible-section-chevron${
            collapsed ? "" : " collapsible-section-chevron--expanded"
          }`}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
        >
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <span className="collapsible-section-title">{title}</span>
      </button>

      <div
        className={`collapsible-section-body${
          collapsed ? "" : " collapsible-section-body--expanded"
        }`}
      >
        <div className="collapsible-section-body-inner">
          {children}
        </div>
      </div>

    </div>
  );
}
