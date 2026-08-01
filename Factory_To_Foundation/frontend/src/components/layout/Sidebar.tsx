import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronLeft, ChevronRight, Menu, X } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useViewportTier } from "@/framework/ui";
import { appRoutes } from "@/router/routes";

const STORAGE_KEY = "sidebar-collapsed";
const ACCENT = "var(--ff-accent)";

function readStoredCollapsed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function Sidebar() {
  const [collapsed, setCollapsed] = useState(readStoredCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { hasPermission } = useAuth();
  const tier = useViewportTier();
  const location = useLocation();

  // Phase 3c — a nav entry for a route the current role has no access to
  // (Administration, for a role without administration:read) is just
  // noise/false-advertising; filtered here rather than shown then blocked.
  const visibleRoutes = appRoutes.filter(
    (route) => !route.requiredPermission || hasPermission(route.requiredPermission.module, route.requiredPermission.action)
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      // Nothing to do — collapse state just won't persist this session.
    }
  }, [collapsed]);

  // A real navigation (tap a route in the drawer) should close the drawer
  // behind it - the drawer is a transient overlay, not a persistent panel.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const navList = (onNavigate?: () => void, iconOnly = false): ReactNode => (
    <nav
      className={`mt-10 flex-1 space-y-1 overflow-y-auto ${
        iconOnly ? "flex flex-col items-center" : ""
      }`}
    >
      {visibleRoutes.map((route) => {
        const Icon = route.icon;

        return (
          <NavLink
            key={route.path}
            to={route.path}
            end={route.path === "/"}
            title={route.label}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-[0.25rem] px-3 py-2.5 text-sm transition hover:bg-slate-800 ${
                isActive
                  ? "bg-slate-800 font-semibold"
                  : "text-slate-300 hover:text-slate-100"
              }`
            }
            style={({ isActive }) => (isActive ? { color: ACCENT } : undefined)}
          >
            <Icon size={17} strokeWidth={2} className="shrink-0" />
            {!iconOnly && <span>{route.label}</span>}
          </NavLink>
        );
      })}
    </nav>
  );

  if (tier === "mobile") {
    return (
      <>
        <header className="flex h-14 shrink-0 items-center gap-3 bg-slate-900 px-4 text-white">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            title="Open navigation"
            aria-label="Open navigation"
            className="flex h-11 w-11 items-center justify-center rounded-[0.25rem] text-slate-200 transition hover:bg-slate-800"
          >
            <Menu size={22} />
          </button>

          <h1 className="text-base font-bold" style={{ color: ACCENT }}>
            Factory » Foundation
          </h1>
        </header>

        {drawerOpen && (
          <>
            <div
              className="fixed inset-0 z-50 bg-black/50"
              onClick={() => setDrawerOpen(false)}
            />

            <aside className="fixed inset-y-0 left-0 z-[60] flex w-72 max-w-[85vw] flex-col bg-slate-900 p-6 text-white shadow-xl">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-xl font-bold" style={{ color: ACCENT }}>
                    Factory » Foundation
                  </h1>

                  <p className="mt-1.5 text-xs text-slate-400">
                    Construction Enterprise OS
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  title="Close navigation"
                  aria-label="Close navigation"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.25rem] text-slate-300 transition hover:bg-slate-800"
                >
                  <X size={20} />
                </button>
              </div>

              {navList(() => setDrawerOpen(false))}
            </aside>
          </>
        )}
      </>
    );
  }

  return (
    <aside
      className={`flex h-full flex-col bg-slate-900 text-white transition-all duration-200 ${
        collapsed ? "w-20 px-2 py-6" : "w-64 p-6"
      }`}
    >

      {collapsed ? (
        <span className="block text-center text-lg font-bold" style={{ color: ACCENT }}>
          FF
        </span>
      ) : (
        <div>
          <h1 className="text-xl font-bold" style={{ color: ACCENT }}>
            Factory » Foundation
          </h1>

          <p className="mt-1.5 text-xs text-slate-400">
            Construction Enterprise OS
          </p>
        </div>
      )}

      {navList(undefined, collapsed)}

      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="mt-4 flex items-center justify-center rounded-[0.25rem] py-2 text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

    </aside>
  );
}

export default Sidebar;
