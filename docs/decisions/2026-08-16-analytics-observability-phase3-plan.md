# Analytics Observability — Phase 3 Implementation Plan

**Status:** Scoped, not started. Requires its own explicit go-ahead before
any schema/backend/frontend work begins, same discipline as Phase 2.

This is the CloudWatch-style Analytics transformation flagged as Phase 3 in
§9 of `docs/decisions/2026-08-16-construction-data-map-cost-estimating-plan.md`.
That doc recommended the minimal "honest slice" (no library, no alarms, no
multi-dashboard system) given real data volume was small. Joshua's explicit
call this pass was the opposite on all three open questions — build the
real charting library, the real threshold/alarm model, and the real
configurable multi-dashboard system. This doc scopes that larger version
properly rather than assuming defaults.

## 0. Real state, confirmed before scoping

- **No charting library exists anywhere in `frontend/package.json`** —
  confirmed via direct grep (recharts/chart.js/d3/victory/visx/nivo/
  apexcharts/highcharts all absent).
- **Real audit-trail row counts in sandbox today** (queried live via the
  real `prisma` client, not estimated): `LogisticsCustodyEvent` 14,
  `ScheduleTaskStatusEvent` 39, `InstructionExecution` 0,
  `ModuleSequenceEvent` 6 — 59 real rows total across every domain's real
  time-series data, spanning the ~5 days since this rollout began. This
  confirms §9's "small data volume" concern was accurate, not
  speculative — the time-range selector (§3.3) will legitimately show
  empty buckets at sub-day granularity today. That's an honest empty
  state, not a reason to fabricate density.
- **`analytics` RBAC module already exists** (`backend/prisma/seed.ts:37`),
  currently granted read-only (`R`) to every seeded role, never
  create/update/delete. Phase 3 needs write actions on it (§2.4).
- **React 19.2 / Vite 8** — current frontend stack, relevant to charting
  library compatibility (§1).

## 1. Charting library: Recharts

Recommended and assumed for the rest of this plan (Joshua's answer was
"adopt a real library," not a specific pick — this is my call, disclosed
here rather than silently assumed).

**Why Recharts over D3/Victory/Nivo/Chart.js:** composable React
components (`<LineChart><Line/></LineChart>`, not an imperative
DOM-binding API to hand-wire), no separate canvas/DOM-reconciliation layer
to fight with React's own, accepts CSS custom properties for
stroke/fill so it can read this app's real `--ff-status-*`/`--ff-accent`
tokens directly instead of hardcoding hex, and it's the most common choice
for exactly this "several real metrics, moderate volume, React app"
shape — not over-built for a use case that Chart.js's canvas model or
D3's low-level primitives would require more hand-rolled work to match.

**Scope discipline:** one library, adopted once, used for every graph
widget. No second library for a "different" chart type later without a
real reason.

## 2. Threshold/alarm model — real, stored, live-evaluated

### 2.1 The metric catalog is fixed, not arbitrary

CloudWatch lets you graph any metric because metrics are already a
first-class, arbitrarily-defined concept in that system. FF has no such
thing — only four real time-series tables exist
(`LogisticsCustodyEvent`, `ScheduleTaskStatusEvent`, `InstructionExecution`,
`ModuleSequenceEvent`). A "define any metric" UI would let a user request
a graph of something that doesn't exist. Instead, v1 ships a **fixed,
finite metric catalog** — a real backend constant (not a database table;
the catalog itself isn't user-editable data), each entry backed by a real
query against a real table:

| `metricKey` | Real source | Shape |
|---|---|---|
| `logistics.custodyEvents.count` | `LogisticsCustodyEvent`, grouped by bucket | count/bucket |
| `scheduling.statusEvents.count` | `ScheduleTaskStatusEvent`, grouped by bucket | count/bucket |
| `factory.executions.count` | `InstructionExecution`, grouped by bucket | count/bucket |
| `factory.executions.failureRate` | `InstructionExecution`, `ok=false` / total per bucket | percent/bucket |
| `construction.moduleSequenceEvents.count` | `ModuleSequenceEvent`, grouped by bucket | count/bucket |

Adding a metric later is a code change (one new catalog entry + one new
real query), never a UI action — keeps every graphable thing traceable to
a real table.

### 2.2 Schema

```prisma
enum AlarmComparator {
  greater_than
  less_than
}

model AnalyticsThreshold {
  id            String           @id @default(cuid())
  metricKey     String           @unique @map("metric_key")
  comparator    AlarmComparator
  value         Float
  windowMinutes Int              @default(60) @map("window_minutes")
  createdById   String           @map("created_by_id")
  createdBy     User             @relation(fields: [createdById], references: [id])
  createdAt     DateTime         @default(now()) @map("created_at")
  updatedAt     DateTime         @updatedAt @map("updated_at")
  @@map("analytics_threshold")
}
```

`@@unique([metricKey])` — one real threshold per metric for v1. Keeps
alarm evaluation unambiguous (no threshold-stacking/priority logic to
invent). `metricKey` is validated against the fixed catalog (§2.1) at the
service layer via a Zod enum, not left as a free string that could
reference a metric that doesn't exist.

### 2.3 Evaluation: live, not polled

No cron job, no background evaluator, no notification system. When a
metric's current windowed value is computed (on read, e.g. Analytics page
load), the service compares it against its stored threshold (if any) and
returns real `state: "ok" | "alarm" | "no_threshold"` alongside the value.
This is CloudWatch's *visual* alarm-state concept, not its *notification*
pipeline — email/Slack/webhook alerting on alarm transitions is
explicitly out of scope (§5).

