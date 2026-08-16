# Modular Sequencing + Timeliner — Phase 2 Implementation Plan

**Status:** Draft for review, nothing implemented. Requires explicit
go-ahead before Phase 2.1, same discipline as every phase gate this
rollout.

**Ownership, decided:** built in FF, as a new Construction Command Ribbon
capability — same pattern as Data Map/Estimating. Neither real CE-side
repo (CE_Forge: synthetic-data pipeline, spec phase, no UI;
Construction_Enterprises/Chappell_Robotics: robot-cell simulation) has a
product surface a sequencing feature could run in, so building it where
the real UI capability already exists is the only real option today.

---

## 0. The real problem Phase 2's own plan doc (§8) already flagged, now investigated fully

The original Phase 1 plan doc recorded two known gaps for whoever picked
up Phase 2: the domain's real scale, and the Timeliner's missing
time-series data. Investigating further before writing any schema
surfaced a third, more fundamental one: **there is no single real "module"
identity to sequence.**

### 0.1 Three real, disconnected module/building identities

| System | Real data | What it represents |
|---|---|---|
| `LogisticsModule` (`schema.prisma:794`) | 2 real rows: `"Module CWF-B-089 (Cedarwood, Building B)"`, `"Module CWF-B-091 (Cedarwood, Building B)"`, both `location: "Yard Row 3..."`, both `dispatchId: null` | Operational: is it staged, has it shipped |
| `GenealogyNode` tier=`module` | 1 real row: `"Module M24-089"` (id `module-089`) | Compositional: what it's made of, lineage |
| `ConstructionTreeNode` tier=`Building` | Real rows per project (e.g. `cedarwood-building-b`, "Building B") | Site: where it physically goes |

None of these reference each other by real FK. `CWF-B-089`/`CWF-B-091`
and `M24-089` use entirely different naming conventions and nothing in
the real seeded data confirms whether any of them are even the same
physical module. This is not a gap that can be closed by fabricating a
match (string-similarity guessing "CWF-B-089 ≈ M24-089" would be
inventing a fact, not reading one) — it's a real, honest state of the
data, and Sequencing's design has to work with it rather than assume it
away.

### 0.2 What already exists to build on: `InventoryItem`

`GenealogyNode.module-089` already has a real `inventoryItemId`
(confirmed live: `cmsv4w9fe0014j0pki6l2zlfu`) — it's already plugged into
the shared identity layer built during the Inventory/Fleet rollout
specifically to unify fragmented real identities (`Asset`,
`GenealogyNode`, `Vehicle` all link into it today via the same nullable,
additive FK pattern). `LogisticsModule` does not yet.

**Recommendation:** extend `InventoryItemKind` with a fourth value,
`logistics_module`, and add `LogisticsModule.inventoryItemId` (nullable,
same pattern as `LogisticsTruck.vehicleId`/`Vehicle`). This is small,
additive, and consistent with infrastructure already proven three times
this rollout. **What it does not do:** merge `CWF-B-089` and `M24-089`
into one identity. They'd each get their own real `InventoryItem` row,
honestly separate, unless a real human confirms they're the same module
— that's a data-entry decision, not something Sequencing's schema should
silently assume.

**Practical consequence for the domain model (§1):** Sequencing anchors
on `LogisticsModule` as its primary real identity — it already carries
the yard/staging/dispatch context Sequencing cares about most (where is
it, has it shipped). Genealogy linkage stays a real, optional enrichment
via `InventoryItem`, surfaced when present, never required.

### 0.3 The Timeliner's missing time-series data — still true, now scoped concretely

`LogisticsCustodyEvent` (`schema.prisma:970`) is the closest real
precedent — a real, timestamped status-change audit trail — but only
across Dispatch's existing 3 coarse states (`staged`/`in_transit`/
`delivered`). Nothing tracks "where physically is this module" as a
continuous timeline, and nothing tracks any state past `delivered` — no
site arrival, site acceptance, installation, or placement event exists
anywhere in FF today. Confirmed zero "Timeliner" references anywhere in
the codebase (frontend or backend), and zero charting library in
`package.json`.

