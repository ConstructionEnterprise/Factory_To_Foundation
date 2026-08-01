import { useEffect, useState } from "react";

export type ViewportTier = "mobile" | "tablet" | "desktop";

// Matches Tailwind v4's own default breakpoint scale (untouched in this
// project - no custom @theme override in index.css), so there is exactly
// one source of truth for "mobile"/"tablet"/"desktop": Tailwind's md/xl
// utility variants in CSS, and this hook in JS. Never redefine these
// numbers elsewhere - components that need viewport-driven *logic* (not
// just styling) should read this hook; anything that's pure CSS reflow
// should use `md:`/`xl:` directly instead of this hook.
const TABLET_MIN = 768;
const DESKTOP_MIN = 1280;

function tierFromWidth(width: number): ViewportTier {
  if (width >= DESKTOP_MIN) return "desktop";
  if (width >= TABLET_MIN) return "tablet";
  return "mobile";
}

/**
 * Real viewport-tier detection for the handful of components that must
 * branch on structure/behavior, not just CSS (Sidebar's drawer swap,
 * Workspace's stacked/tabbed choice) - most responsive work should not
 * need this at all and should reach for Tailwind's `md:`/`xl:` variants
 * directly. Backed by `matchMedia` listeners (not a resize-event poll),
 * so it only re-renders on an actual tier change, not every pixel of a
 * drag-resize.
 */
export function useViewportTier(): ViewportTier {
  const [tier, setTier] = useState<ViewportTier>(() =>
    typeof window === "undefined" ? "desktop" : tierFromWidth(window.innerWidth)
  );

  useEffect(() => {
    const tabletQuery = window.matchMedia(`(min-width: ${TABLET_MIN}px)`);
    const desktopQuery = window.matchMedia(`(min-width: ${DESKTOP_MIN}px)`);

    const update = () => setTier(tierFromWidth(window.innerWidth));

    update();
    tabletQuery.addEventListener("change", update);
    desktopQuery.addEventListener("change", update);

    return () => {
      tabletQuery.removeEventListener("change", update);
      desktopQuery.removeEventListener("change", update);
    };
  }, []);

  return tier;
}
