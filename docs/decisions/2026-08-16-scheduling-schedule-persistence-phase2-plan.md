# Scheduling — Schedule/Step Real Persistence (Phase 2) — Decision & Implementation Plan

**Status:** Decisions made, plan written. **Not implemented — this doc is
the artifact required before any schema work starts**, per explicit
instruction. Phase 1 (fixture + UI, no schema) shipped 2026-08-12,
commit `e8083a1`. Phase 2 was deliberately deferred at that time — "prove
the UX with the fixture first, then design real persistence based on
what's proven." This doc is that design pass.

**Provenance:** the architectural decisions below were proposed by
ChatGPT (relayed by Joshua, 2026-08-16) after being shown this session's
own prior scoping question. Each decision is restated here with the real
empirical evidence that confirms or complicates it — not accepted
uncritically. Where the evidence changed the shape of a decision (it did,
once — see §3), that's called out explicitly.

---

## 0. Real state, confirmed live against sandbox (not assumed)

Two separate, unmerged real layers exist in the schema today, plus one
frontend fixture. Queried directly against `ff-postgres-sandbox`
2026-08-16:

**Layer 1 — `ScheduleStage`/`SchedulePort`/`ScheduleWire` (pipeline
taxonomy):** **zero rows in all three tables.** This resolves an
uncertainty flagged in `docs/SYNTHETIC-DATA-RECONNAISSANCE.md` §12 item 6
("genuinely unclear... whether they have real seeded rows at all") —
now confirmed: **they don't.** The "5 canonical stages" (Inbound
Material, Material Arrival, Sub-Assembly & Module Production, Module
Storage & Logistics, Construction Schedule) exist **only** in the
frontend fixture `scheduleData.ts` (`scheduleNodes`/`scheduleWires`,
real ports/wires, no execution engine) — never in the database.

**Layer 2 — `ScheduleTask`/`ScheduleTaskDependency`/
`ScheduleTaskStatusEvent` (real task instances):** **29 real rows**, real
and writable. Queried directly:
- 2 pre-existing rows with no group prefix: "Material Inbound", "Equipment
  Inbound" (likely manual `ScheduleTaskForm.tsx` test data, predates this
  redesign).
- 27 rows from the 2026-08-12 CE Forge boundary experiment, in 4 real
  title-prefixed groups: **S1 Material-to-Module** (6 tasks: Inbound
  Material, Material Arrival, Material Inspection, Kitting, Sub-Assembly,
  Module Production), **S2 Module Logistics** (7 tasks: Production
  Complete, QC Release, Yard Staging, Load Planning, Dispatch,
  Transportation, Site Arrival), **S3 Site Installation** (7 tasks:
  Module Delivery, Crane Setup, Foundation Complete, Module Set, Site
  Ready, Connections, Inspection), **S4 Project Delivery** (7 tasks:
  Preconstruction, Procurement, Factory Production, Logistics, Site
  Construction, Commissioning, Closeout).
- **`stageId` is null on all 29 rows, no exceptions.** Not one real task
  references a `ScheduleStage` row — consistent with Layer 1 being
  completely empty.
- Real status distribution across all 4 enum values: 23 `planned`, 1
  `blocked`, 2 `in_progress`, 3 `complete`. `ScheduleTaskStatus` is real,
  active, and exercised.
- 23 real `ScheduleTaskDependency` edges, 39 real `ScheduleTaskStatusEvent`
  audit rows.

**This confirms and sharpens ChatGPT's core claim.** It wasn't just that
S1–S4's step vocabularies don't match the 5 canonical stage names
(true — "Kitting," "QC Release," "Crane Setup," "Commissioning" appear
nowhere in the 5-stage fixture). The 5 canonical stages don't exist as
real rows *at all* today, so there was never a real global taxonomy S1–S4
could have reused even if their step names had matched.

---

## 1. Decisions on record

### 1.1 `Schedule` becomes a first-class Prisma model