---

## 1. Domain model

### 1.1 What Sequencing owns (post-handoff only)

Per the boundary already settled: **Logistics owns movement data up to
Transportation Handoff; Sequencing consumes that as a real input and owns
everything after it.** Neither `LogisticsDispatch`'s 3-state machine nor
`LogisticsFlow`'s 7-stage vocabulary gets touched.

```text
LOGISTICS (unchanged, real input)         MODULAR SEQUENCING (new, real output)
staged → in_transit → delivered   ──────► Site Arrival
                                              ↓
                                           Site Acceptance
                                              ↓
                                           Installation
                                              ↓
                                           Placement
                                              ↓
                                           Complete
```

### 1.2 New schema (additive only)

```
ModuleSequenceEntry
  id, logisticsModuleId (FK -> LogisticsModule)
  constructionProjectId (FK -> ConstructionProject)
  -- Real dependency, not fabricated: which other entries must reach
  -- Complete before this one can start. Nullable/empty is a real state
  -- (nothing blocks it), not an omission.
  status         ModuleSequenceStatus  @default(pending)
  sequencePosition Int?  -- real, user-set installation order within the project; null = not yet sequenced
  notes          String?
  createdAt, updatedAt

enum ModuleSequenceStatus {
  pending            -- staged in Logistics Flow terms, not yet Sequencing's concern
  in_transit         -- mirrors LogisticsDispatch.status while dispatch is active (real, resolved via LogisticsModule.dispatchId)
  site_arrival
  site_acceptance
  installation
  placement
  complete
}

ModuleSequenceDependency
  id, blockingEntryId (FK), blockedEntryId (FK)
  -- Real many-to-many blocker graph, same DAG-not-tree reasoning as
  -- GenealogyEdge (a module's installation can legitimately depend on
  -- more than one predecessor).

ModuleSequenceEvent
  id, sequenceEntryId (FK)
  fromStatus ModuleSequenceStatus?, toStatus ModuleSequenceStatus
  changedById (FK -> User), changedAt, notes String?
  -- Same real audit-trail shape as LogisticsCustodyEvent/
  -- ScheduleTaskStatusEvent -- this table IS the Timeliner's real data
  -- source. Zero rows for an entry that's never transitioned is an
  -- honest empty state, not backfilled with invented history.
```

**Explicitly not built:** a "position in space" field, a "% installed"
number, or any per-module physical/geometric tracking. Nothing real
backs that today (no crane-placement system, no site-survey data) — the
Timeliner shows real status-over-time, not real location-over-time,
until something upstream actually produces the latter.

### 1.3 New code

- Migration: `ModuleSequenceEntry`, `ModuleSequenceDependency`,
  `ModuleSequenceEvent`, `ModuleSequenceStatus` enum; additive
  `InventoryItemKind.logistics_module` + `LogisticsModule.inventoryItemId`
  (§0.2).
