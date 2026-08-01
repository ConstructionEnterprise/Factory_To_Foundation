import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";

import Sidebar from "../components/layout/Sidebar";
import { ErrorBoundary } from "../framework/ui";

type AppLayoutProps = {
  children: ReactNode;
};

/**
 * The app shell: Sidebar + content area, locked to exactly the viewport
 * height (not min-h-screen, which lets the shell grow past 100vh with
 * tall content). That's what guarantees Sidebar's background always
 * reaches the bottom of the screen regardless of content height or
 * collapsed/expanded state — h-full only resolves correctly against a
 * definite ancestor height, and min-height doesn't count as one.
 *
 * The content area is a plain div, not a second <main> — each page
 * (FeaturePage, ComingSoonPage) owns its own <main> and its own
 * internal scrolling; this shell never scrolls itself.
 *
 * `flex-col md:flex-row`: below 768px, Sidebar renders as a thin
 * full-width top bar (hamburger + title) with its real nav living in an
 * overlay drawer (fixed positioning, so it's unaffected by this
 * direction), so the shell itself must stack vertically for that bar to
 * sit above content rather than beside it as a squeezed column. At
 * md and up, Sidebar renders its normal docked rail and the shell goes
 * back to a horizontal split.
 *
 * `ErrorBoundary`, keyed on the real route path — this app had zero
 * error boundaries anywhere before this (a real gap, not a stylistic
 * choice: an uncaught render error on any single page silently blanked
 * the entire app, sidebar included, with no visible message at all).
 * Keying on `location.pathname` forces a fresh mount on navigation, so
 * a crash on one page doesn't leave a stale error showing after
 * navigating to a different, working page.
 */
function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--ff-content-bg)] md:flex-row">
      <Sidebar />

      <div className="min-w-0 min-h-0 flex-1">
        <ErrorBoundary key={location.pathname}>{children}</ErrorBoundary>
      </div>
    </div>
  );
}

export default AppLayout;
