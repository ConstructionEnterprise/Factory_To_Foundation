# Cross-Domain Projection — Formalized Architectural Pattern

**Status:** Formalized 2026-08-17 from real, working evidence, not designed
in the abstract. Three independent instances of the same pattern exist and
are live-verified: `Cost Intelligence → Analytics` (2026-08-17),
`Logistics Dispatch → Scheduling` (2026-08-17, Phase 2 Iteration 1),
`Modular Sequence → Scheduling` (2026-08-17, Phase 2 Iteration 2). This doc
documents the pattern *because* it already works three times, and produces
an honest interoperability map of where else it plausibly applies. **No new
projections are implemented in this pass** — this is documentation and
audit only, per explicit instruction.

## 0. The principle

> **One authoritative domain object → multiple domain projections.**

A domain owns its objects' state and write path. Other domains may
*project* that object's data, temporal history, or aggregate metrics into
their own UI **without creating a second source of truth**. Domain
ownership and cross-domain representation are different concerns — the
mistake this pattern exists to prevent is conflating "another domain can
see this" with "another domain now owns a copy of this."

## 1. The three contracts

### 1.1 Data Projection Contract

- The authoritative object remains owned and written by its native domain
  — the projecting domain never gets a create/update/delete path to it.
- The consuming domain reads the *same real API* the native domain's own
  UI uses — never a parallel read path, never a cached/duplicated copy.
- No new persisted rows are created in the consuming domain to represent
  the projected object. If a consuming domain needs to *derive* something
  from the projection (a rollup, a count), that derived value must be
  computed at read time, never stored as if it were itself authoritative.

**Real precedent:** `CostIntelligenceWidget` (`frontend/src/features/analytics/AnalyticsDashboard.tsx`)
calls `costIntelligenceApi.ts`, which wraps the exact same
`/market-cost-records`, `/productivity-records`, `/cost-assemblies`,
`/construction-projects/:id/quantity-takeoffs` routes Construction's own
future UI would use. `DispatchTimeline`/`ModularSequenceTimeline`
(`frontend/src/features/scheduling/`) call `logisticsOperationsApi.ts`/
`moduleSequenceApi.ts` directly — the same modules `LogisticsBrowse`/
`SequencingPanel` themselves use. Zero new backend routes were added for
any of the three projections; zero new Scheduling- or Analytics-owned
rows exist to represent Dispatch, Modular Sequence, or cost data.

### 1.2 Temporal Projection Contract

- Applies specifically to objects with a real event-transition history
  shaped `{ changedAt: DateTime, fromStatus?: TStatus, toStatus: TStatus }`.
- Render via the shared `frontend/src/lib/eventTimeline.ts`
  (`computeGlobalAxis`/`computeTimelineRow`) — proven generic across three
  real consumers now (Construction's `Timeliner.tsx`, `DispatchTimeline`,
  `ModularSequenceTimeline`), not a theoretical claim.
- The projecting domain (Scheduling, in both real cases so far) never
  becomes authoritative over the foreign object's timestamps or status —
  confirmed by a real, deliberate design choice: `DispatchTimeline` and
  `ModularSequenceTimeline` are both **read-only** strips, explicitly kept
  out of the drag-to-edit `ScheduleGantt` component, because dragging a
  bar there would imply Scheduling could rewrite a Dispatch's or Module
  Sequence Entry's real state — ownership it doesn't have.
- **Objects without a real event-transition history must not receive
  fabricated timestamps to force-fit this contract.** Confirmed live
  finding: `FlowPoint`/`FlowConnection` (Logistics Flow) have zero
  temporal fields anywhere besides `createdAt`/`updatedAt` —
  `positionX`/`positionY` are 2D canvas layout coordinates, not time.
  Logistics Flow is genuinely not eligible for this contract until it
  gains a real temporal/execution layer of its own (a Logistics-owned
  schema decision, out of scope here) — this is a disclosed upstream gap,
  not something to route around.

