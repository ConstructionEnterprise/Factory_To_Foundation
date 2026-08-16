# FF Construction Intelligence — Phase 1 Implementation Plan

**Status: Phase 1 complete** (1.1 Construction Data Map, 1.2 Cost
Estimating, 1.3 Analytics integration — all three built, typechecked,
sandbox-verified, live-browser-verified, committed, pushed: `9c3422f`,
`570ac7e`, `aaeb585`). Plan finalized across four rounds of review
(validated against real code, compared against a second relayed steering
doc, adjusted per Joshua's final call on Analytics scope, then split
again after a third relayed proposal to transform Analytics into a
CloudWatch-style observability surface). **Phase 2 (Modular Sequencing +
Timeliner) and Phase 3 (CloudWatch-style observability) are separately
scoped and require their own explicit go-ahead** — neither started, same
discipline as the Inventory/Fleet rollout's own phase gates.

**Source of truth:** validated directly against the real FF codebase
(`C:\Dev\Factory_Foundation_design_pass`) via two parallel Explore-agent
audits plus direct schema/component inspection. Every claim below traces
to a real file:line, not to any relayed document's own claims.

**How this plan came together:** a Manus AI "CE/FF Consolidated Synthesis
and Implementation Steering Plan" proposed five capabilities; validation
found two already fully built (Construction Enterprises Map) or real-but-
narrower-by-design (Logistics Flow, Dispatch), and three pure proposals
(Construction Data Map, Cost Estimating, Modular Sequencing). A second
relayed plan ("FF Construction + Operations Implementation Run") expanded
scope further and proposed resolving the Logistics/Dispatch boundary
tension by making Modular Sequencing a new domain that *consumes*
Logistics/Dispatch rather than extending them — that resolution was
adopted. Joshua's final call: **Analytics stays in this phase** (the
second relayed plan had it in-scope; an earlier draft of this doc had
deferred it); **Modular Sequencing + Timeliner becomes the separately
scoped Phase 2.** A third relayed proposal then reframed Analytics again —
not "add a few widgets" but "transform FF Analytics into a
CloudWatch-inspired operational observability environment" (metric
graphs, time-range controls, alarm/state indicators, dashboards,
events/logs, drill-down). Validated against real code: zero charting
infrastructure exists anywhere in the frontend, zero threshold/alarm
concept exists anywhere, and a real merged events feed *is* honestly
buildable today from existing audit-trail tables. Split accordingly —
the real, buildable slice (§3.2 item 3) joins Phase 1; the rest becomes
**Phase 3** (§9).

---

## 0. Phase boundary

**Phase 1 (this plan, ready to build): Construction Data Map, Cost
Estimating, Analytics integration.** All three are buildable now against
real, existing FF data with no fabrication and no reopened boundaries.

**Phase 2 (separately scoped, own plan doc, own go-ahead): Modular
Sequencing + Timeliner.** Recorded in §8 so the reasoning already done
doesn't get re-litigated when it's picked up, but explicitly not started
as part of this run.

**Phase 3 (separately scoped, own plan doc, own go-ahead): CloudWatch-
style Analytics observability transformation** (metric graphs, time-range
controls, alarm states, dashboards). Recorded in §9. Phase 1's Analytics
work (§3) ships a real, honest slice of this idea now — a merged
Events/Logs feed — without the parts that would require infrastructure
that doesn't exist yet.

**Explicitly not touched by either phase:**
- **Logistics Flow's real 7-stage vocabulary** (Receiving → Factory →
  Autonomous Handling → Staging → Load Assignment → Loading →
  Transportation Handoff) — stays exactly as built.
