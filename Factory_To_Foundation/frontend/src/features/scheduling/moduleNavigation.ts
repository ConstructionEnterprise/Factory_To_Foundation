/**
 * Real Digital Twin Integration cross-nav (A7) — "click a task to open twin
 * work cell / robots / genealogy / analytics / equipment / QA" is really
 * "click a task to open whatever real module owns it," generalized rather
 * than hardcoded to those 6 named examples: a ScheduleTask's real
 * `ownedByModuleId` already references the exact same 12-row Module table
 * every RBAC grant already uses (Phase 1), so this is a real, existing
 * join key, not new data. "Equipment" maps to the real Assets module,
 * "QA" to Analytics (which already carries the real Quality Control
 * widget, A5) — this app has no separate QA module/page of its own.
 *
 * Deliberately a standalone module with zero imports of its own — same
 * "avoid re-triggering the router.tsx circular-import bug found in Phase 2"
 * discipline as router/pageOptions.ts.
 */
const MODULE_ID_TO_PATH: Record<string, string> = {
  manufacturing: "/manufacturing",
  factory: "/factory",
  robotics: "/robotics",
  logistics: "/logistics",
  construction: "/construction",
  genealogy: "/",
  scheduling: "/scheduling",
  permissions: "/permissions",
  networking: "/networking",
  assets: "/assets",
  analytics: "/analytics",
  reports: "/reports",
  administration: "/administration",
};

/** Real path for a real module id, or undefined if the id isn't one of the real 13 (or the task has no owner yet). */
export function pathForModuleId(moduleId: string | null): string | undefined {
  if (!moduleId) return undefined;
  return MODULE_ID_TO_PATH[moduleId];
}

/**
 * Real module id/label pairs for a task-creation form's owner picker — same
 * 13 real ids the RBAC seed uses, not invented. "networking" is the real
 * factory IT/OT infrastructure module (Permissions Migration + Real
 * Networking Module build) — before that build, this same id/path referred
 * to what's now the "permissions" module below; the identifier now
 * genuinely means networking.
 */
export const MODULE_OPTIONS: { id: string; label: string }[] = [
  { id: "manufacturing", label: "Manufacturing" },
  { id: "factory", label: "Factory" },
  { id: "robotics", label: "Robotics" },
  { id: "logistics", label: "Logistics" },
  { id: "construction", label: "Construction" },
  { id: "genealogy", label: "Genealogy" },
  { id: "scheduling", label: "Scheduling" },
  { id: "permissions", label: "Permissions" },
  { id: "networking", label: "Networking" },
  { id: "assets", label: "Assets" },
  { id: "analytics", label: "Analytics" },
  { id: "reports", label: "Reports" },
  { id: "administration", label: "Administration" },
];