### 1.3 Navigation / Reselection Contract

- A projected representation should let the user return to the real
  authoritative object in its native domain, with as much context
  preserved as the target domain's own architecture actually supports.
- Prefer the existing `SelectionContext.setSelected()` + `navigate()`
  mechanism (`frontend/src/context/SelectionContext.tsx`) already used by
  `FactoryInspector.tsx`'s "View Robot X in Robotics →" — this is a real,
  pre-existing capability, not new infrastructure invented for this
  pattern.
- **Before implementing, inspect the target domain's existing selection
  architecture.** It is not uniform across FF, and asserting it is would
  be false:
  - **Logistics** fully participates in `SelectionContext` (materials,
    modules, dispatches are all selectable with a real composite
    `objectId`). `DispatchTimeline`'s click handler builds the
    byte-for-byte same payload shape `LogisticsBrowse`'s own
    dispatch-select path builds — confirmed live: clicking a projected
    dispatch in Scheduling lands on `/logistics` with the exact real
    record shown (same status, odometer, business purpose, timestamps),
    proving it's the same object, not a re-fetched approximation.
  - **Construction's Sequencing capability does not** participate in
    `SelectionContext` at all — capability + project + entry selection is
    plain component-local `useState` in `ConstructionPage.tsx`, with (as
    of 2026-08-17) only a minimal, real `?capability=sequencing&project=<id>`
    URL-param seed added for this pattern — confirmed live: it lands the
    user on the right project/tab but does **not** pre-highlight the
    specific entry, since that selection lives one level deeper than this
    pass reached.
- **If the target domain lacks the mechanism, record that as a real
  interoperability gap — do not invent a one-off bespoke navigation path
  to paper over it.** The minimal real URL-param seed added to
  `ConstructionPage.tsx` is the honest middle ground: a small, real,
  disclosed partial fix, not a full `SelectionContext` rewire (which
  would be a separately-scoped, larger change) and not a silent
  navigate-only downgrade (which would lose all context).

## 2. The three real, live-verified examples

| # | Authoritative object | Native domain | Projected into | Data Projection | Temporal Projection | Nav/Reselection |
|---|---|---|---|---|---|---|
| 1 | `CostAssembly`/`MarketCostRecord`/`ProductivityRecord`/`ProjectQuantityTakeoff` | Construction | Analytics | ✅ read-time, `costIntelligenceApi.ts` | N/A (not event-bearing) | N/A (dashboard widget, not a drill-through row) |
| 2 | `LogisticsDispatch` (+ `LogisticsCustodyEvent`) | Logistics | Scheduling | ✅ read-time, `logisticsOperationsApi.ts` | ✅ `eventTimeline.ts` | ✅ full — `SelectionContext` + navigate, same payload as native Browse |
| 3 | `ModuleSequenceEntry` (+ `ModuleSequenceEvent`) | Construction | Scheduling | ✅ read-time, `moduleSequenceApi.ts` | ✅ `eventTimeline.ts` | ⚠️ partial — URL-seeded project+tab only, entry not pre-highlighted |

## 3. FF Interoperability Map

Columns: authoritative domain/object · potential consuming domain(s) ·
existing projection (if any) · projection mechanism · target's real
selection/navigation capability · missing contract(s) · currently
buildable without new backend work.