- **Dispatch's real 3-state machine** (`staged → in_transit →
  delivered`) — stays exactly as built.

---

## 1. Construction Data Map

### 1.1 What's real to build on

`ConstructionProject` already has real FK relations
(`backend/prisma/schema.prisma:332-349`):
- `site ConstructionSite?`
- `treeNodes ConstructionTreeNode[]`
- `files ProjectFile[]`
- `logisticsDispatches LogisticsDispatch[]` — and via this rollout's Fleet
  work, each dispatch now resolves to a real `Vehicle` too.

**What's explicitly NOT real and won't be fabricated:** `GenealogyNode`'s
`Project` tier (`schema.prisma:491-509`) is a bare title string, not an FK
to `ConstructionProject`. There is no real link today between a Genealogy
module DAG and the construction project it's destined for. Showing "which
modules are genealogically linked to this project" would require either
fuzzy title-matching (fragile, will misrepresent data) or a new additive
FK (`GenealogyNode.constructionProjectId`, nullable, same pattern as
`InventoryItem`/`Vehicle`'s own additive links) — **a real schema
decision, listed in §7, not assumed here.**

### 1.2 Design — reuse the proven ribbon capability-switch pattern

Same shape as Inventory (Assets/Genealogy) and Logistics (Fleet), both
built and production-verified this rollout:

- `ConstructionPage.tsx` gains `extraMenus`: `Map | Data Map | Estimating`
  (Cost Estimating folds into the same ribbon — see §2), using
  `CommandRibbon`'s existing `onClick`/`active` shape
  (`framework/ui/CommandRibbon.tsx`) — no new ribbon mechanism.
- `mode === "map"` (default, unchanged): today's existing
  `ConstructionMap`/`ConstructionDocumentViewer` toggle, untouched.
- `mode === "dataMap"`: new `ConstructionDataMap` capability — a
  project-centric relationship view, not a generic graph.

**No Modular Sequencing button in this phase's ribbon.** A disabled/
placeholder button that says "coming soon" is still a fabricated UI
element with no real function behind it — the same discipline this
rollout has used everywhere else (no feature ships a button before the
capability behind it is real). The ribbon gains a `Modular Sequencing`
entry exactly when Phase 2 actually starts, the same way Fleet's own
ribbon entry was added exactly when Fleet shipped, not before.

**v1 scope, honest about what's real:** selecting a project shows its
real site info, real tree hierarchy (Buildings → Units), real document
count, and real inbound Logistics — every dispatch whose
`destinationProjectId` matches this project, each resolved to its real
vehicle (via `LogisticsDispatch.vehicleId` → `Vehicle`), status, route,
and ETA. This directly answers real operational questions ("what's headed
to this project, on what, and when") using only relationships that
already exist in the schema.

### 1.3 New code (additive only, no schema change)

- `backend/src/repositories/constructionRepository.ts` (or extend the
  existing one) — a real query joining `ConstructionProject` →
  `logisticsDispatches` → `vehicle`, `truck`, `destinationProject` in one
  call, mirroring the resolution pattern `flowPointResolution.ts` already
  uses for `transportation_handoff`.
- `GET /construction-projects/:id/relationships` — real route, gated on
  the existing `construction` RBAC module.
- `Factory_To_Foundation/frontend/src/features/construction/DataMap/` —
  `ConstructionDataMapBrowse.tsx` (project picker, reusing
  `ConstructionPage`'s existing project tree data),
  `ConstructionDataMapView.tsx` (the relationship panel — real
  site/tree/dispatch/vehicle detail, no fabricated graph layout),
  `ConstructionDataMapInspector.tsx` (selected dispatch/vehicle detail,
  reusing `SelectionContext`'s existing `fleet` payload shape).

No Prisma migration needed — every relationship shown already exists as a
real FK.

---

## 2. Cost Estimating

### 2.1 What's real to build on

Nothing — confirmed zero existing model, route, or UI anywhere in FF.
Genuinely net-new, unlike Construction Data Map.

### 2.2 Design — flat rate/SF scenario model, not target-price reverse-derivation

**Rejected explicitly, not silently:** the second relayed plan proposed
the user picks a *target* price ($145/SF) and "FF develops the
corresponding cost structures underneath" it — reverse-deriving a
labor/material/equipment/subcontractor breakdown to justify an arbitrary
target. That requires real unit-cost rate data (labor rates, material
rates, equipment rates, regional factors) to derive from, and **none of
that exists anywhere in FF today** — confirmed via the same audit that
validated this plan. Built as described, it would either need someone to
source real cost-rate data first (not in scope, not proposed anywhere),
or it fabricates a plausible-looking breakdown to hit the target number —
the exact kind of fabrication this rollout has deliberately avoided
everywhere else (Dock Utilization stays "no dock model yet" rather than
inventing a percentage; Logistics `traffic` stays a disclosed
placeholder).

**What ships instead — the honest floor:**

```
CostEstimateScenario
  id, projectId (FK -> ConstructionProject), name, createdAt, createdById
  squareFootage          Float    -- real, entered, never guessed
  ratePerSquareFootCents Int      -- real, entered (e.g. 14500 = $145.00/SF)
  overheadPercent        Float?   -- nullable, honest absence if not set
  markupPercent          Float?
  notes                  String?
  -- totalCents is ALWAYS derived (squareFootage * rate, then
  -- overhead/markup applied), never stored independently -- same
  -- "never accept a derived number from the client" discipline as
  -- LogisticsDispatch.miles.