### 2.4 RBAC

`analytics:read` (already granted broadly) to view threshold + state.
`analytics:create`/`analytics:update`/`analytics:delete` (currently
granted to **no** seeded role — needs a real seed change) to set/replace/
clear a threshold. Same shape as every other module's C/U/D gating in
this codebase (`costEstimates.ts`, `moduleSequences.ts`, etc.). Real seed
decision needed: which existing role(s) get analytics write access —
recommend the same role(s) already holding `construction:create/update`
(the admin-equivalent QA role), not a new role, unless Joshua wants
narrower scoping.

## 3. Configurable multi-dashboard system

### 3.1 Schema

```prisma
enum AnalyticsWidgetType {
  metric_graph
  events_feed
  existing_summary
}

model AnalyticsDashboard {
  id          String                     @id @default(cuid())
  title       String
  isDefault   Boolean                    @default(false) @map("is_default")
  createdById String                     @map("created_by_id")
  createdBy   User                       @relation(fields: [createdById], references: [id])
  createdAt   DateTime                   @default(now()) @map("created_at")
  updatedAt   DateTime                   @updatedAt @map("updated_at")
  widgets     AnalyticsDashboardWidget[]
  @@map("analytics_dashboard")
}

model AnalyticsDashboardWidget {
  id                String              @id @default(cuid())
  dashboardId       String              @map("dashboard_id")
  dashboard         AnalyticsDashboard  @relation(fields: [dashboardId], references: [id], onDelete: Cascade)
  widgetType        AnalyticsWidgetType @map("widget_type")
  metricKey         String?             @map("metric_key")          // required when widgetType = metric_graph
  summaryWidgetKey  String?             @map("summary_widget_key")  // required when widgetType = existing_summary
  position          Int
  createdAt         DateTime            @default(now()) @map("created_at")
  @@map("analytics_dashboard_widget")
}
```

`existing_summary` is the important type: it reuses the 13 already-real
widgets built in Phase 1 (`FactoryWidget`, `GenealogyWidget`,
`ConstructionWidget`, `CostEstimatingWidget`, etc. — full list in
`AnalyticsDashboard.tsx`) by reference key, rather than discarding that
work. `metric_graph` is the new Recharts-backed time-series widget
(§1/§2). `events_feed` is the existing real merged Events list
(`EventsWidget`, Phase 1.3) exposed as a selectable widget type in its own
right.

### 3.2 Migration continuity — no visual regression

A backfill creates exactly one real `AnalyticsDashboard` (`title:
"Default"`, `isDefault: true`) with 13 `existing_summary` widgets in
today's exact order (`FactoryWidget` through `QualityControlWidget`,
matching `AnalyticsDashboard.tsx`'s current JSX order). Upgrading to
Phase 3 must render an identical page to today until a user actually
edits something — same "no regression, no fabrication" discipline as
every other migration in this rollout.

### 3.3 RBAC and sharing model

Dashboards are shared, not per-user-owned — same precedent as
`CostEstimateScenario` (a real `createdById` for authorship, but every
user with `analytics:read` sees every dashboard; every user with
`analytics:update` can edit any dashboard). Flagging this as the
assumed default rather than silently deciding it: if Joshua wants
per-user private dashboards, that's a real scope difference (ownership
checks, a "visibility" field) worth its own explicit call before §7
Phase 3.3 starts.

## 4. Backend

**`analyticsMetricsService.ts`** (new):
- `getMetricCatalog()` — returns the fixed §2.1 list (key, label, domain,
  shape).
- `computeMetricSeries(metricKey, rangeStart, rangeEnd, bucketMinutes)` —
  real time-bucketed series. Given real volume (§0), buckets computed in
  JS after a plain `findMany` over the range, not a raw-SQL
  `date_trunc`/`GROUP BY` — matches "don't build for hypothetical scale"
  until real volume actually requires it.
- `getMetricCurrentValue(metricKey, windowMinutes)` — real current
  windowed value + real alarm state (§2.3), joining
  `AnalyticsThreshold` if one exists for that key.

**`analyticsThresholdsService.ts`** (new): CRUD over `AnalyticsThreshold`,
`metricKey` validated against the fixed catalog.

**`analyticsDashboardsService.ts`** (new): CRUD over
`AnalyticsDashboard`/`AnalyticsDashboardWidget`, including reorder
(`position`).

