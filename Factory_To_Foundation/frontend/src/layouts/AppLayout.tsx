import type { ReactNode } from "react";

import Sidebar from "../components/layout/Sidebar";

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
 */
function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--ff-content-bg)]">
      <Sidebar />

      <div className="min-w-0 flex-1">
        {children}
      </div>
    </div>
  );
}

export default AppLayout;
