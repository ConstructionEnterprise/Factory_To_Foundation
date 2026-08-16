# Scheduling — Phase 2.3: Backend Routes + Frontend Wiring — Scoping

**Status:** Scoped, not implemented. One real architectural decision
needed before implementation starts (§3) — everything else below is
ready to build once that's answered.

**Context:** Phase 2.1 (schema) and 2.2 (real backfill of the CE Forge
S1–S4 data into `Schedule`/`ScheduleStage`/`CanonicalStage`) are complete
and live-verified in sandbox (`docs/decisions/
2026-08-16-scheduling-schedule-persistence-phase2-plan.md`). No backend
routes exist for any of it yet, and the real frontend still reads only
the `scheduleData.ts` fixture — this doc scopes closing both gaps.

---

## 1. Real current frontend state (confirmed by reading every file)

`ScheduleWorkspace.tsx` is a fixed 5-panel layout: **Browse | Layout
(Function Block Canvas) | Inspector | Gantt | Heat Map.**

- **`ScheduleBrowse.tsx`** reads `schedules`/`scheduleNodes` from the
  fixture directly — real `Schedule → Step` containment tree via
  `BrowseList`'s children mode. Its own comment discloses the exact
  Phase 1 shortcut this phase needs to fix: *"a step's row id is the
  stage id it points to, not a composite — Phase 1 has exactly one
  schedule so no collision exists yet."* Now there are 4 real schedules.
- **`ScheduleLayout.tsx` + `FunctionBlockCanvas.tsx`** render the 5
  fixture stages as real geometric function blocks — real `x`/`y`/
  `width`/`height` per node, real named input/output ports, real
  port-to-port wire lines. This is real, deliberate IEC-61131-3-style
  visual modeling, not a generic node graph.
- **`ScheduleGantt.tsx` / `ScheduleHeatMap.tsx`** already read real
  backend data via `fetchScheduleTaskDirectory()` — **unaffected** by
  this phase. `ScheduleTask`'s shape didn't change breakingly (only
  gained an optional `scheduleId`).
- **`ScheduleInspector.tsx`** renders whatever `SelectionContext` payload
  it's given — already schema-agnostic (`name`/`description`/
  `ownedByModule`/`inputs`/`outputs`), no changes needed structurally.
- **`scheduleTasksApi.ts`** is the real, established client pattern to
  extend — same `requestJson`/`authFetch` shape, a
  `SCHEDULE_TASKS_CHANGED_EVENT` broadcast convention for cross-panel
  refresh.
- **Backend**: `scheduleTasks.ts`/`scheduleTaskService.ts` is the real
  pattern to extend for `Schedule`/`ScheduleStage`/`CanonicalStage` —
  gated on the existing `scheduling` RBAC module (already has real
  per-role grants, no RBAC change needed).

---

## 2. One contradiction resolves itself for free

Phase 1's own comment worried about step-id collisions once more than
one schedule existed. **That's no longer a real risk**: `Schedule.id`
and `ScheduleStage.id` are both real global `cuid()`s (Phase 2.1), not
the old fixed slugs (`"inbound-material"`, etc.). A step's row id can
just be its own real `ScheduleStage.id` directly — globally unique by
construction, no composite id needed. `ScheduleBrowse.tsx`'s real fix is
simpler than its own Phase 1 comment anticipated.

---

## 3. The real architectural decision: what happens to the Function Block Canvas

This is the one genuine open question, not a mechanical wiring task.

**The mismatch:** `FunctionBlockCanvas` needs `ScheduleNodeData` — real
`x`/`y`/`width`/`height` and real named ports per stage. **None of that
exists on the new `ScheduleStage` model**, and Phase 2.2's real backfill
correctly didn't invent any (a real "Kitting" stage has no real
coordinates or port geometry — fabricating some would be exactly the
kind of invented structure this whole rollout has refused everywhere
else). Real per-schedule stages have exactly one real spatial fact:
`position` (an integer order), the same shape Modular Sequencing's
Timeliner already solved for real data with no spatial coordinates.

Three real options, not decided here:

