# Scheduling — Phase 2.3: Backend Routes + Frontend Wiring — Scoping

**Status:** **Complete and live-verified**, 2026-08-16 — backend
(`0d4e7d3`) and frontend (`22bf99d`). Backend live-smoke-tested against
real sandbox data (real S1–S4 listing/detail, real stage create/reorder,
validation rejects). Frontend live-verified in the browser: all 4 real
schedules list in Browse, selecting one renders its real stages
node-to-node with real per-stage task status, clicking a node highlights
it and populates the Inspector, Gantt/Heat Map (already real) unaffected.
Typecheck and production build both clean, zero runtime console errors.

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

## 3. Decided (2026-08-16): the canvas becomes schedule-aware, node-to-node stays

**Joshua's explicit call, superseding the three options originally
presented here:** the viewport keeps the real node-to-node visual —
boxes connected by wires — but it needs to render *whichever real
schedule is selected*, not the fixed 5-stage fixture. Selecting a node
populates the Inspector with that real node's detail, same as today.

**Why this doesn't require fabricating anything, once decomposed
correctly:** the original concern (§3 as first drafted) was that
`FunctionBlockCanvas` needs stored `x`/`y`/named ports and the new
`ScheduleStage` model has neither. But node-to-node flow doesn't
actually require *stored* geometry or *typed* ports — only real order,
which already exists (`ScheduleStage.position`):

- **Layout is computed, not stored.** X/Y per node is a deterministic
  function of its real `position` index (the same left-to-right spacing
  the old fixture used) — rendering real order visually, not persisting
  or inventing coordinate data.
- **Wires are real sequence, not fabricated ports.** A connector from
  stage N to stage N+1 in real `position` order reflects a relationship
  that already exists in the data. This replaces the old rich
  typed/named BOOL-port system (which was real only for the 5 fixed
  global stages) with one generic in/out connection point per node — a
  rendering convenience, not a new real data concept, so nothing new is
  asserted as real backend state.
- **Node detail is real, already-shaped data.** Clicking a node emits
  the exact same `SelectionContext` payload shape `ScheduleInspector.tsx`
  already renders today (name/description/`ownedByModule`/status) —
  sourced from the real `ScheduleStage` + its real linked `ScheduleTask`.

**What this replaces from §3's original three options:** none of (a)/
(b)/(c) as drafted — this is closer to (a) in spirit (the canvas becomes
real per-schedule data) but keeps the node-to-node visual form (a)
would have dropped. `CanonicalStage` stays exactly as scoped (§1.3 of
the schema plan) — real reference data, not required to have geometry
of its own; the canvas no longer needs a schedule-independent fallback
view since it now always renders whichever real schedule is selected.

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

- **`scheduleApi.ts`** (new file — `Schedule` is a real distinct concept
  from `ScheduleTask`): `fetchSchedules()`, `fetchScheduleDetail(id)`
  (returns the schedule + its real `ScheduleStage[]`, position-ordered,
  each with its real linked task summary), `createSchedule()`,
  `createStage()`, `reorderStages()`, `fetchCanonicalStages()` (feeds a
  real dropdown when creating a stage, same "pick from a real fixed
  catalog, never free-text" precedent as Analytics Phase 3's metric
  picker).
- **`ScheduleBrowse.tsx`**: rewired to fetch real `Schedule[]` and
  render each schedule's real `ScheduleStage[]` as children, using each
  stage's own real `id` directly (§2 — no composite-id workaround
  needed). Selecting a schedule is what drives which schedule the canvas
  (below) renders. Real "+ New Schedule" affordance, same
  create-form-in-panel pattern as `SequencingPanel`/`CostEstimatingPanel`.
- **`FunctionBlockCanvas.tsx`/`FunctionBlockNode.tsx`: made
  schedule-aware, node-to-node visual kept** (Joshua's explicit call,
  §3). Real changes:
  - Input data shape changes from the old fixture's `ScheduleNodeData`
    (stored `x`/`y`/named ports) to a real `ScheduleStage[]`
    (`id`/`title`/`position`/its real linked task).
  - **Layout is computed, not stored**: `x = position * GAP, y = 0`,
    same spacing constant the old fixture used — a deterministic
    rendering of real order, not new persisted or fabricated data.
  - **Wires connect consecutive real stages** in `position` order (stage
    N's output anchor → stage N+1's input anchor) — one generic in/out
    connection point per node, replacing the old named/typed BOOL-port
    system (which was only ever real for the 5 fixed global stages).
    This is a rendering simplification, not a new real data concept —
    nothing is asserted as real backend state that isn't.
  - **Selecting a node** emits the same real `SelectionContext` payload
    shape `ScheduleInspector.tsx` already renders (name/description/
    `ownedByModule`/status), sourced from the real `ScheduleStage` and
    its real linked `ScheduleTask` — `ScheduleInspector.tsx` itself
    needs no changes.
  - **No schedule selected**: an honest empty state ("select a schedule
    to see its real stages"), not a fallback to the old fixture — the
    canvas no longer has a schedule-independent default view.
- **`ScheduleLayout.tsx`**: fetches the selected schedule's real detail
  (via `SelectionContext`'s current schedule, from Browse) and passes
  its real stages into the now-schedule-aware canvas.
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
