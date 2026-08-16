/**
 * Real, one-time backfill for Phase 3.1 of the 2026-08-16 Analytics
 * Observability rollout (docs/decisions/
 * 2026-08-16-analytics-observability-phase3-plan.md §3.2). Creates exactly
 * one real `AnalyticsDashboard` (title "Default", isDefault=true)
 * reproducing today's exact `AnalyticsDashboard.tsx` JSX order as real
 * `AnalyticsDashboardWidget` rows -- 12 as `existing_summary` (every
 * current widget except Events) plus `EventsWidget` itself as a real
 * `events_feed` row. Upgrading to Phase 3 must render an identical page to
 * today until a user actually edits something -- no visual regression, no
 * fabricated widget content.
 *
 * Idempotent: if a real isDefault=true row already exists, this is a
 * no-op (reports and exits), never a duplicate.
 *
 * Attribution: real dashboards need a real `createdById`. There is no
 * "user who triggered this" at migration time (unlike a request-scoped
 * write), so this attributes authorship to the real CEO-role user (the
 * full-access account already used for system-level setup throughout
 * this rollout) rather than fabricating a placeholder. Fails loudly if no
 * such real user exists -- never invents one.
 *
 *   npx tsx scripts/backfill-default-analytics-dashboard.ts
 */
import { prisma } from "../src/lib/prisma";

// Matches AnalyticsDashboard.tsx's current JSX order exactly (lines
// 683-695). EventsWidget is the one entry using widgetType "events_feed"
// per §3.2/§5 of the plan doc; every other entry is "existing_summary".
const DEFAULT_WIDGETS: { summaryWidgetKey: string | null; isEvents?: true }[] = [
  { summaryWidgetKey: "factory" },
  { summaryWidgetKey: "genealogy" },
  { summaryWidgetKey: "manufacturing" },
  { summaryWidgetKey: "construction" },
  { summaryWidgetKey: "costEstimating" },
  { summaryWidgetKey: "scheduling" },
  { summaryWidgetKey: "assets" },
  { summaryWidgetKey: null, isEvents: true },
  { summaryWidgetKey: "productionOutput" },
  { summaryWidgetKey: "workCellPerformance" },
  { summaryWidgetKey: "scheduleCriticalPath" },
  { summaryWidgetKey: "digitalTwinLifecycle" },
  { summaryWidgetKey: "qualityControl" },
];

async function main() {
  console.log("=== BEFORE ===");
  const beforeDefaultCount = await prisma.analyticsDashboard.count({ where: { isDefault: true } });
  console.log(`analytics_dashboard(isDefault=true): ${beforeDefaultCount} existing`);

  if (beforeDefaultCount > 0) {
    console.log("A real default dashboard already exists -- idempotent no-op, nothing to do.");
    return;
  }

  const ceoUser = await prisma.user.findFirst({ where: { role: { name: "CEO" } }, select: { id: true, email: true } });
  if (!ceoUser) {
    throw new Error("No real user with role CEO exists -- refusing to fabricate an author for the default dashboard. STOP.");
  }
  console.log(`Attributing authorship to real user ${ceoUser.email} (role CEO).`);

  const dashboard = await prisma.analyticsDashboard.create({
    data: { title: "Default", isDefault: true, createdById: ceoUser.id },
  });

  for (let i = 0; i < DEFAULT_WIDGETS.length; i += 1) {
    const w = DEFAULT_WIDGETS[i];
    await prisma.analyticsDashboardWidget.create({
      data: {
        dashboardId: dashboard.id,
        widgetType: w.isEvents ? "events_feed" : "existing_summary",
        summaryWidgetKey: w.summaryWidgetKey,
        position: i,
      },
    });
  }

  console.log(`Created real default dashboard "${dashboard.title}" (${dashboard.id}) with ${DEFAULT_WIDGETS.length} real widgets.`);

  console.log("=== AFTER ===");
  const afterWidgetCount = await prisma.analyticsDashboardWidget.count({ where: { dashboardId: dashboard.id } });
  console.log(`analytics_dashboard_widget(dashboardId=${dashboard.id}): ${afterWidgetCount} rows`);

  if (afterWidgetCount !== DEFAULT_WIDGETS.length) {
    throw new Error(`Real count mismatch: expected ${DEFAULT_WIDGETS.length} widget rows, found ${afterWidgetCount}. STOP.`);
  }

  console.log("DONE. Real default dashboard created, counts verified exact.");
}

main()
  .catch((err) => {
    console.error("FAILED:", err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