| Authoritative object | Consuming domain(s) | Existing projection | Mechanism | Target selection capability | Missing contract(s) | Buildable now? |
|---|---|---|---|---|---|---|
| `LogisticsDispatch` | Scheduling | **Built** (this doc §2.2) | Data + Temporal + full Nav | Logistics: full `SelectionContext` | none | — |
| `ModuleSequenceEntry` | Scheduling | **Built** (this doc §2.3) | Data + Temporal + partial Nav | Construction Sequencing: partial (URL-seeded) | Full entry-level reselect (real gap, disclosed) | Partially — would need Sequencing's own `SelectionContext` participation, a separate scoped change |
| `CostAssembly`/`MarketCostRecord` etc. | Analytics | **Built** (this doc §2.1) | Data only (not event-bearing) | N/A (dashboard shape) | none for current shape | — |
| `ScheduleTask` (+ `ScheduleTaskStatusEvent`) | Analytics | **Already exists**, predates this pattern's formalization — confirmed real: `ANALYTICS_METRIC_CATALOG` includes `scheduling.statusEvents.count` (`backend/src/lib/analyticsCatalog.ts`) | Data + Temporal, aggregate-count shape only (not per-task drill-through) | Scheduling: full `SelectionContext` | A per-task (not just aggregate-count) Analytics drill-through isn't built, though the target has the selection capability to support one | Yes, if wanted — same shape as Cost Intelligence |
| `InstructionExecution` (Factory) | Analytics (aggregate, exists) / Scheduling (not built) | Analytics: **already exists** (`factory.executions.count`, `factory.executions.failureRate` in the same catalog) | Data only, aggregate | Factory: uses `SelectionContext` (confirmed via `FactoryInspector.tsx`) | Confirmed real shape mismatch: `InstructionExecution.executedAt` is a single discrete moment (`{executedAt, ok}`), not a `{fromStatus,toStatus,changedAt}` transition stream — the Temporal Projection Contract's segment-based renderer doesn't directly fit; a point-marker timeline would be a different, unbuilt visualization | Data projection into Scheduling: yes. Segment-style temporal projection: no, would need a different renderer, not `eventTimeline.ts` as-is |
| `LogisticsCustodyEvent` (via Dispatch) | Analytics | **Already exists**, predates this formalization: `logistics.custodyEvents.count` in the same catalog | Data + Temporal, aggregate-count only | Logistics: full `SelectionContext` | Per-dispatch drill-through into Analytics isn't built | Yes, if wanted |
| `FlowPoint`/`FlowConnection` (Logistics Flow) | Scheduling | None, and **genuinely blocked** | — | Logistics: full `SelectionContext` (so Nav would be easy) | **Temporal Projection Contract cannot be satisfied** — confirmed zero real temporal fields exist on either model | No — needs a real Logistics-owned temporal/execution model first, not a Scheduling-side workaround |
| `ProjectFile` / `LogisticsDocument` | Any domain needing document attachment | None — and these are **two separate, non-unified authoritative models for the same underlying concept** (confirmed: `ProjectFile` is hard-FK'd to `ConstructionProject`+`treeNodeId` only; Logistics deliberately built its own separate `LogisticsDocument` rather than reuse `ProjectFile`) | — | — | **Data Projection Contract's own precondition is violated** — there is no single authoritative source to project from; unifying the two models is itself the prerequisite work, not a projection | No — this is a real, separate, larger migration, not a projection candidate as things stand |
| `GenealogyNode` | Inventory (ribbon capability), Construction | Genealogy already appears as a peer ribbon capability inside Inventory (Assets \| Genealogy) | **Different pattern** — this is intra-domain capability composition (the same pattern Phase 3/Inventory is about), not cross-domain projection of an object into a foreign domain's own UI shape | N/A | Not a gap — just a different, already-documented pattern (see `project_ff_inventory_fleet_rollout` memory); don't conflate the two | N/A |

## 4. What this map is for

Nothing in §3 marked "Buildable now? Yes" is being built in this pass.
The map exists so a future iteration can pick a real, evidenced next
target instead of guessing — and so anything marked "No" is understood as
a real upstream gap (Logistics Flow's missing temporal layer, Documents'
unmerged duplication) rather than something the next projection attempt
should quietly work around.

See also `2026-08-16-modular-sequencing-plan.md` (Timeliner's origin),
`2026-08-16-analytics-observability-phase3-plan.md` (the metric catalog
this doc's §3 cites).
