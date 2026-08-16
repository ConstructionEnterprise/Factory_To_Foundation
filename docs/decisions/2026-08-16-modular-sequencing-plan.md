# Modular Sequencing + Timeliner — Phase 2 Implementation Plan

**Status:** Phase 2.1 (`d4c9b5d`), Phase 2.2 (`b2d0dca`), and Phase 2.3
(frontend) all complete and live-verified in sandbox. **Revised (2026-08-16,
second pass)** after a real domain-boundary correction: v1 of this doc
anchored the schema directly on `LogisticsModule`, which made the
Timeliner structurally a Logistics model. It isn't one — see §0.5.

**Phase 2.3 live verification (2026-08-16):** 4th ribbon capability
(`Sequencing`, same `onClick`/`active` pattern as Map/Data Map/Estimating)
built and confirmed in the browser against the real local dev stack
(backend + frontend + Factory Runtime all up). Selecting Cedarwood Flats
renders the real CWF-B-089 entry under "Building B" with its real
`complete` status and the real 6-event history from the Phase 2.2 evidence
run (`pending → site_arrival → site_acceptance → installation → placement
→ complete`, real timestamps). The Timeliner renders that same real event
data as a horizontal status band. The "+ Add Module" picker correctly
shows "No real modules are eligible yet" for CWF-B-091 (still undelivered)
— the handoff gate holds in the UI, not just the API. No fabricated data
anywhere; every panel reads real backend state.

**Phase 2.2 evidence gate, real and sandbox-only (2026-08-16):** per
explicit instruction, no schema/backend work was trusted until a real
dispatch had actually crossed the handoff. Created one real test dispatch
for `LogisticsModule` CWF-B-089 through FF's own dispatch-creation API,
drove it `staged → in_transit → delivered` through the real state
machine (real `LogisticsCustodyEvent` trail, 3 rows). Then verified,
against the real live sandbox API:
- **Positive case:** `POST .../module-sequences` for CWF-B-089's
  `InventoryItem` succeeds once its dispatch is delivered.
- **Negative case:** the same call for CWF-B-091 (left undelivered as a
  control) is correctly refused — `"Cannot sequence this item until its
  real dispatch reaches 'delivered'"` — proving the handoff contract is
  enforced, not cosmetic.