- `backend/src/repositories/moduleSequenceRepository.ts`,
  `.../services/moduleSequenceService.ts` — real status-transition state
  machine (same "only real, listed next-states allowed" discipline as
  `logisticsDispatchService.ts`'s `VALID_TRANSITIONS`), writing a real
  `ModuleSequenceEvent` on every change, never a silent status flip.
- `backend/src/routes/moduleSequences.ts` — `GET/POST
  /construction-projects/:id/module-sequences`, `PATCH
  /module-sequences/:id/status`, `PATCH
  /module-sequences/:id/position` (reordering), `POST
  /module-sequences/:id/dependencies`. Gated on `construction` RBAC
  module, matching Data Map/Estimating.

---

## 2. Frontend

### 2.1 Command Ribbon

```
Construction workspace
│
├── Map           (unchanged)
├── Data Map       (unchanged)
├── Estimating     (unchanged)
└── Sequencing     (new)
```

Fourth capability, same `onClick`/`active` pattern, same project-picker
reuse (`ConstructionDataMapBrowse` with `title="Sequencing"`) already
used twice.

### 2.2 Sequencing workspace (center)

Real per-project module list (from `LogisticsModule`, filtered/joined via
real dispatch destination or an explicit project assignment — needs
confirming which real linkage exists first, see §4 open question 1),
each row showing real status, real blockers (unblocked/blocked-by-N),
and a manual reorder control writing to `sequencePosition`. Selecting a
module shows its real `ModuleSequenceEvent` history — reusing the exact
list-rendering pattern already proven in `FleetWorkspace`/`EventsWidget`
(real rows, honest empty state, no chart).

### 2.3 Timeliner

**Scoped honestly against what's real.** A real horizontal timeline
plotting each module's `ModuleSequenceEvent` transitions against time —
"what status was module X in, and when did it change" — not a spatial
animation (no coordinates exist to animate). Built as a new, small
component; not adapted from Factory's existing Gantt (that's an
illustrative manufacturing-instruction timeline, a different real data
source and a different disclosed-fixture posture). No new charting
library needed for v1 — a real, simple SVG/CSS timeline over discrete
status bands is sufficient for the actual data shape (a handful of
modules, a handful of status transitions each); revisit only if real data
volume ever demands more.

---

## 3. Dependency graph and phased sequence

**Phase 2.1 — Shared identity extension (small, low-risk):**
2.1a `InventoryItemKind.logistics_module` + `LogisticsModule.inventoryItemId`,
     sandbox-migrated, verified against the 2 real existing `LogisticsModule`
     rows (backfill script, same exact-count-assert pattern as every prior
     backfill this rollout).

**Phase 2.2 — Sequencing domain (the real core):**
2.2a Schema: `ModuleSequenceEntry`/`Dependency`/`Event` + status enum.
2.2b Backend: repository/service/routes, real status state machine.
2.2c Sandbox-verify: create real entries for the 2 real `LogisticsModule`
     rows, transition through real statuses, confirm events recorded.

**Phase 2.3 — Frontend:**
2.3a Ribbon capability + module list/status/reorder/dependency UI.
2.3b Timeliner component over real `ModuleSequenceEvent` data.
2.3c Live-verify in browser.

**Not in Phase 2:** any change to Logistics Flow's 7-stage vocabulary or
Dispatch's 3-state machine; any geometric/spatial placement tracking;
any auto-merge of `LogisticsModule`↔`GenealogyNode` identities.

---

## 4. Open questions for Joshua before Phase 2.1 starts

1. **How does a `LogisticsModule` row get assigned to a
   `ConstructionProject`?** Today it's only inferable indirectly (a
   module's name embeds a project reference as free text, e.g. "Cedarwood,
   Building B"; a module's `dispatchId`, once set, resolves to a real
   `destinationProjectId`). Neither is a real, structured FK today. Options:
   (a) add a real, additive `LogisticsModule.constructionProjectId` now
   (small schema change, resolves this cleanly), or (b) derive it
   dynamically from dispatch history and accept "no project yet" for an
   undispatched module (honest, but means an unshipped module can't be
   sequenced against a project until it has a real dispatch). Recommend
   (a) — flagged, not assumed.
2. **Should `sequencePosition` be a single global order per project, or
   per-building/per-phase?** Real `ConstructionTreeNode` data already has
   a real Building-level hierarchy per project; a flat per-project order
   may not match how installation is actually planned. No real data
   exists yet to answer this from usage — flagged for your call rather
   than guessed.
3. **Confirm the `LogisticsModule`-as-primary-anchor decision (§0.2/§1.1)**
   — Genealogy linkage via `InventoryItem` stays optional/enrichment only,
   not required to sequence a module. This matches what's real today (only
   1 of 2 real `LogisticsModule` rows would even have a plausible Genealogy
   counterpart), but worth confirming before it's load-bearing in the schema.