**(a) Retire the Function Block Canvas as a per-schedule view. Replace
it with a real, simple ordered Stage/Step list** for whichever schedule
is selected (same non-geometric "status-over-an-axis" precedent as
Modular Sequencing's Timeliner) — a `<ScheduleStageList>` reading real
`position`-ordered `ScheduleStage[]` with each stage's real linked task
status. The Function Block Canvas's 5-box/port/wire visual disappears
from the real per-schedule flow entirely.

**(b) Keep the Function Block Canvas, but repoint it at `CanonicalStage`
only** — a fixed, schedule-independent reference diagram (real
`x`/`y`/ports would need to be *added to* `CanonicalStage`, which
doesn't have them today either — this option isn't free, it's real new
schema work). Shows "the conceptual 5-stage pipeline" as a static
reference, never bound to any specific real schedule's real stages.

**(c) Hybrid** — canvas stays exactly as-is, unchanged, reading the
frontend fixture verbatim (now understood explicitly as "the canonical
reference diagram, not live data"); a **new**, separate
`<ScheduleStageList>` (same as (a)) is added specifically for whichever
real schedule is selected in Browse. Two real, honestly-different views
for two real, different concepts — the pipeline *concept* vs. one real
schedule's real steps — rather than forcing one visual to represent both.

**Recommendation: (c).** It requires no new schema work (unlike (b)),
doesn't delete real existing UI (unlike (a)), and is the most honest
option — the Function Block Canvas keeps meaning exactly what it always
meant (the conceptual pipeline), and a schedule's real steps get their
own real, non-fabricated view. Not decided unilaterally — flagging for
an explicit call before implementation.

---

## 4. Backend design

New repository/service/route files, same three-layer pattern as every
other domain, gated on the existing `scheduling` module:

**`scheduleRepository.ts` / `scheduleService.ts` / `routes/schedules.ts`:**
```
GET  /schedules                     (scheduling:read)  -- list, with real stage/task counts
GET  /schedules/:id                 (scheduling:read)  -- one schedule + its real ScheduleStage[] (position-ordered) + each stage's real tasks
POST /schedules                     (scheduling:create) -- body: { title, constructionProjectId? }
```

**`scheduleStageRepository.ts` / `scheduleStageService.ts`** (folded into
the same route file as sub-routes):
```
POST  /schedules/:id/stages                (scheduling:create) -- body: { title, canonicalStageId? }, position = real current stage count (append)
PATCH /schedules/:id/stages/reorder        (scheduling:update) -- body: { stageIds: string[] } -- same atomic bulk-reorder pattern Analytics Phase 3.2 already built
```

**`canonicalStageRepository.ts` / route** (read-only, real reference
data, no write route — it's seeded, not user-editable):
```
GET /canonical-stages   (scheduling:read)
```

No changes to `scheduleTasks.ts`/`scheduleTaskService.ts` — `ScheduleTask`
already has real `scheduleId`/`stageId` write support in principle
(Prisma-level), but its existing `createTaskSchema`/`updateTaskSchema`
would need `scheduleId` added as an optional field so a new task can be
filed under a real schedule at creation time. **Small, real, additive
change to an existing route** — not a new file.

---

## 5. Frontend design

- **`scheduleApi.ts`** (new file, or added to `scheduleTasksApi.ts` —
  recommend new file, `Schedule` is a real distinct concept from
  `ScheduleTask`): `fetchSchedules()`, `fetchScheduleDetail(id)`,
  `createSchedule()`, `createStage()`, `reorderStages()`,
  `fetchCanonicalStages()`.
- **`ScheduleBrowse.tsx`**: rewired to fetch real `Schedule[]` and
  render each schedule's real `ScheduleStage[]` as children, using each
  stage's own real `id` directly (§2 — no composite-id workaround
  needed). Real "+ New Schedule" affordance, same
  create-form-in-panel pattern as `SequencingPanel`/`CostEstimatingPanel`.
- **New `<ScheduleStageList>`** (per §3's recommended option (c)):
  real position-ordered list of a selected schedule's real stages, each
  showing its real linked task's status — same list-rendering precedent
  as `FleetWorkspace`/`SequencingPanel`.
- **`ScheduleLayout.tsx`/`FunctionBlockCanvas.tsx`**: **unchanged**
  under option (c) — still renders the real fixture's 5-stage pipeline
  diagram, now with an updated doc comment clarifying it's the
  conceptual/reference view, not bound to any one real schedule.
- **`ScheduleWorkspace.tsx`**: gains the new `<ScheduleStageList>` into
  the existing 5-panel layout — real layout placement (which panel it
  replaces or sits alongside) is a real UI call for whoever builds it,
  not pre-decided here.
- **`AnalyticsDashboard.tsx`'s `SchedulingWidget`**: small follow-on,
  real counts now available (`Schedule`/`ScheduleStage` counts via the
  new `/schedules` read), currently still reading the fixture — flagged,
  not required for this phase's own completion.

---

## 6. Not in scope

- No change to `ScheduleTask`'s own real CRUD/status-transition routes
  beyond the one additive `scheduleId` field noted in §4.
- No `Schedule`-level status (per the original Phase 2 decision,
  unchanged).
- No redesign of the Gantt or Heat Map — both already read real data,
  untouched by this phase.
- No new schema work for `CanonicalStage` geometry/ports (ruled out by
  choosing option (c) over (b) in §3).

## 7. What this doc does NOT do

No route file, service file, repository file, or frontend component was
created or modified in this pass — scoping only, per the same
phase-gate discipline as every other phase.