- **Full lifecycle:** `pending → site_arrival → site_acceptance →
  installation → placement → complete`, driven via 5 real `PATCH`
  transitions, producing 6 real `ModuleSequenceEvent` rows (the
  Timeliner's actual future data source).
- **Guards:** a duplicate-entry attempt and a skip-ahead transition
  attempt (post-`complete`) were both correctly refused.

No relationships were invented at any point — every project/building/
dispatch link traces to real, already-existing data or data created
through FF's own real API.

**Read this before anything else, because the same misreading has
recurred twice already:** `InventoryItem` is a **domain-neutral
identity/reference layer**, used here exactly the way `Vehicle`/`Asset`/
`GenealogyNode` already use it. **This does not make Modular Sequencing
an Inventory feature.** Sequencing is a Construction Command Ribbon
capability with its own tables, its own routes, its own RBAC gating
(`construction`, not `inventory`), and no presence anywhere in the
Inventory UI. `InventoryItem.kind` is what supplies the real
"what kind of manufactured output is this" discriminator this plan
needs (today: `asset | genealogy_node | vehicle | logistics_module`; a
real Wall or Panel table, if one is ever built, gets its own kind the
same way) — that discriminator lives on `InventoryItem` because that's
where the shared-identity layer already lives, not because Sequencing is
secretly an Inventory concept underneath.

**Ownership, decided:** built in FF, as a new Construction Command Ribbon
capability — same pattern as Data Map/Estimating. Neither real CE-side
repo (CE_Forge: synthetic-data pipeline, spec phase, no UI;
Construction_Enterprises/Chappell_Robotics: robot-cell simulation) has a
product surface a sequencing feature could run in, so building it where
the real UI capability already exists is the only real option today.

**Domain boundary, decided (this revision):** Modular Sequencing /
Timeliner is a **Construction** feature, not a Logistics one. Logistics
Flow (internal FF movement — autonomous handling, staging, loading, truck
assignment) and Transportation (dispatch, the truck leaving FF, transit)
are both upstream and untouched. The Timeliner's domain begins at the
real handoff moment — a dispatch reaching `delivered` — and models only
what happens after: site arrival, site acceptance, installation,
placement, complete. It does not track movement; it tracks on-site
construction status.

```text
FG Digital Inventory → FF manufacturing → manufactured outputs (modules, walls, panels)
        │
        ▼
LOGISTICS FLOW (unchanged)              TRANSPORTATION (unchanged)
Receiving → Factory → Autonomous        Dispatch → Transit → Delivered
Handling → Staging → Load Assignment          │  (real handoff signal)
→ Loading → Transportation Handoff            ▼
                                    ┌─────────────────────────┐
                                    │   MODULAR SEQUENCING    │
                                    │   (Construction-owned)  │
                                    │                         │
                                    │ Site Arrival             │
                                    │ Site Acceptance          │
                                    │ Installation             │
                                    │ Placement                │
                                    │ Complete                 │
                                    └─────────────────────────┘
```

CE_Forge note, since it keeps getting collapsed to "the inventory
generator" in relayed summaries: it isn't. CE_Forge produces synthetic
data across multiple real domains (Logistics, Scheduling, Assets — see
`AI_Dispatch/CLAUDE.md`'s settled CE Forge/FF boundary) — it's unrelated
to the identity-layer discussion below beyond the fact that `InventoryItem`
happens to be one of the domains it could eventually seed data into. Not
relevant to this plan's actual content; noted so it doesn't get
mis-cited later.

---

## 0. Real investigation before writing schema

### 0.1 Three real, disconnected module/building identities

| System | Real data | What it represents |
|---|---|---|
| `LogisticsModule` (`schema.prisma:794`) | 2 real rows: `"Module CWF-B-089 (Cedarwood, Building B)"`, `"Module CWF-B-091 (Cedarwood, Building B)"`, both `location: "Yard Row 3..."`, both `dispatchId: null` | Logistics' own operational record: is it staged, has it shipped |
| `GenealogyNode` tier=`module` | 1 real row: `"Module M24-089"` (id `module-089`) | Compositional: what it's made of, lineage |
| `ConstructionTreeNode` tier=`Building` | Real rows per project (e.g. `cedarwood-building-b`, "Building B") | Site: where it physically goes |

None of these reference each other by real FK. `CWF-B-089`/`CWF-B-091`
and `M24-089` use entirely different naming conventions and nothing in
the real seeded data confirms whether any of them are even the same
physical module — not a gap closed by fabricating a match
(string-similarity guessing would be inventing a fact, not reading one).

### 0.2 `InventoryItem` — the real, domain-neutral identity layer

`GenealogyNode.module-089` already has a real `inventoryItemId`
(confirmed live: `cmsv4w9fe0014j0pki6l2zlfu`) — plugged into the shared
identity layer built during the Inventory/Fleet rollout specifically so
that **no single domain owns a cross-domain identity**: `Asset`,
`GenealogyNode`, `Vehicle` all link into `InventoryItem` today via the
same nullable, additive FK, and `InventoryItem` itself belongs to none of
Assets/Genealogy/Logistics — it's the neutral layer above all three.

**Extend it with a fourth kind:** `InventoryItemKind.logistics_module` +
`LogisticsModule.inventoryItemId` (nullable, same pattern as
`LogisticsTruck.vehicleId`/`Vehicle`). This does not merge `CWF-B-089`
and `M24-089` into one identity — each gets its own real `InventoryItem`
row unless a real human confirms they're the same module.

### 0.3 Real project + building assignment

`LogisticsModule` has no real, structured link to a project or building
today — only free text in `name` and an indirect, dispatch-dependent path
(`dispatchId` → `LogisticsDispatch.destinationProjectId`). Per-building
sequencing (decided — see the prior round's §4.2) requires a real
building link, so both get added as additive FKs:

```
LogisticsModule gains:
  constructionProjectId String?  -- FK -> ConstructionProject, nullable
  buildingTreeNodeId    String?  -- FK -> ConstructionTreeNode, nullable,
                                    service-layer-asserted to reference a
                                    real objectType="Building" row
```

### 0.4 The Timeliner's missing time-series data

`LogisticsCustodyEvent` (`schema.prisma:970`) is the closest real
precedent — a timestamped status-change audit trail — but only across
Dispatch's 3 coarse states. Nothing tracks any state past `delivered`
anywhere in FF today. Confirmed zero "Timeliner" references anywhere in
the codebase, zero charting library in `package.json`.

### 0.5 The real correction: Sequencing must not anchor on a Logistics table

v1 of this plan made `ModuleSequenceEntry.logisticsModuleId` (a direct FK
into `LogisticsModule`) the domain's primary key relationship. That's a
real design mistake, caught before implementation: it makes the
Construction-owned Timeliner structurally dependent on a Logistics table
— if Logistics ever reshapes `LogisticsModule`, or if a real element
needs sequencing without ever having gone through FF's own yard-staging
flow (a directly-procured wall panel, say), the domain has no way to
represent it.

**Fixed by reusing what §0.2 already introduces:** `ModuleSequenceEntry`
anchors on `InventoryItem`, not `LogisticsModule`. `LogisticsModule`
becomes one real, optional **provenance** source feeding that identity —
exactly the same relationship `Vehicle`/`Asset`/`GenealogyNode` already
have with `InventoryItem` today. None of those domains "own" InventoryItem
either; that's the entire point of the layer, and Sequencing should use
it the same way, not be the first consumer to bypass it.

---

## 1. The handoff contract

**Real trigger:** `LogisticsDispatch.status` transitioning to `delivered`
(`LogisticsCustodyEvent.toStatus = "delivered"`, already real, already
recorded). This is the one real signal that something has crossed from
Logistics/Transportation into Construction's domain — no new Logistics
schema needed to produce it.

**What crosses the handoff:** the real `InventoryItem` row(s) linked
(via §0.2) to whichever `LogisticsModule` row(s) had that dispatch as
their `dispatchId`. `InventoryItem` — not `LogisticsModule`, not the
dispatch itself — is the identity that enters Sequencing's domain.

**What Sequencing reads from Logistics, read-only, never duplicates:**
the dispatch id and its `delivered` timestamp, purely as a citation
("arrived via dispatch X on date Y") — same pattern
`flowPointResolution.ts` already uses to resolve a `transportation_handoff`
flow point's display without owning dispatch data itself.

**What Sequencing explicitly does not own:**
- Logistics Flow's 7-stage vocabulary or Dispatch's 3-state machine (both
  stay exactly as built, untouched).
- Truck, driver, or route data — referenced by id only when citing a
  handoff, never mirrored into Sequencing's own tables.
- Anything before `delivered` — staging, loading, transit are Logistics'
  real concerns, not the Timeliner's.

---

## 2. Domain model

### 2.1 New schema (additive only)

```
ModuleSequenceEntry
  id
  inventoryItemId       (FK -> InventoryItem)   -- the real, domain-neutral identity (§0.5) -- NOT LogisticsModule directly
  constructionProjectId (FK -> ConstructionProject)  -- resolved from the linked LogisticsModule's own new field (§0.3) at entry-creation time
  buildingTreeNodeId    (FK -> ConstructionTreeNode) -- same resolution; re-sequencing is explicit if a module's building assignment changes later
  status           ModuleSequenceStatus  @default(pending)
  -- Real, user-set installation order -- scoped PER BUILDING, unique
  -- within (buildingTreeNodeId), not global across the project.
  -- null = not yet sequenced.
  sequencePosition Int?
  -- Real citation only, never duplicated dispatch data (see §1).
  sourceDispatchId String?
  notes            String?
  createdAt, updatedAt

enum ModuleSequenceStatus {
  pending          -- exists in Sequencing's view (has a real InventoryItem link) but hasn't crossed the handoff yet
  site_arrival     -- first real post-handoff status; entry is only creatable once the source dispatch is real and delivered
  site_acceptance
  installation
  placement
  complete
}

ModuleSequenceDependency
  id, blockingEntryId (FK), blockedEntryId (FK)
  -- Real many-to-many blocker graph, same DAG-not-tree reasoning as
  -- GenealogyEdge.

ModuleSequenceEvent
  id, sequenceEntryId (FK)
  fromStatus ModuleSequenceStatus?, toStatus ModuleSequenceStatus
  changedById (FK -> User), changedAt, notes String?
  -- Same real audit-trail shape as LogisticsCustodyEvent/
  -- ScheduleTaskStatusEvent -- this table IS the Timeliner's real data
  -- source.
```

**A `ModuleSequenceEntry` cannot be created until its `InventoryItem` has
a real, delivered source dispatch** — enforced at the service layer, not
just documented. This is the handoff contract (§1) made real: Sequencing
can't get ahead of Logistics' own honest status.

**Explicitly not built:** a "position in space" field, a "% installed"
number, or any geometric tracking. The Timeliner shows real
status-over-time, not location-over-time, until something upstream
actually produces the latter.

### 2.2 New code

- Migration: `ModuleSequenceEntry`/`Dependency`/`Event` + status enum;
  additive `InventoryItemKind.logistics_module` +
  `LogisticsModule.inventoryItemId` (§0.2); additive
  `LogisticsModule.constructionProjectId` + `buildingTreeNodeId` (§0.3).
- `backend/src/repositories/moduleSequenceRepository.ts`,
  `.../services/moduleSequenceService.ts` — real status-transition state
  machine (same discipline as `logisticsDispatchService.ts`'s
  `VALID_TRANSITIONS`), writing a real `ModuleSequenceEvent` on every
  change. Entry creation asserts a real, delivered source dispatch (§2.1).
- `backend/src/routes/moduleSequences.ts` — `GET/POST
  /construction-projects/:id/module-sequences`, `PATCH
  /module-sequences/:id/status`, `PATCH .../position`, `POST
  .../dependencies`. Gated on `construction` RBAC module.

---

## 3. Frontend

### 3.1 Command Ribbon

```
Construction workspace
├── Map           (unchanged)
├── Data Map       (unchanged)
├── Estimating     (unchanged)
└── Sequencing     (new)
```

Fourth capability, same `onClick`/`active` pattern, same project-picker
reuse (`ConstructionDataMapBrowse` with `title="Sequencing"`).

### 3.2 Sequencing workspace (center)

Real per-project, per-building module list (grouped by
`buildingTreeNodeId`), each row showing real status, real blockers, and a
manual reorder control writing to `sequencePosition`. Selecting an entry
shows its real `ModuleSequenceEvent` history — same list-rendering
pattern as `FleetWorkspace`/`EventsWidget`.

### 3.3 Timeliner

A real horizontal timeline plotting each entry's `ModuleSequenceEvent`
transitions against time — status-over-time, not spatial animation (no
coordinates exist to animate). New, small component; not adapted from
Factory's illustrative Gantt (different real data source, different
disclosed-fixture posture). No new charting library for v1 — a real
SVG/CSS timeline over discrete status bands is sufficient for the actual
data shape.

---

## 4. Dependency graph and phased sequence

**Phase 2.1 — Shared identity extension (small, low-risk):**
2.1a `InventoryItemKind.logistics_module` + `LogisticsModule.inventoryItemId`
     + `constructionProjectId` + `buildingTreeNodeId`, sandbox-migrated,
     backfilled against the 2 real existing `LogisticsModule` rows
     (exact-count-assert, same pattern as every prior backfill).

**Phase 2.2 — Sequencing domain:**
2.2a Schema: `ModuleSequenceEntry`/`Dependency`/`Event` + status enum.
2.2b Backend: repository/service/routes, real status state machine,
     real handoff-contract enforcement (§2.1's creation assertion).
2.2c Sandbox-verify: create real entries for the 2 real `LogisticsModule`
     rows (once each has a real delivered dispatch — currently neither
     does; may need a real test dispatch created first), transition
     through real statuses, confirm events recorded.

**Phase 2.3 — Frontend:**
2.3a Ribbon capability + per-building module list/status/reorder/
     dependency UI.
2.3b Timeliner component over real `ModuleSequenceEvent` data.
2.3c Live-verify in browser.

**Not in Phase 2:** any change to Logistics Flow's vocabulary or
Dispatch's state machine; any geometric/spatial tracking; any auto-merge
of `LogisticsModule`↔`GenealogyNode` identities; any duplication of
truck/driver/route data into Sequencing's own tables.

---

## 5. Decisions on record

1. **Project assignment:** real, additive `LogisticsModule.constructionProjectId`
   now (not derived dynamically from dispatch history).
2. **Sequence scope:** per-building, not a flat per-project order.
3. **Primary anchor:** `InventoryItem`, not `LogisticsModule` directly
   (revised this pass — see §0.5). Genealogy linkage via `InventoryItem`
   stays optional enrichment either way.
4. **Domain ownership:** Construction, not Logistics. The handoff
   contract (§1) is the only real coupling to Logistics/Transportation,
   and it's read-only.
