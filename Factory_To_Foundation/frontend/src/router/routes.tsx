import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import {
  BarChart3,
  Bot,
  Calendar,
  Factory as FactoryIcon,
  FileText,
  HardHat,
  Network,
  Package,
  ShieldCheck,
  Truck,
  Cog,
} from "lucide-react";

import Dashboard from "@/pages/dashboard/Dashboard";
import FactoryPage from "@/pages/factory/FactoryPage";
import RoboticsPage from "@/pages/robotics/RoboticsPage";
import LogisticsPage from "@/pages/logistics/LogisticsPage";
import ConstructionPage from "@/pages/construction/ConstructionPage";
import ManufacturingPage from "@/pages/manufacturing/ManufacturingPage";
import SchedulingPage from "@/pages/scheduling/SchedulingPage";
import AssetsPage from "@/pages/assets/AssetsPage";
import ComingSoonPage from "@/pages/ComingSoonPage";

export type AppRoute = {
  path: string;
  label: string;
  icon: ComponentType<LucideProps>;
  element: ReactNode;
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
 * Scheduling, and Assets are built. Analytics, Administration, and
 * Reports remain ComingSoonPage — their original spec has no viewport
 * (dashboard/settings/document-library shapes, not spatial object
 * browsing), so they're deliberately not forced into the Browse/
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
  },
  {
    path: "/scheduling",
    label: "Scheduling",
    icon: Calendar,
    element: <SchedulingPage />,
  },
  {
    path: "/administration",
    label: "Administration",
    icon: ShieldCheck,
    element: (
      <ComingSoonPage
        title="Administration"
        subtitle="Enterprise Administration"
      />
    ),
  },
  {
    path: "/analytics",
    label: "Analytics",
    icon: BarChart3,
    element: (
      <ComingSoonPage title="Analytics" subtitle="Business Intelligence" />
    ),
  },
  {
    path: "/assets",
    label: "Assets",
    icon: Package,
    element: <AssetsPage />,
  },
  {
    path: "/reports",
    label: "Reports",
    icon: FileText,
    element: (
      <ComingSoonPage title="Reports" subtitle="Enterprise Reporting" />
    ),
  },
];
