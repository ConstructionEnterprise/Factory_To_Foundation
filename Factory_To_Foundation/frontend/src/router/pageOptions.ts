/**
 * Real path/label pairs for every routed page — deliberately a standalone,
 * dependency-free module, NOT re-exported from routes.tsx's own
 * `appRoutes`. Real bug found live: `SettingsMenu.tsx` originally imported
 * `appRoutes` directly from `router/routes`, which transitively imports
 * every page component, several of which import `framework/ui`'s barrel
 * file — which now also exports `SettingsMenu` itself. That's a genuine
 * circular import (`routes.tsx` -> pages -> `framework/ui` -> `SettingsMenu`
 * -> `routes.tsx`), and it surfaced immediately on load as
 * `ReferenceError: Cannot access 'appRoutes' before initialization`, not a
 * hypothetical risk. This file has zero imports of its own, so anything
 * that only needs the path/label list (Settings' page pickers) can't
 * re-trigger the same cycle. Kept in sync with `routes.tsx` by hand — a
 * small, stable, explicitly disclosed duplication, not an oversight.
 */
export const PAGE_OPTIONS: { path: string; label: string }[] = [
  { path: "/manufacturing", label: "Manufacturing" },
  { path: "/factory", label: "Factory" },
  { path: "/robotics", label: "Robotics" },
  { path: "/logistics", label: "Logistics" },
  { path: "/construction", label: "Construction" },
  { path: "/", label: "Genealogy" },
  { path: "/scheduling", label: "Scheduling" },
  { path: "/permissions", label: "Permissions" },
  { path: "/networking", label: "Networking" },
  { path: "/assets", label: "Assets" },
  { path: "/analytics", label: "Analytics" },
  { path: "/reports", label: "Reports" },
  { path: "/administration", label: "Administration" },
];
