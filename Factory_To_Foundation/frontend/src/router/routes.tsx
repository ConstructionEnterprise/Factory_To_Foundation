import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import {
  BarChart3,
  Boxes,
  Bot,
  Calendar,
  Factory as FactoryIcon,
  FileText,
  HardHat,
  Network,
  Package,
  ShieldCheck,
  Lock,
  Truck,
  Cog,
  Wifi,
} from "lucide-react";

import Dashboard from "@/pages/dashboard/Dashboard";
import FactoryPage from "@/pages/factory/FactoryPage";
import RoboticsPage from "@/pages/robotics/RoboticsPage";
import LogisticsPage from "@/pages/logistics/LogisticsPage";
import ConstructionPage from "@/pages/construction/ConstructionPage";
import ManufacturingPage from "@/pages/manufacturing/ManufacturingPage";
import SchedulingPage from "@/pages/scheduling/SchedulingPage";
import AssetsPage from "@/pages/assets/AssetsPage";
import InventoryPage from "@/pages/inventory/InventoryPage";
import AnalyticsPage from "@/pages/analytics/AnalyticsPage";
import AdministrationPage from "@/pages/administration/AdministrationPage";
import ReportsPage from "@/pages/reports/ReportsPage";
import NetworkingPage from "@/pages/networking/NetworkingPage";
import PermissionsPage from "@/pages/permissions/PermissionsPage";
// ComingSoonPage (src/pages/ComingSoonPage.tsx) is no longer used by any
// route now that Analytics/Administration/Reports are real pages — left
// on disk, not deleted, for whatever feature is unbuilt next.

export type AppRoute = {
  path: string;
  label: string;
  icon: ComponentType<LucideProps>;
  element: ReactNode;
  /**
   * Phase 3c — route-level gating, used only where per-control gating
   * can't express the real requirement (Administration currently has no
   * write controls of its own, so there's nothing to disable — hiding the
   * nav entry and blocking direct navigation is the only way to honor a
   * role with no `administration:read` grant). UX/honesty layer only, same
   * as every other Phase 3c gate — nothing else in this app enforces this
   * route-level restriction server-side.
   */
  requiredPermission?: { module: string; action: string };
  /**
   * Real, deliberate hide (2026-08-15, Inventory rollout) -- Assets and
   * Genealogy are now reachable as Inventory's own ribbon capability
   * switches (InventoryPage.tsx), so their standalone sidebar entries are
   * redundant. The routes/pages/components themselves stay fully live and
   * untouched (Inventory renders the exact same AssetsBrowse/AssetsMap/
   * AssetsInspector and GenealogyBrowser/RelationshipGraph/SelectedObject
   * components directly) -- this only hides the nav entry, same
   * requiredPermission-driven filter pattern in Sidebar.tsx, not a route
   * retirement. `/` still needs its own route regardless of sidebar
   * visibility: it's StartupRedirect's structural default landing page.
   */
  hideFromSidebar?: boolean;
};

/**
 * Single source of truth for navigation: both the router (App.tsx) and
 * the sidebar read this list, so a new route always shows up in nav and
 * a nav item never points at a route that doesn't exist. The icon is
 * what the sidebar falls back to when collapsed to an icon rail.
 *
 * Order is deliberate (operations-first: Manufacturing/Factory/Robotics/
 * Logistics/Construction ahead of Genealogy), not alphabetical or build
 * order.
 *
 * Manufacturing, Factory, Robotics, Logistics, Construction, Genealogy,
 * Scheduling, and Assets are built on FeaturePage's Browse/Viewport/
 * Selected Workspace shape. Analytics, Administration, and Reports are
 * also built now, but on SimplePage instead — their original spec has no
 * viewport (dashboard/settings/document-library shapes, not spatial
 * object browsing), so they're deliberately not forced into the Browse/
 * Viewport/Selected pattern the others share.
 */
export const appRoutes: AppRoute[] = [
  {
    path: "/manufacturing",
    label: "Manufacturing",
    icon: Cog,
    element: <ManufacturingPage />,
  },
  {
    path: "/factory",
    label: "Factory",
    icon: FactoryIcon,
    element: <FactoryPage />,
  },
  {
    path: "/robotics",
    label: "Robotics",
    icon: Bot,
    element: <RoboticsPage />,
  },
  {
    path: "/logistics",
    label: "Logistics",
    icon: Truck,
    element: <LogisticsPage />,
  },
  {
    path: "/construction",
    label: "Construction",
    icon: HardHat,
    element: <ConstructionPage />,
  },
  {
    path: "/",
    label: "Genealogy",
    icon: Network,
    element: <Dashboard />,
    hideFromSidebar: true,
  },
  {
    path: "/scheduling",
    label: "Scheduling",
    icon: Calendar,
    element: <SchedulingPage />,
  },
  {
    path: "/assets",
    label: "Assets",
    icon: Package,
    element: <AssetsPage />,
    hideFromSidebar: true,
  },
  {
    path: "/inventory",
    label: "Inventory",
    icon: Boxes,
    element: <InventoryPage />,
    // Real, separate domain (Phase 2, 2026-08-15) -- the shared identity
    // layer over Asset/GenealogyNode. As of 2026-08-15, Inventory is the
    // sidebar's own entry point for both (via its ribbon capability
    // switches) -- /assets and Genealogy's "/" route stay fully live for
    // direct links/bookmarks but are hidden from the sidebar itself
    // (hideFromSidebar above). See
    // docs/decisions/2026-08-15-inventory-fleet-analytics-reports-plan.md.
    // Ordered above Networking (2026-08-18, explicit instruction).
  },
  {
    path: "/networking",
    label: "Networking",
    icon: Wifi,
    element: <NetworkingPage />,
    // Real, genuinely distinct module (Permissions Migration + Real
    // Networking Module build) — factory IT/OT network infrastructure,
    // sourced from the real Cisco Packet Tracer diagram
    // CE_Factory_Production_LAN. Read-only, so nothing per-control to gate
    // beyond this route-level read check.
    requiredPermission: { module: "networking", action: "read" },
  },
  {
    path: "/analytics",
    label: "Analytics",
    icon: BarChart3,
    element: <AnalyticsPage />,
  },
  {
    path: "/reports",
    label: "Reports",
    icon: FileText,
    element: <ReportsPage />,
  },
  {
    path: "/permissions",
    label: "Permissions",
    icon: Lock,
    element: <PermissionsPage />,
    // A3 — Roles & Permissions/User Management are real RBAC administration
    // (renamed from Networking in the Permissions Migration — this route
    // used to live at /networking under module id "networking"; both the
    // route and the module id were renamed together, atomically, with the
    // real role_permission rows repointed in the same migration). Same
    // route-level gating precedent as Administration below (nothing
    // per-control to hide/disable on this page's own read view; the write
    // controls inside User Management are separately gated per-action too).
    // Ordered directly above Administration (2026-08-18) — Payroll accounts
    // are created from the real User profiles this page manages, so the two
    // pages are read in sequence in the sidebar.
    requiredPermission: { module: "permissions", action: "read" },
  },
  {
    path: "/administration",
    label: "Administration",
    icon: ShieldCheck,
    element: <AdministrationPage />,
    requiredPermission: { module: "administration", action: "read" },
  },
];
