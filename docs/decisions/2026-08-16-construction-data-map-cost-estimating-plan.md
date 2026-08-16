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
   CE-side repo has a UI surface for it today? Options: (a) build it in
   FF despite the doc's CE-ownership framing, (b) treat it as blocked
   until CE_Forge or Construction_Enterprises grows an actual product
   surface, (c) revisit whether "CE owns it" was ever a technically
   meaningful statement versus a business-ownership one. This plan takes
   no position — flagged for Joshua's call, same as the original
   Inventory/Fleet plan's own §5.
3. **Cost Estimating's v2 field set** (labor/equipment/subcontractor/
   regional-factor breakdown) — deferred until real rate data exists to
   back it; v1's flat rate-per-SF is deliberately the honest floor, not
   the ceiling.