**Decided: yes**, not a `scheduleId`/`groupId` field bolted onto
`ScheduleTask`. The real S1–S4 naming convention is exactly the evidence
ChatGPT pointed to: CE Forge was already simulating an entity ("a
schedule") the schema doesn't represent, via a title-prefix convention
alone. A real model gives that concept a real identity, a real place to
attach metadata, and a real thing a future UI can list/rename/delete —
none of which a bare grouping column would support.

**Genuinely still open, not decided by the relayed message either (its
own wording was conditional — "project association if Scheduling is
project-scoped"):** does `Schedule` get a real `constructionProjectId`?
No evidence either way in the real S1–S4 data — the task titles read like
manufacturing-pipeline schedules ("Material-to-Module," "Module
Logistics"), not construction-project schedules, and nothing in
`ScheduleTask` links to `ConstructionProject` today. **Left unresolved
here — flagging for an explicit answer before schema work, not assumed
either direction.**

Fields, per the relayed decision, plus one addition explained in §3:

```prisma
model Schedule {
  id          String   @id @default(cuid())
  title       String
  createdById String   @map("created_by_id")
  createdBy   User     @relation(fields: [createdById], references: [id])
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  // constructionProjectId String? -- open question, see above; add only
  // once answered, not speculatively.

  stages ScheduleStage[]
  tasks  ScheduleTask[]  // see §3 -- a direct link, not solely via stage

  @@map("schedule")
}
```

No `status` field — per decision 1.4 below, only added if a real
schedule-level lifecycle (distinct from its tasks' own statuses) is
actually identified. None has been yet.

### 1.2 `ScheduleStage` becomes schedule-scoped

**Decided: yes**, and the empirical data makes this closer to a
formality than a judgment call — there were never any real global stage
rows to reuse in the first place (§0). Real design:

```prisma
model ScheduleStage {
  id         String @id @default(cuid())
  scheduleId String @map("schedule_id")
  schedule   Schedule @relation(fields: [scheduleId], references: [id], onDelete: Cascade)

  title    String
  position Int      // real ordering -- doesn't exist as a column today;
                     // the 5-stage fixture orders by array position/x
                     // coordinate, neither of which is real stored data

  ownedByModuleId String? @map("owned_by_module_id")
  ownedByModule   Module? @relation(fields: [ownedByModuleId], references: [id])

  /// Optional link to the preserved 5-stage taxonomy -- see §1.3. Null
  /// for any stage that isn't one of the 5 canonical pipeline steps
  /// (e.g. a real "Kitting" or "QC Release" stage would stay null here).
  canonicalStageId String?         @map("canonical_stage_id")
  canonicalStage   CanonicalStage? @relation(fields: [canonicalStageId], references: [id])

  tasks ScheduleTask[]

  @@map("schedule_stage")
}
```

`SchedulePort`/`ScheduleWire` are unaffected by this change structurally
(they still hang off `ScheduleStage` by FK) — but since zero real rows
exist for either, whether to carry them forward at all is a real
secondary question, not addressed by the relayed decisions and not
assumed here either. They aren't referenced by anything in Phase 2's
real scope (no real port/wire data exists to migrate), so the
recommendation is to leave them exactly as they are (unused, real, still
in the schema) rather than touch them in this pass.

### 1.3 Preserve the 5-stage concept as optional canonical taxonomy

The relayed decision offered this as a conditional ("if the five Phase 1
stages represent a useful canonical vocabulary, preserve that
separately"). Real call needed here, since it means real new seed data
that doesn't exist today:

```prisma
model CanonicalStage {
  id    String @id @default(cuid())
  title String @unique
  order Int

  stages ScheduleStage[]

  @@map("canonical_stage")
}
```

Seeding this with the 5 real fixture names (Inbound Material, Material
Arrival, Sub-Assembly & Module Production, Module Storage & Logistics,
Construction Schedule) would be the first time they become real database
rows rather than only a frontend fixture. **This is a real, disclosed
scope decision, not free** — worth confirming rather than building by
default, since nothing in the real S1–S4 evidence actually needed it (all
27 real tasks organize into 4 schedules with their own step vocabularies,
none touching the 5 canonical names).

### 1.4 `ScheduleTask` keeps its existing status enum

**Decided: yes, no change.** `ScheduleTaskStatus`
(`planned`/`in_progress`/`complete`/`blocked`) is real, already
transition-guarded at the service layer, already exercised (§0's real
status distribution), and is the same pattern later carried into
`LogisticsDispatch` and `ModuleSequenceEntry`. Nothing about Phase 2
requires a new enum. If a real `Schedule`-level lifecycle is identified
later, it gets its own real enum then — not invented speculatively now.

### 1.5 Cost Estimating v2 — formally deferred, not implementation work

Per the relayed decision: labor/equipment/subcontractor/regional-factor
breakdown, or a target-price mode, stays **deferred until real rate data
exists to back it.** Recorded as a formal decision in
`docs/decisions/2026-08-16-construction-data-map-cost-estimating-plan.md`
§7 (updated alongside this doc — see that file's own changelog note).

### 1.6 Cross-project Logistics/Fleet analytics widget — not building

Per the relayed decision: marked **"Proposed / not currently justified,"**
not an active deferred item to keep re-evaluating. Same doc, same section.

### 1.7 Analytics dashboard visibility — formalized, not just assumed

Per the relayed decision: **dashboards are shared within the authorized
`analytics:read` audience, not user-private.** This was already the
implementation (`docs/decisions/2026-08-16-analytics-observability-phase3-plan.md`
§3.3), flagged there as an assumed default rather than a formal decision
— now formalized as a real decision in that doc's own changelog note.
Not revisited unless a real private-dashboard need actually appears.

---

## 2. The real gap the S1–S4 mapping test found

This is the empirical check explicitly requested before any migration —
mapping the 29 real `ScheduleTask` rows against the proposed
`Schedule → ScheduleStage → ScheduleTask` hierarchy.

**It mostly works, with one real structural gap:** if `Schedule`
membership is only derivable *transitively*, through `ScheduleTask.stageId
→ ScheduleStage.scheduleId`, then **none of the 29 real tasks could be
assigned to a schedule**, because `stageId` is null on every single one
(§0). The S1–S4 grouping that exists today is encoded *only* in a title
prefix — a real, human-readable convention, but not a real foreign key
anywhere.

**Resolution: `ScheduleTask` needs its own direct, nullable
`scheduleId`**, not solely inference through stage — mirroring the exact
optionality `stageId` already has today (a task can be "in a schedule but
not yet assigned a stage," the same honest-empty-state shape as "not yet
assigned a stage" itself):

```prisma
model ScheduleTask {
  // ...existing fields, unchanged...
  scheduleId String?   @map("schedule_id")
  schedule   Schedule? @relation(fields: [scheduleId], references: [id])
  stageId    String?   @map("stage_id")  // now points at a schedule-scoped stage
  stage      ScheduleStage? @relation(fields: [stageId], references: [id])
}
```

Without this, the proposed model would be a prettier schema that still
couldn't represent the one real dataset that exists to test it against —
exactly the failure mode the mapping exercise was meant to catch.

**What a real migration would do with the 29 existing rows** (not
executed in this pass):
- Create 4 real `Schedule` rows, titled exactly from the real prefixes
  already in use: "S1 Material-to-Module," "S2 Module Logistics," "S3
  Site Installation," "S4 Project Delivery" — read from the data, not
  invented.
- Backfill `scheduleId` on the 27 prefixed tasks by parsing each title's
  real `S\d+ ` prefix (same honest-parsing-not-guessing pattern already
  used for the `LogisticsModule` backfill this session).
- Leave "Material Inbound" and "Equipment Inbound" (the 2 unprefixed
  rows) with `scheduleId = null` — no real evidence assigns them to any
  schedule, so none is invented.
- **Not** auto-create `ScheduleStage` rows for each task's implied step
  ("Kitting," "QC Release," etc.). That's a real, separate leap — turning
  27 different step *names* into 27 real stage *rows* with real
  `position` ordering is inventing structure the title-prefix convention
  alone doesn't establish (unlike the schedule-level grouping, which the
  prefix does establish directly). **Left as a real open question**,
  not silently done: does Phase 2 populate real stages for the existing
  CE Forge data, or does stage assignment stay `null` (same honest-empty
  discipline as today) until a real user or a future CE Forge pass
  organizes real stages deliberately?

---

## 3. Contradictions with the current schema and Phase 1 UI

Per the explicit instruction to surface these rather than discover them
mid-migration:

1. **Phase 1's `ScheduleBrowse.tsx` reads `scheduleData.ts`'s fixture
   exclusively** (`ScheduleDefinition`/`schedules`, one hand-authored
   "Schedule 1" referencing all 5 stage ids). Building the real backend
   in this phase does **not** automatically wire the UI to it — that's a
   real, separate follow-on phase (2.x: frontend), same two-step pattern
   every other domain in this rollout has followed (schema+backend
   first, live-verified via direct API calls; UI wiring as its own
   gated sub-phase). Not assumed to happen for free.
2. **The Function Block canvas currently renders the 5 fixture stages
   globally**, regardless of which "schedule" is conceptually selected.
   Once `ScheduleStage` is schedule-scoped, a canvas showing "the 5
   stages" stops being well-defined without first picking a schedule —
   a real UI/UX question for the eventual frontend phase, not something
   this schema-only pass resolves.
3. **`AnalyticsDashboard.tsx`'s `SchedulingWidget`** currently reads
   `scheduleNodes.length`/`scheduleWires.length` (the fixture) labeled
   "Structural Facts — Not Live." If/when Phase 2's real
   `ScheduleStage`/`Port`/`Wire` data exists, this widget would need its
   own follow-on update to read the real table instead — flagged so it
   isn't forgotten, not in this pass's scope.
4. **Phase 1's Step row id is deliberately the raw stage id, not a
   composite**, specifically so selecting a step keeps driving the same
   cross-panel highlight in the Function Block canvas. Once stages are
   schedule-scoped (multiple schedules could plausibly have
   differently-shaped stage sets), that id scheme needs revisiting in
   the eventual frontend phase — noted, not resolved here.

---

## 4. What this doc does NOT do

Per the explicit "do not implement yet" instruction: no schema file was
changed, no migration was generated, no data was touched for anything in
§1.1–§1.4/§2. (§1.5–§1.7 are documentation-only decisions already
reflected in their respective docs — no code changes there either.)

## 5. Genuinely open questions requiring an explicit answer before implementation

1. Does `Schedule` get a real `constructionProjectId`? (§1.1)
2. Is `SchedulePort`/`ScheduleWire` carried forward as-is (real, unused
   for now) or reconsidered? (§1.2)
3. Is `CanonicalStage` built at all, given no real data currently needs
   it? (§1.3)
4. For the 27 existing real CE-Forge-generated tasks: does this migration
   also populate real `ScheduleStage` rows for their implied steps, or
   leave `stageId` null until a real future organizing pass? (§2)
