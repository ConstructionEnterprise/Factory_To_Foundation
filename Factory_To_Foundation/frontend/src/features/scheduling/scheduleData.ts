/**
 * Real owning module for a stage — was a free-text `ownedBy: string`
 * (confirmed live values: "Logistics", "Factory", "Construction", "Not yet
 * built") until the enterprise-migration Phase 1 schema investigation
 * flagged it as unenforced: nothing stopped it drifting from an actual
 * module id, and it couldn't back a real per-stage RBAC grant (a
 * Superintendent owning Construction Schedule specifically, not the other
 * 4 stages). Typed as a real closed union of the app's actual module ids so
 * it can become a real FK once the SQL migration lands, without another
 * rework. `null` is the real, honest "no owner yet" state (Inbound
 * Material — CLAUDE.md gap #2) — never a string like "Not yet built"
 * standing in for an actual absence.
 *
 * The real 5-stage/port/wire pipeline fixture that used to live here
 * (`scheduleNodes`/`scheduleWires`/`schedules`/`getScheduleBounds`/
 * `getPortOffsetY`) was retired Phase 2.3 (2026-08-16,
 * docs/decisions/2026-08-16-scheduling-phase2.3-frontend-wiring-plan.md)
 * once `Schedule`/`ScheduleStage` became real backend entities --
 * `ScheduleBrowse`/`ScheduleLayout` now read `scheduleApi.ts` instead.
 * `OwningModule`/`OWNING_MODULE_LABEL` stay here since
 * `ScheduleInspector.tsx`'s real `SchedulePayload` shape still uses them.
 */
export type OwningModule = "logistics" | "factory" | "construction";

/** Display label per real owning module — one lookup, so display text can't drift from the module id itself. */
export const OWNING_MODULE_LABEL: Record<OwningModule, string> = {
  logistics: "Logistics",
  factory: "Factory",
  construction: "Construction",
};