**Routes** (`analyticsMetrics.ts`, `analyticsDashboards.ts`, new), all
gated on `analytics` module, same shape as every route file in this repo:
```
GET    /analytics/metrics                          (analytics:read)
GET    /analytics/metrics/:key/series               (analytics:read)  ?rangeStart&rangeEnd&bucketMinutes
GET    /analytics/thresholds                        (analytics:read)
PUT    /analytics/thresholds/:metricKey              (analytics:update)
DELETE /analytics/thresholds/:metricKey              (analytics:delete)
GET    /analytics/dashboards                        (analytics:read)
POST   /analytics/dashboards                        (analytics:create)
PATCH  /analytics/dashboards/:id                     (analytics:update)
DELETE /analytics/dashboards/:id                     (analytics:delete)
POST   /analytics/dashboards/:id/widgets             (analytics:update)
PATCH  /analytics/dashboards/:id/widgets/:widgetId   (analytics:update)
DELETE /analytics/dashboards/:id/widgets/:widgetId   (analytics:update)
```

## 5. Frontend

- `npm install recharts` in `Factory_To_Foundation/frontend`.
- `features/analytics/metrics/` (new): `analyticsMetricsApi.ts`,
  `MetricGraphWidget.tsx` (fetches a series for a `metricKey` + real
  CloudWatch-style time-range control — 1h/3h/12h/1d/3d/1w — renders via
  Recharts, shows the real alarm-state badge when a threshold exists,
  reusing `StatusBadge`'s existing tone system: `ok` → positive, `alarm`
  → critical, `no_threshold` → neutral).
- `features/analytics/thresholds/` (new): a small admin panel — list the
  fixed metric catalog, set/clear a threshold per metric — gated on
  `analytics:update` in the UI (button hidden/disabled without it, same
  pattern as delete buttons elsewhere), enforced for real on the backend.
- `features/analytics/dashboards/` (new): `analyticsDashboardsApi.ts`,
  `DashboardPicker.tsx` (list/select/create/delete), `DashboardEditor.tsx`
  (add/remove/reorder widgets; choosing `metric_graph` requires picking a
  catalog entry, choosing `existing_summary` requires picking one of the
  13 real existing widget keys), `DashboardView.tsx` (renders the
  selected dashboard's real widgets — routes `existing_summary` to the
  Phase 1 components, `metric_graph`/`events_feed` to the new ones).
- `AnalyticsPage` (existing route) is rewritten to render `DashboardView`
  for the selected/default dashboard plus the `DashboardPicker`, instead
  of today's single hardcoded grid.

## 6. Phased build sequence

**3.1 — Schema + RBAC (small, low-risk):** `AnalyticsThreshold`,
`AnalyticsDashboard`, `AnalyticsDashboardWidget`, both enums; sandbox
migration; RBAC seed update granting `analytics:create/update/delete` to
the admin-equivalent role (§2.4); backfill script creating the one real
default dashboard from today's exact 13-widget layout (§3.2,
exact-count-asserted, same discipline as every prior backfill).

**3.2 — Backend:** metric catalog constant, `analyticsMetricsService`,
`analyticsThresholdsService`, `analyticsDashboardsService`, all three
route files, RBAC-gated.

**3.3 — Frontend foundation:** install Recharts, build
`MetricGraphWidget` + time-range control against the real
`/analytics/metrics/:key/series` endpoint, build the threshold admin
panel.

**3.4 — Frontend dashboards:** `DashboardPicker`/`DashboardEditor`/
`DashboardView`, rewire `AnalyticsPage`, confirm the default dashboard
renders identically to today's hardcoded grid.

**3.5 — Live-verify in sandbox:** confirm no visual regression on the
default dashboard; create a second real dashboard; add a `metric_graph`
widget for a real metric; set a real threshold and confirm the alarm
state genuinely flips by driving real data past it (e.g. a real failed
`InstructionExecution` row) rather than trusting the UI at rest; reorder
and delete widgets; confirm RBAC (a read-only user can't see edit
controls).

Each sub-phase gets its own commit, same discipline as Phase 2's
2.1/2.2/2.3 split.

## 7. Not in Phase 3 — explicit boundary

- **No alarm notifications** (email/Slack/webhook) — only the visual
  OK/ALARM state on the metric widget itself. Delivery is a separate,
  unscoped feature.
- **No per-user dashboard ownership/private visibility** — shared model
  per §3.3, unless Joshua calls for the narrower version before 3.3
  starts.
- **No arbitrary/custom user-defined metrics.** The catalog (§2.1) stays
  fixed and code-defined; a new metric is a PR, not a UI action.
- **No background alarm evaluator or cron.** Alarm state is computed live
  on read (§2.3).
- **No historical alarm-breach log/history feed.** Only current live
  state is shown — a breach history would need its own real event table
  and is a real scope addition, deferred.
- **No change to the real underlying audit-trail tables** — Phase 3 only
  reads `LogisticsCustodyEvent`/`ScheduleTaskStatusEvent`/
  `InstructionExecution`/`ModuleSequenceEvent`, never writes to them.
