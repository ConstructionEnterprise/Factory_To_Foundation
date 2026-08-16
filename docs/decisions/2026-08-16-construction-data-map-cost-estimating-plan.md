# Construction Data Map + Cost Estimating — Validated Implementation Plan

**Status:** Plan only, nothing implemented. Requires explicit go-ahead
before Phase 1 (and a separate go-ahead before Phase 2, same discipline as
the Inventory/Fleet rollout's own phase gates).

**Source of truth:** validated directly against the real FF codebase
(`C:\Dev\Factory_Foundation_design_pass`) via two parallel Explore-agent
audits plus direct schema inspection, in response to a Manus AI-drafted
"CE/FF Consolidated Synthesis and Implementation Steering Plan." Every
claim below traces to a real file:line, not to the Manus document's own
claims.

**Second relayed plan, reviewed and partially adopted (2026-08-16):** a
follow-up Manus AI document ("FF Construction + Operations Implementation
Run") expanded scope to six capabilities (adds Modular Sequencing + a
required Timeliner, and an Analytics integration phase) and proposed a
resolution for the Logistics/Dispatch boundary tension this plan flagged:
**don't extend Logistics Flow or Dispatch themselves — build Modular
Sequencing as a new domain that consumes their real output as input.**
That resolution is sound and is recorded in §7 for whenever Sequencing
gets its own go-ahead. Two of that document's other claims don't hold up
against real data and were **not** adopted — see §6 items 2-3 and §7/§8
for what was kept, what was rejected, and why.

---

## 0. Scope decision

The Manus document proposed five capabilities. Validation found:

| Capability | Real status |
|---|---|
| Construction Enterprises Map | **Already fully built**, same name, `features/construction/ConstructionMap/ConstructionMap.tsx:1206` |
| Construction Data Map | **Proposal only** — no code exists, but the pattern to build it (CommandRibbon capability switch) is proven twice already |
| Cost Estimating | **Proposal only** — zero existing model or UI anywhere |
| Modular Sequencing | **Proposal only, and mis-scoped** — the doc calls it a CE deliverable, but neither real CE-side repo (CE_Forge: synthetic-data pipeline, spec phase, no UI; Construction_Enterprises/Chappell_Robotics: robot-cell simulation) has any product surface a sequencing UI could live in |
| Logistics Flow Data | **Real, but narrower by deliberate design** — stops at Transportation Handoff on purpose |
| Dispatch Data | **Real, but coarser by deliberate design** — closed 3-state machine, not the doc's proposed 11 states |

**This plan covers only the two items that are genuinely buildable now
without reopening a settled architectural boundary: Construction Data Map
and Cost Estimating.**

**Explicitly deferred, not silently dropped:**
- **Modular Sequencing** — no real home for it exists on the CE side today. Building it would mean either (a) building it as an FF feature despite the doc's CE-ownership framing, or (b) CE_Forge/Construction_Enterprises first growing an actual product surface. Neither is this plan's call to make — flagged as an open question in §6.
- **Extending Logistics Flow past Transportation Handoff** (transit/site arrival/site acceptance/installation) — would reopen the explicit "Logistics Flow gets the asset onto the truck; Transportation gets the truck to the site" boundary decided earlier this rollout. Not proposed here.
- **Extending Dispatch's status granularity** beyond `staged/in_transit/delivered` — same reasoning; the 3-state machine was a deliberate design choice, not an oversight.

---

## 1. Construction Data Map

### 1.1 What's real to build on

`ConstructionProject` already has real FK relations (`backend/prisma/schema.prisma:332-349`):
- `site ConstructionSite?`
- `treeNodes ConstructionTreeNode[]`
- `files ProjectFile[]`
- `logisticsDispatches LogisticsDispatch[]` — and via Phase 3's Fleet work, each dispatch now resolves to a real `Vehicle` too.

**What's explicitly NOT real and won't be fabricated:** `GenealogyNode`'s
`Project` tier (`schema.prisma:491-509`) is a bare title string, not an FK
to `ConstructionProject`. There is no real link today between a
Genealogy module DAG and the construction project it's destined for.
Showing "which modules are genealogically linked to this project" would
require either fuzzy title-matching (fragile, will misrepresent data) or
a new additive FK (`GenealogyNode.constructionProjectId`, nullable, same
pattern as `InventoryItem`/`Vehicle`'s own additive links) — **a real
schema decision, listed in §6, not assumed here.**

### 1.2 Design — reuse the proven ribbon capability-switch pattern

Same shape as Inventory (Assets/Genealogy) and Logistics (Fleet), both
built and production-verified this rollout:

- `ConstructionPage.tsx` gains `extraMenus`: `Map | Data Map`, using
  `CommandRibbon`'s existing `onClick`/`active` shape
  (`framework/ui/CommandRibbon.tsx`) — no new ribbon mechanism.
- `mode === "map"` (default, unchanged): today's existing
  `ConstructionMap`/`ConstructionDocumentViewer` toggle, untouched.
- `mode === "dataMap"`: new `ConstructionDataMap` capability — a
  project-centric relationship view, not a generic graph.

**v1 scope, honest about what's real:** selecting a project shows its
real site info, real tree hierarchy (Buildings → Units), real document
count, and real inbound Logistics — every dispatch whose
`destinationProjectId` matches this project, each resolved to its real
vehicle (via Phase 3's `LogisticsDispatch.vehicleId` → `Vehicle`), status,
route, and ETA. This directly answers real operational questions ("what's
headed to this project, on what, and when") using only relationships that
already exist in the schema — no new relationship data invented to fill
out a screen.

### 1.3 New code (additive only, no schema change for v1)

- `backend/src/repositories/constructionRepository.ts` (or extend the
  existing one) — a real query joining `ConstructionProject` →
  `logisticsDispatches` → `vehicle`, `truck`, `destinationProject` in one
  call, mirroring the resolution pattern `flowPointResolution.ts` already
  uses for transportation_handoff.
- `GET /construction-projects/:id/relationships` — real route, gated on
  the existing `construction` RBAC module.
- `Factory_To_Foundation/frontend/src/features/construction/DataMap/` —
  `ConstructionDataMapBrowse.tsx` (project picker, reusing
  `ConstructionPage`'s existing project tree data), `ConstructionDataMapView.tsx`
  (the relationship panel — real site/tree/dispatch/vehicle detail, no
  fabricated graph layout), `ConstructionDataMapInspector.tsx` (selected
  dispatch/vehicle detail, reusing `SelectionContext`'s existing `fleet`
  payload shape from Phase 3).

No Prisma migration needed for v1 — every relationship it shows already
exists as a real FK.

---

## 2. Cost Estimating

### 2.1 What's real to build on

Nothing — confirmed zero existing model, route, or UI anywhere in FF.
This is genuinely net-new, unlike Construction Data Map.

### 2.2 Design — scenario model, reproducible math, real traceability

Per the Manus doc's own framing (which holds up on this point): a
scenario must have explicit, reproducible assumptions, not a single
opaque total. V1 scope, deliberately smaller than the doc's full field
list (labor/equipment/subcontractor/regional-factor breakdown is a real
v2 candidate, not invented here without real rate data to back it):

```
CostEstimateScenario
  id, projectId (FK -> ConstructionProject), name, createdAt, createdById
  squareFootage        Float     -- real, entered, never guessed
  ratePerSquareFootCents Int     -- real, entered (e.g. 14500 = $145.00/SF)
  overheadPercent       Float?   -- nullable, honest absence if not set
  markupPercent         Float?
  notes                 String?
  -- totalCents is ALWAYS derived (squareFootage * rate, then
  -- overhead/markup applied), never stored independently -- same
  -- "never accept a derived number from the client" discipline as
  -- LogisticsDispatch.miles.
```

A project can have multiple scenarios (comparison is just listing them
side by side — no separate "comparison" model needed for v1). Every
scenario is real, persisted, and re-editable; nothing is a fire-and-forget
calculation.

### 2.3 New code

- Migration: `CostEstimateScenario` model, FK to `ConstructionProject`,
  nullable `overheadPercent`/`markupPercent`/`notes` (honest-absence
  pattern, not defaulted).
- `backend/src/repositories/costEstimateRepository.ts`,
  `backend/src/services/costEstimateService.ts` (real derivation of
  `totalCents` server-side, same "server always derives, client never
  supplies" discipline as `recordMileage()`), `backend/src/routes/costEstimates.ts`
  — `GET/POST /construction-projects/:id/cost-estimates`, `PATCH
  /cost-estimates/:id`, gated on `construction` RBAC module (`create`
  action for POST/PATCH).
- `Factory_To_Foundation/frontend/src/features/construction/CostEstimating/`
  — `CostEstimatingPanel.tsx` (scenario list + create/edit form),
  reached via the same `extraMenus` ribbon: `Map | Data Map | Estimating`.

---

## 3. Command Ribbon shape (both features together)

```
Construction workspace
│
├── Map           (existing, unchanged — Construction Enterprises Map)
├── Data Map       (new — §1)
└── Estimating     (new — §2)
```

Matches the standing FF UI rule: sidebar = domain (Construction stays one
sidebar entry), CommandRibbon = capability, workspace = view. Neither new
capability becomes a new sidebar item or a nested sub-page.

---

## 4. Dependency graph and phased sequence

Cost Estimating has zero dependency on Construction Data Map or vice
versa — they can ship in either order or in parallel. Recommended
sequence, lower-risk first:

**Phase 1 — Construction Data Map (no migration, additive route only):**
1.1 Backend: relationship-resolution route.
1.2 Frontend: ribbon entry + three-panel capability view.
1.3 Sandbox-verify, live-verify in browser, commit/push.

**Phase 2 — Cost Estimating (real migration, real writes):**
2.1 Schema + migration (sandbox first, same discipline as every migration
    this rollout — snapshot, diff, deploy, verify).
2.2 Backend routes/service (server-derives totals, never trusts client
    math).
2.3 Frontend scenario list/create/edit UI.
2.4 Sandbox-verify, live-verify, commit/push.

**Not scheduled in this plan (§0's deferred list):** Modular Sequencing,
Logistics Flow chain extension, Dispatch granularity extension.

---

## 5. Acceptance gates

| Gate | Required outcome |
|---|---|
| Ribbon placement | `Data Map`/`Estimating` use the existing `onClick`/`active` CommandRibbon shape, not a bespoke toggle |
| Data integrity | Data Map shows only relationships backed by real FKs (`logisticsDispatches`, `treeNodes`, `site`, `vehicle`) — no fabricated graph edges |
| Cost integrity | Scenario totals are always server-derived from `squareFootage`/`rate`/`overhead`/`markup`; never client-supplied |
| Reuse | No parallel navigation mechanism, no duplicate `ConstructionProject`/`LogisticsDispatch` read path |
| Verification | typecheck → build → sandbox exact-count/behavior verify → real browser verify → commit → push, per phase, matching this rollout's own established discipline |
| Honesty | Any relationship genuinely absent (e.g. Genealogy↔Construction linkage) is shown as absent, never inferred by name-matching |

---

## 6. Architectural decisions awaiting approval

Not decided here — listed so they don't get silently assumed mid-build:

1. **Should `GenealogyNode` gain a real, additive `constructionProjectId`
   FK** (same pattern as `InventoryItem`/`Vehicle`), so Construction Data
   Map could eventually show "which real modules are destined for this
   project"? Not in v1's scope either way — v1 ships without it, honestly
   scoped to what's real today.
2. **Where does Modular Sequencing actually belong**, given neither real
   CE-side repo has a UI surface for it today? **Partially resolved:** the
   second relayed plan drops the original "CE owns it" framing without
   saying so and folds it straight into Construction's own Command
   Ribbon as an FF capability — which matches reality (no CE-side surface
   exists) better than the original claim did. Still open: whether to
   build it now or treat it as its own separately-gated run. This plan
   takes no position on timing — see §7.
3. **Cost Estimating's v2 field set** — **the second relayed plan's
   proposal was reviewed and rejected as designed.** It proposes the user
   picks a *target* price ($145/SF) and "FF develops the corresponding
   cost structures underneath" it — reverse-deriving a labor/material/
   equipment/sub breakdown to justify an arbitrary target. That requires
   real unit-cost rate data (labor rates, material rates, equipment
   rates, regional factors) to derive from. **None of that exists
   anywhere in FF today** — confirmed via the same audit that validated
   this plan. Built as described, it would either need someone to source
   real cost-rate data first (not in scope, not mentioned in that plan),
   or it fabricates a plausible-looking breakdown to hit the target
   number — the exact kind of fabrication this whole rollout has
   deliberately avoided everywhere else (Dock Utilization stays "no dock
   model yet" rather than inventing a percentage; Logistics `traffic`
   stays a disclosed placeholder). **v1 stays the flat rate/SF model in
   §2.2** (user enters known SF + rate, server multiplies) — this is the
   honest floor. A target-price-to-cost-structure mode is a legitimate
   v2 idea, but only once real unit-cost rate data actually exists to
   derive from — not before.

---

## 7. Modular Sequencing + Timeliner — deferred, own run, not this one

Not in scope for this plan. Recorded here so the shape that's already
been reasoned through doesn't get re-litigated from scratch when it does
get picked up.

**The one part of the second relayed plan worth keeping verbatim:**
*"Logistics owns the movement data. Modular Sequencing consumes that
movement as part of the construction installation sequence."* This
resolves the boundary tension cleanly — Logistics Flow's 7-stage
vocabulary and Dispatch's 3-state machine both stay exactly as they are,
untouched. A new Sequencing domain (new Prisma models, new routes, new
feature folder) would read `LogisticsDispatch`/`Vehicle`/`FlowPoint` as
real inputs and own everything past Transportation Handoff itself —
staging, site arrival, site acceptance, installation, placement — without
either domain being rewritten to accommodate the other.

**Two real, non-trivial gaps neither relayed plan called out clearly
enough, that any future Sequencing plan needs to scope explicitly, not
discover mid-build:**

1. **Scale.** This isn't one more Command Ribbon button — it's a full new
   domain (schema + backend + frontend), materially bigger than
   Construction Data Map and Cost Estimating combined. It deserves its
   own validated plan doc and its own phase gate, the same way Inventory
   and Fleet each got one this rollout, not a line item inside this one.
2. **The Timeliner needs time-series data that doesn't exist yet.**
   "Scrub through time, see where each module physically was" requires a
   real position-over-time record per module. The closest real thing
   today is `LogisticsCustodyEvent` — a status-change audit trail across
   only the existing 3 coarse dispatch states, not a continuous location
   timeline. Building the Timeliner as described means designing and
   populating that time-series model *first*, as its own real subphase —
   not treating it as a visualization layer over data that already
   exists.

**Not decided by this doc:** whether Sequencing gets built at all, and if
so, whether as an FF-owned Construction capability (what the second
relayed plan implies by folding it into the Command Ribbon) or held until
CE_Forge/Construction_Enterprises has a real product surface for it (the
original Manus doc's framing). Flagged for Joshua's call — see §6 item 2.

---

## 8. Analytics integration — deferred

The second relayed plan adds an Analytics phase (sequencing/logistics/
dispatch/cost metrics) after Sequencing and Cost Estimating exist. The
sequencing logic is sound — Analytics can't honestly surface metrics for
data that doesn't exist yet, and this rollout's own Analytics work
(Phase 1A, earlier this rollout) already established the "real data or an
honest disclosed placeholder, never a fake number" discipline any new
Analytics metrics here would need to follow. Not scoped in this plan
since it depends on §7 (Sequencing) landing first at minimum, and
possibly on §2's Cost Estimating maturing past its v1 flat-rate model.
Revisit once Sequencing has a real go-ahead.
