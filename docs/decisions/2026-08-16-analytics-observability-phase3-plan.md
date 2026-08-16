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
- **`analytics` RBAC module already exists** (`backend/prisma/seed.ts:37`).
  **Correction (3.1 live check):** the CEO role already holds
  `uniform(FULL)` — every module including `analytics` at all 6 actions
  — so the real QA test account (`qa.ceo@factoryfoundation.test`, role
  `CEO`, confirmed live via a direct query) already has
  `analytics:create/update/delete`. No RBAC seed change was needed for
  §2.4; the original claim here (based on a grep that missed CEO's
  programmatic `uniform(FULL)` row) was wrong.
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
`analytics:create`/`analytics:update`/`analytics:delete` to set/replace/
clear a threshold. Same shape as every other module's C/U/D gating in
this codebase (`costEstimates.ts`, `moduleSequences.ts`, etc.). **No seed
change needed** — the CEO role already holds `analytics:create/update/
delete` via its `uniform(FULL)` grant (confirmed live against the real
QA test account, §0). Other roles (e.g. Project Manager, currently
`analytics: R`) stay read-only unless Joshua wants broader write access
later — not expanded here since nothing asked for it.

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
"Default"`, `isDefault: true`) with 13 real widgets in today's exact
`AnalyticsDashboard.tsx` JSX order: 12 as `existing_summary` (every
current widget except Events) plus `EventsWidget` itself as a real
`events_feed` row — consistent with §5's own framing of `events_feed` as
its own selectable type, not folded into the generic `existing_summary`
bucket. Upgrading to Phase 3 must render an identical page to today until
a user actually edits something — same "no regression, no fabrication"
discipline as every other migration in this rollout.

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
GET    /analytics/metrics/:key/current              (analytics:read)  ?windowMinutes -- real current value + live alarm state
GET    /analytics/thresholds                        (analytics:read)
PUT    /analytics/thresholds/:metricKey              (analytics:update)
DELETE /analytics/thresholds/:metricKey              (analytics:delete)
GET    /analytics/dashboards                        (analytics:read)
POST   /analytics/dashboards                        (analytics:create)
PATCH  /analytics/dashboards/:id                     (analytics:update)
DELETE /analytics/dashboards/:id                     (analytics:delete)
POST   /analytics/dashboards/:id/widgets             (analytics:update)
PATCH  /analytics/dashboards/:id/widgets/reorder      (analytics:update)  body: { widgetIds: string[] } -- must be exactly the dashboard's real widget ids
DELETE /analytics/dashboards/:id/widgets/:widgetId   (analytics:update)
```

**Refined during 3.2 build (not in the original route sketch):** the
`current` endpoint was added because `MetricGraphWidget` (§5) needs a
live value + alarm state, not just a series, for its badge. The
per-widget `PATCH` was replaced with a single bulk `reorder` endpoint
(atomic, one transaction) since the only real edit operation the
DashboardEditor UI needs is reordering, not in-place type/key edits.
`deleteDashboard` also gained a real guard: refuses to delete the
`isDefault` row, so there's always a real fallback dashboard. All four
live-verified against the real running sandbox backend (§0 discipline —
including forcing a real alarm-state flip by setting a real threshold
below the real current `ModuleSequenceEvent` count and confirming it
read back `"state":"alarm"`, then confirming it reverted to
`"no_threshold"` after clearing).

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
migration; RBAC seed verified live (no change needed, §2.4); backfill
script creating the one real default dashboard from today's exact
13-widget layout (§3.2, exact-count-asserted, same discipline as every
prior backfill).

**3.2 — Backend:** metric catalog constant, `analyticsMetricsService`,
`analyticsThresholdsService`, `analyticsDashboardsService`, all three
route files, RBAC-gated.

**3.3 — Frontend foundation (complete):** installed Recharts, built
`MetricGraphWidget` + the 6-preset CloudWatch-style time-range control
against the real `GET /analytics/metrics/:key/series` +
`GET /analytics/metrics/:key/current` endpoints, built the threshold
admin panel (RBAC-gated in the UI via `usePermission("analytics",
"update"/"delete")`, real enforcement already on the backend). Typecheck
clean. **Real finding, not a bug:** the production build's bundle byte
count was unchanged and a direct grep of the built JS found zero
occurrences of "recharts" — neither component is imported by any real
route yet, so Vite's tree-shaking correctly excludes them. Live browser
verification and confirming Recharts actually lands in the bundle both
wait for 3.4, once these mount to a real page.

**3.4 — Frontend dashboards (complete):** `DashboardPicker`/
`DashboardEditor`/`DashboardView` built; the 12 pre-existing Phase 1
widgets were exported from `AnalyticsDashboard.tsx` (its old
hardcoded-grid default export removed as dead code) and routed through a
new `widgetRegistry.tsx` by key. `AnalyticsPage` rewired to be
dashboard-driven. Typecheck clean; a production build confirmed Recharts
now genuinely lands in the bundle (+359KB, "recharts" grep went from 0 to
15 occurrences) now that `MetricGraphWidget` is actually reachable.
**Live-verified in the browser against the real local stack** (backend +
frontend + Factory Runtime all up): the real default dashboard renders
all 13 widgets in the exact original order with real data, zero visual
regression; created a real second dashboard ("Phase 3.4 Live Test"),
added a real `metric_graph` widget for `scheduling.statusEvents.count`,
confirmed the Recharts graph renders real historical data at the 1w range
(the real spike lines up with the known event history) and an honest
empty state at 1d; opened the Thresholds panel and confirmed all 5 real
catalog entries render with working controls; deleted the test dashboard
and confirmed the picker correctly fell back to Default. Zero console
errors throughout.

**Post-3.4 follow-up (2026-08-16, `b73ec6c`): every widget now defaults
to a real chart, not just the new metric_graph type.** Joshua's direct
feedback after seeing 3.4 live: the dashboard-driven page still carried
Phase 1's original 12 widgets forward unchanged -- real label/value
lists, no charts, because nothing new touched them. Only a manually-added
metric_graph widget ever showed a Recharts graph. Resolution (his call,
not assumed): every widget, present and future, gets a Chart/Text toggle
defaulting to **Chart**. Built a shared `ViewToggle` + `ChartableWidgetCard`
(Recharts `BarChart`) and wired all 12 pre-existing widgets + Events
through it, deriving each widget's chart data from numbers it already
computes -- no new fetches, no fabricated series. `QualityControlWidget`
has no real chartable series (a single live record, not a trend) so its
chart view honestly says so rather than faking a bar. `MetricGraphWidget`
got the same toggle for consistency (text view = its real per-bucket
series as rows). Live-verified: real bar charts render correctly at
every scale (Factory's small 0-8 running/idle/unknown counts, Cost
Estimating's real $330,000 bar), Text toggle correctly reverts to the
exact original row display, zero regressions, zero console errors.

**3.5 — Live-verify in sandbox (partially covered by 3.4's testing
above; remaining items before calling Phase 3 fully done):** setting a
real threshold *through the UI* and confirming `MetricGraphWidget`'s
alarm badge genuinely flips (only the backend path was exercised this
way in 3.2 via curl; the UI's `ThresholdAdminPanel` → `MetricGraphWidget`
round trip hasn't been watched live yet); confirming RBAC in the browser
with a non-CEO, read-only account (only tested as CEO, which has full
access on every module -- never a real negative case for hiding edit
controls). Reorder/widget-delete are backend-verified (3.2) and the UI
controls are confirmed present or exercised at the dashboard level
(3.4's dashboard-level delete), but per-widget reorder/remove haven't
been clicked in the browser specifically.

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