```

A project can have multiple scenarios — e.g. Bid A ($145/SF), Bid B
($155/SF), Bid C ($165/SF) against the same 2,000 SF — compared simply by
listing them side by side; no separate "comparison" model needed. Every
scenario is real, persisted, and re-editable.

**Explicitly leaves room for a real v2** (labor/material/equipment/
subcontractor/regional-factor breakdown, or a target-price-to-structure
mode) once real unit-cost rate data actually exists to back it — not
implemented as if that data already exists.

### 2.3 New code

- Migration: `CostEstimateScenario` model, FK to `ConstructionProject`,
  nullable `overheadPercent`/`markupPercent`/`notes` (honest-absence
  pattern, not defaulted).
- `backend/src/repositories/costEstimateRepository.ts`,
  `backend/src/services/costEstimateService.ts` (real derivation of
  `totalCents` server-side, same "server always derives, client never
  supplies" discipline as `recordMileage()`),
  `backend/src/routes/costEstimates.ts` — `GET/POST
  /construction-projects/:id/cost-estimates`, `PATCH /cost-estimates/:id`,
  gated on `construction` RBAC module (`create` action for POST/PATCH).
- `Factory_To_Foundation/frontend/src/features/construction/CostEstimating/`
  — `CostEstimatingPanel.tsx` (scenario list + create/edit form), reached
  via the ribbon's `Estimating` entry.

---

## 3. Analytics integration

### 3.1 What's real today

`features/analytics/AnalyticsDashboard.tsx` already has a `ConstructionWidget`
(line 203) — real, but reads from the **static** `constructionProjects`
fixture (`features/construction/constructionData.ts`), honestly badged
`"Real Static Data"`. It shows project count and each project's child
object count. **No Logistics/Dispatch widget exists at all today.** No
Cost Estimating widget exists (nothing to show — the model doesn't exist
until §2 ships).

`ProductionOutputWidget` (line 266) is the closest existing precedent for
a real event feed: it reads `InstructionExecution` history (real, ordered
`executedAt desc`), shows real counts + most-recent timestamp, and has a
real honest-empty state ("No real executions logged yet..."). No widget
anywhere plots a graph — every existing widget is a real label/value list,
never a chart. Confirmed no charting library exists in `package.json`
either.

### 3.2 Design — extend what's real, badge honestly, no new fake datasets

Three changes, all additive to the existing widget grid, no new page:

1. **Upgrade `ConstructionWidget`** to also show real logistics context
   per project — reuse §1's `GET /construction-projects/:id/relationships`
   route (or a lighter list-level variant) rather than re-deriving a
   second read path. Badge changes from `"Real Static Data"` to a live
   badge once it's actually fetching from the backend, matching the exact
   badge-honesty convention every other widget already follows.
2. **New `CostEstimatingWidget`** — once §2 ships, show real scenario
   counts/totals per project (e.g. "3 real projects have active
   estimates, $290K-$330K range on Cedarwood Flats"). Built after §2, not
   before — there's nothing real to show until scenarios exist.
3. **New `EventsWidget`** — the real, honestly-buildable slice of the
   CloudWatch-style proposal (§9): a merged, real, timestamp-ordered feed
   across `LogisticsCustodyEvent` (dispatch status changes),
   `ScheduleTaskStatusEvent` (schedule task status changes), and
   `InstructionExecution` history (already used by `ProductionOutputWidget`
   — reused, not re-fetched) — one real cross-domain "what happened
   recently" list. Built on `ProductionOutputWidget`'s exact pattern: real
   rows, real honest-empty state per source if a table has zero rows, no
   fabricated event types. **This is a list, not a graph** — no charting
   library, no time-range selector, no alarm state. Those are Phase 3.

**No Logistics/Dispatch-specific widget beyond the Events feed in this
phase.** The `ConstructionWidget` upgrade (item 1) already surfaces real
dispatch data per project; the `EventsWidget` (item 3) surfaces real
dispatch/schedule/execution activity across all projects. A dedicated
cross-project Logistics/Fleet analytics widget (utilization, transit
performance) is a legitimate future idea but isn't implied by anything
currently real — not fabricated here to fill a slot.

### 3.3 New code

- Extend `AnalyticsDashboard.tsx`'s `ConstructionWidget` (or split into a
  slightly larger real component if the combined view gets too dense) to
  fetch real per-project logistics data.
- New `CostEstimatingWidget` function in the same file, following the
  exact same `PanelCard` + `StatusBadge` pattern every other widget uses.
- New `EventsWidget` function, same file — a real backend aggregation
  route (`GET /analytics/events`, or client-side merge of three existing
  real fetches if a new route isn't warranted for this volume of data)
  feeding one real merged, sorted list.
- No new backend routes beyond what §1/§2 already add plus the events
  aggregation above — Analytics reuses existing read paths, doesn't
  duplicate them.

---

## 4. Command Ribbon shape (Phase 1, final)

```
Construction workspace
│
├── Map           (existing, unchanged — Construction Enterprises Map)
├── Data Map      (new — §1)
└── Estimating    (new — §2)
```

Matches the standing FF UI rule: sidebar = domain (Construction stays one
sidebar entry), CommandRibbon = capability, workspace = view. Neither new
capability becomes a new sidebar item or a nested sub-page. `Modular
Sequencing` is not in this ribbon — see §1.2.

---

## 5. Dependency graph and phased sequence

Construction Data Map and Cost Estimating have zero dependency on each
other. Analytics depends on both existing first (it reuses their real
data, doesn't fabricate its own).

**Phase 1.1 — Construction Data Map (no migration, additive route only):**
1.1a Backend: relationship-resolution route.
1.1b Frontend: ribbon entry + three-panel capability view.
1.1c Sandbox-verify, live-verify in browser, commit/push.

**Phase 1.2 — Cost Estimating (real migration, real writes):**
1.2a Schema + migration (sandbox first — snapshot, diff, deploy, verify,
     same discipline as every migration this rollout).
1.2b Backend routes/service (server-derives totals, never trusts client
     math).
1.2c Frontend scenario list/create/edit UI.
1.2d Sandbox-verify, live-verify, commit/push.

**Phase 1.3 — Analytics integration (after 1.1 and 1.2 land):**
1.3a Upgrade `ConstructionWidget` to real per-project logistics data.
1.3b New `CostEstimatingWidget`.
1.3c New `EventsWidget` (real merged Logistics/Schedule/Execution feed).
1.3d Live-verify in browser, commit/push.

**Not scheduled in Phase 1:** Modular Sequencing, Timeliner, Logistics
Flow chain extension, Dispatch granularity extension, metric graphs,
time-range controls, alarm states, dashboards (all Phase 3, §9).

---

## 6. Acceptance gates

| Gate | Required outcome |
|---|---|
| Ribbon placement | `Data Map`/`Estimating` use the existing `onClick`/`active` CommandRibbon shape; no `Modular Sequencing` placeholder button |
| Data integrity | Data Map shows only relationships backed by real FKs (`logisticsDispatches`, `treeNodes`, `site`, `vehicle`) — no fabricated graph edges |
| Cost integrity | Scenario totals are always server-derived from `squareFootage`/`rate`/`overhead`/`markup`; never client-supplied; no target-price reverse-derivation |
| Analytics integrity | Every widget reuses an existing or newly-added real read path; badges honestly reflect live vs. static data; no invented metric (dock utilization, transit performance, etc.) ships without real backing data |
| Events feed integrity | `EventsWidget` shows only real rows from `LogisticsCustodyEvent`/`ScheduleTaskStatusEvent`/`InstructionExecution`; a source with zero real rows shows an honest empty state, never a fabricated placeholder event |
| Reuse | No parallel navigation mechanism, no duplicate `ConstructionProject`/`LogisticsDispatch` read path between Data Map and Analytics |
| Verification | typecheck → build → sandbox exact-count/behavior verify → real browser verify → commit → push, per sub-phase |
| Honesty | Any relationship genuinely absent (e.g. Genealogy↔Construction linkage) is shown as absent, never inferred by name-matching |

---

## 7. Architectural decisions awaiting approval

Not decided here — listed so they don't get silently assumed mid-build:

1. **Should `GenealogyNode` gain a real, additive `constructionProjectId`
   FK** (same pattern as `InventoryItem`/`Vehicle`), so Construction Data
   Map could eventually show "which real modules are destined for this
   project"? Not in Phase 1's scope either way.
2. **Cost Estimating's v2 field set** (labor/equipment/subcontractor/
   regional-factor breakdown, or a target-price mode) — deferred until
   real rate data exists to back it.
3. **Whether a cross-project Logistics/Fleet analytics widget is wanted**
   beyond the per-project view §3 adds — not proposed here, no real gap
   identified that demands it yet.

---

## 8. Phase 2 (separate plan, separate go-ahead) — Modular Sequencing + Timeliner

Not started as part of this plan. Recorded here so the reasoning already
done isn't re-litigated from scratch when it's picked up.

**The resolution being carried forward, from the second relayed plan:**
*"Logistics owns the movement data. Modular Sequencing consumes that
movement as part of the construction installation sequence."* Neither
Logistics Flow's 7-stage vocabulary nor Dispatch's 3-state machine gets
touched. A new Sequencing domain (new Prisma models, new routes, new
feature folder) reads `LogisticsDispatch`/`Vehicle`/`FlowPoint` as real
inputs and owns everything past Transportation Handoff itself:

```text
LOGISTICS (unchanged)                    MODULAR SEQUENCING (new domain)
Receiving                                Transportation Context
   ↓                                        ↓
