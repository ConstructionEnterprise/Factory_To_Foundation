import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
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
  const { hasPermission } = useAuth();
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

      <nav
        className={`mt-10 flex-1 space-y-1 overflow-y-auto ${
          collapsed ? "flex flex-col items-center" : ""
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
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-[0.25rem] px-3 py-2 text-sm transition hover:bg-slate-800 ${
                  isActive
                    ? "bg-slate-800 font-semibold"
                    : "text-slate-300 hover:text-slate-100"
                }`
              }
              style={({ isActive }) => (isActive ? { color: ACCENT } : undefined)}
            >
              <Icon size={17} strokeWidth={2} className="shrink-0" />
              {!collapsed && <span>{route.label}</span>}
            </NavLink>
          );
        })}
      </nav>

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