Factory                                  Site Arrival
   ↓                                        ↓
Autonomous Handling                      Site Acceptance
   ↓                                        ↓
Staging                                  Installation
   ↓                                        ↓
Load Assignment                          Crane / Placement
   ↓                                        ↓
Loading                                  Construction Sequence
   ↓
Transportation Handoff  ─────────────────►
```

**Two real, non-trivial gaps that Phase 2's own plan needs to scope
explicitly, not discover mid-build:**

1. **Scale.** This is a full new domain (schema + backend + frontend),
   materially bigger than Data Map + Cost Estimating + Analytics
   combined. It deserves its own validated plan doc and its own phase
   gate, the same way Inventory and Fleet each got one.
2. **The Timeliner needs time-series data that doesn't exist yet.**
   "Scrub through time, see where each module physically was" requires a
   real position-over-time record per module. The closest real thing
   today is `LogisticsCustodyEvent` — a status-change audit trail across
   only the existing 3 coarse dispatch states, not a continuous location
   timeline. Phase 2 must design and populate that time-series model
   *first*, as its own real subphase — the Timeliner is not ready to
   build until FF can truthfully answer "what module, doing what, where,
   and when?"

**Not decided by this doc:** whether Sequencing gets built as an
FF-owned Construction capability (what folding it straight into the
Command Ribbon implies) or held until CE_Forge/Construction_Enterprises
grows a real product surface of its own. Flagged for Joshua's call.

---

## 9. Phase 3 (separate plan, separate go-ahead) — CloudWatch-style Analytics observability transformation

Not started as part of this plan. A third relayed proposal reframed
Analytics from "add a few real widgets" to "transform FF Analytics into a
CloudWatch-inspired operational observability environment" — adopting
CloudWatch's interaction model (*observe → filter → graph → detect →
investigate → drill into related objects*), not its branding or
infrastructure semantics.

**What's genuinely good about this idea, worth carrying forward:** the
interaction model itself is a legitimate, FF-native-compatible UX
pattern — it's the same *pick something real → see its real detail →
drill into a related real object* shape Inventory and Fleet already use,
just applied across time instead of category. The real events-feed piece
of it already shipped in Phase 1 (§3.2 item 3) because it needed no new
infrastructure.

**What doesn't hold up yet, confirmed against real code, and why this
isn't Phase 1.3:**

1. **No charting infrastructure exists.** Zero chart/graph library
   (Recharts, D3, Chart.js, etc.) anywhere in `package.json`. Every
   existing Analytics widget is a real label/value list — "metric graphs
   as first-class objects" means picking and integrating a charting
   library from scratch, plus building real time-bucketed aggregation
   logic that doesn't exist anywhere in the backend today.
2. **No threshold/alarm concept exists anywhere in FF.** CloudWatch
   alarms mean something because a threshold is explicitly defined and
   evaluated. Building "state: OK/ALARM" without a real defined threshold
   means either fabricating one — the exact kind of fabrication this
   rollout has refused everywhere else — or leaving it meaninglessly
   undefined. Any alarm/state feature needs a real answer to "who defines
   the threshold, and where is it stored" before it's built, not after.
3. **"Dashboards" (plural, selectable) implies a saved/configurable
   dashboard system** — a real feature in its own right, unscoped
   anywhere, not just an Analytics-page tweak.
4. **Real data volume is currently small.** Dozens of records across
   dispatches/scenarios/executions, not a continuous stream. A granular
   CloudWatch-style time-range selector (1h/3h/12h/1d/3d/1w/custom) may
   not show meaningfully different content between ranges yet — worth
   designing with real data density in mind, not assumed away.

**Recommended shape for Phase 3's own plan doc, once scoped:** design the
real threshold/alarm data model first (§2's own point 2 applies the same
"never accept a derived number without a real source" discipline —
alarm state must derive from a real, stored threshold, never be
invented), pick a charting library deliberately, and build time-bucketed
aggregation as real backend logic before any graph renders. Not decided
here — flagged for its own validated plan when Joshua gives it a
go-ahead, same treatment as Phase 2.
