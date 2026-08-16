# Inventory / Fleet / Analytics / Reports — Validated Implementation Plan

**Status:** Phase 0 decisions locked 2026-08-15 (see below). Phase 1
execution in progress. Phase 2 (Inventory — real data migration, route
retirement) requires an explicit go-ahead before starting; everything
before it is additive and doesn't touch existing working routes.
**Source of truth:** The evidence-based validation of the Manus AI review
completed earlier in this session (four parallel codebase investigations —
Inventory/Assets/Genealogy, Fleet/Autonomous Dolly, Analytics/CloudFront UX,
Reports vs. Construction documents). Every "current state" claim below
traces to a specific file/line found during that validation, not to the
Manus review's own claims. Sections 1-6 below are that original analysis,
kept intact as background/rationale — read "§5 Architectural Decisions
Awaiting Approval" as historical framing of the choices; §0.1 below records
what was actually decided.
**Constraint that applies throughout:** the CE Forge / FF boundary settled
in `AI_Dispatch/CLAUDE.md` (2026-08-15) — CE Forge and FF are independent
systems with one disclosed, gated data-population integration; provenance
(a record's origin) is never the same thing as integration dependency
(one system needing another at request time). This constrains how
Inventory may represent CE-Forge-sourced data — see §1.

---

## 0.1 Phase 0 — Locked decisions (2026-08-15, supersedes §5's open questions)

- **Inventory:** build it as a first-class FF domain absorbing Assets and
  Genealogy — option (a) from §1, via a **controlled migration**
  (snapshot → migrate → count → compare → verify → *then* retire the old
  routes, never delete-first). Target shape: Browse / Search / Assets /
  Genealogy / Lifecycle / Locations / Service / Relationships.
- **Genealogy:** becomes an Inventory capability. The orphaned real DAG
  (13 nodes / 12 edges) becomes the authoritative source, replacing
  `graphData.ts`'s fixture — this happens *before* the Inventory migration
  (Phase 1), so Genealogy has one real working data path before it's ever
  folded into anything else.
- **Fleet — corrected framing, important:** Fleet is **not** a child route
  nested under Logistics Flow. Fleet is a **sibling of Logistics Flow**
  within the Logistics domain — both are peer views a user reaches from
  Logistics' own command ribbon, the same way `Operations`/`Logistics Flow`
  already sit as peer modes today. Concretely: **Fleet becomes its own
  ribbon menu item on the Logistics page's `CommandRibbon`, next to
  `Metrics` and `Filters`** — via `FeaturePage`'s existing `extraMenus`
  prop (the same mechanism Factory's "Instructions" menu already uses,
  `FeaturePage.tsx`'s `extraMenus: RibbonMenu[]`), not nested inside the
  `Filters` dropdown's Operations/Logistics Flow toggle. Vehicle class
  hierarchy: `Trucks` / `Autonomous Dollies` / `Trailers` / `Forklifts` /
  future classes, owning identity, vehicle class, lifecycle, location,
  status, maintenance, availability.
- **Fleet Tasks:** generalize the existing `LogisticsDispatch` state
  machine (add a vehicle-type discriminator) rather than building a second,
  competing task system — reuses the already-working
  `staged → in_transit → delivered` model and real mileage tracking.
- **Analytics/Reports/Administration shell:** extend `SimplePage`
  deliberately (it's shared by all three) rather than migrating Analytics
  to `FeaturePage`. Use the existing `CommandRibbon`/`Workspace` pattern as
  the UX *reference*, not a mechanical requirement.
- **Reports search:** metadata/filename search only for V1 (`query` +
  `project` + `category` + `date range`, `projectId` optional *only* on
  this new search endpoint — Construction's existing project-scoped
  behavior stays untouched). Full-text content indexing is explicitly V2,
  out of scope for this rollout.
- **Networking → API (new scope, not one of the original four validated
  areas):** a first-class `API` capability under the existing `Networking`
  domain — `Overview` / `Connections` / `Providers` / `Endpoints` /
  `Health`. V1 is the architecture and an honest integration registry
  (`Connected` / `Available` / `Planned` / `Not Configured` per real
  provider — Revit, Navisworks, Bluebeam, ForemanAI, n8n), not five
  working integrations.
- **Rule throughout:** no feature is "done" because the UI renders — every
  Phase 1+ item needs code → database → API → UI → real data → browser
  verification, the same discipline already used for the Logistics Flow
  work earlier this session. Sandbox-first for anything touching real
  data; exact-count verification before/after any migration.

---

## 0. Real dependency graph (not the naive Inventory → Fleet → Analytics → Reports order)

Four things actually couple these areas together, discovered from the code,
not assumed:

1. **Analytics, Reports, and Administration share one shell component**
   (`SimplePage`, `framework/ui/SimplePage.tsx`) — its own doc comment
   names all three as its intended consumers. **A UX-shell decision for
   Analytics is really a decision about `SimplePage` itself**, and any
   change there has a direct sibling effect on Reports and Administration,
   whether or not their own domain work changes at all.
2. **Fleet's canonical entity shape depends on the Inventory decision, not
   the reverse.** If Inventory becomes FF's canonical object/asset layer,
   Fleet vehicles are a natural specialization of Inventory items
   (vehicle-specific fields — dispatch history, driver assignment — layered
   on a shared identity/lifecycle/location shape). Designing Fleet's schema
   before Inventory is decided risks a second migration later to fold
   `LogisticsTruck`/Fleet into Inventory. **Inventory must be decided (even
   if the decision is "not now") before Fleet's real schema is designed.**
3. **Analytics' data completeness is gated on Inventory/Fleet being real,
   not on Analytics' own UX-shell work.** `AnalyticsDashboard.tsx`'s own
   disclosure text currently excludes Logistics, Assets, and Robotics
   because their KPIs are "fixture placeholders, not real" — this is
   already stale for Assets specifically (the real `Asset` model and a
   real CE-Forge-seeded 30-row dataset existed before this session even
   started; commit `025de8b`), a small, independent fix. The UX-shell
   question (§0.1) and the data-completeness question (§0.3) are separable
   and can proceed in parallel.
4. **Reports' document-search work is independent of Inventory/Fleet
   entirely** — it's a `ProjectFile`/Construction-domain concern with no
   schema coupling to Assets, Genealogy, or Logistics. Its only coupling to
   the rest of this plan is #1 (it shares `SimplePage`).

**Practical ordering implication:** the `SimplePage` shell decision (§3) and
Reports' backend search work (§4) can start immediately and don't block on
anything else. The Inventory decision (§1) is the actual long pole — it
gates Fleet's real design (§2) and part of Analytics' eventual data
completeness (§3), even though it doesn't block Analytics' or Reports'
near-term work.

---

## 1. Inventory

### Current state
No `/inventory` route, page, folder, or nav item exists anywhere in the
frontend (`routes.tsx`'s 13 routes and `pageOptions.ts` both confirmed —
no Inventory entry in either). Assets (`/assets`) and Genealogy (`/`) are
separate top-level peers today with zero code coupling — neither folder
imports the other.

`Asset` (schema.prisma) is real: flat table, no FK relationships at all,
no parent/container concept. Populated via a real, executed CE Forge
generator (`assets-equipment/generator.js`, 30 real rows, 2026-08-12) —
note `assets-equipment/manifest.json` is stale and still says
`FIXTURE_ONLY`, contradicted by the real generator/batch files next to it.

`GenealogyNode`/`GenealogyEdge` (schema.prisma) model a real materials-chain
DAG and are **real but orphaned**: 13 nodes / 12 edges seeded directly via
`backend/prisma/seed.ts` (not through any API), **zero backend routes read
or write this table**, and the live frontend renders a completely separate
hand-authored fixture file (`features/genealogy/graphData.ts`) instead —
confirmed by grep: zero `fetch`/`authFetch`/`BACKEND_URL` calls anywhere in
the Genealogy frontend feature. CE Forge's own README for this domain
states `REAL_ORPHANED`, `populationCount: 0`, `"blocked-pending-decision"`.

### Target state (proposed by Manus, not yet a decision)
A first-class `/inventory` FF domain unifying assets, equipment, materials,
vehicles, robots, and their lifecycle/location/relationship/service data —
with Genealogy folded in as a capability rather than a peer nav item.

### Architectural decision required
**Should Inventory exist at all, and if so, does it absorb Assets and
Genealogy, or coexist alongside them?** Three real options, not evaluated
by the Manus review:
- (a) Build Inventory as the canonical layer; migrate Assets' real data and
  Genealogy's real (currently orphaned) data into it; retire the two old
  routes.
- (b) Build Inventory as a new capability that *references* Assets and
  Genealogy by real FK, without absorbing/retiring either.
- (c) Don't build Inventory; instead fix Genealogy's orphaned-data problem
  on its own (wire the real DAG to a real route, retire the disconnected
  fixture) without any new top-level domain.

This document does not recommend (a)/(b)/(c) — see §5, this is listed as
an approval-required decision.

### Database/schema changes (if (a) or (b) is chosen)
- New `Inventory`-equivalent model (or a shared base identity table Assets/
  Genealogy/Fleet all reference) — shape depends entirely on which of (a)/
  (b)/(c) is chosen.
- Genealogy: either add the missing route layer to make the real DAG live
  (independent of the Inventory decision — this is a real bug regardless),
  or fold `GenealogyNode`/`GenealogyEdge` into whatever Inventory becomes.
- Per the CE Forge boundary: any provenance field added should reuse the
  existing `SyntheticDataProvenance` side-table pattern (already built,
  already used by Assets/Logistics/Scheduling), not a new bespoke
  `sourceSystem` column on the Inventory model itself — keeps provenance
  and domain ownership as separate concerns, matching the settled boundary.

### Backend/API changes
- (a)/(b): new `inventory` route file(s), RBAC module (new `inventory`
  permission set, or reuse `assets`'s existing seeded grants if Assets is
  absorbed).
- (c): one new route pair (`GET`/`POST /genealogy-nodes`,
  `/genealogy-edges` or equivalent) to make the real seeded data reachable
  at all — currently impossible even for internal tools.

### Frontend/UI changes
- (a): retire `/assets` and Genealogy's `/` route in favor of `/inventory`;
  rebuild `AssetsBrowse`/`AssetsMap`/`AssetsInspector` and
  `GenealogyBrowser`/`RelationshipGraph` as Inventory sub-views or tabs.
- (b): new `/inventory` page that cross-references Assets/Genealogy by id,
  no changes to the existing two pages' own routes.
- (c): swap Genealogy's `graphData.ts` fixture import for a real API call
  once the route exists — smallest possible change, no nav/route changes.

### Data migration requirements
- (a) only: real migration of 30 Asset rows and 13/12 Genealogy rows into
  new Inventory tables, with a rollback plan (this repo's own established
  discipline — see the `ff-postgres-dev-pre-synthetic-cleanup` snapshot
  precedent — apply the same "snapshot first, exact-count-assert after"
  pattern).
- (b)/(c): no data migration, only new read paths.

### Dependencies
Gates Fleet's real schema design (§0.2). Independent of Analytics' shell
work (§3) and Reports' search work (§4).

### Risks
- (a) is the highest-risk option: touches two existing, working production
  routes and their real data, for a domain that doesn't exist yet in any
  form. Given this repo's own "empty is honest, a fabricated row is not"
  discipline and its prior real incident with an accidentally-shared
  database, this is exactly the kind of change that needs a sandbox
  rehearsal before touching anything real, matching the pattern already
  used for the Asset domain build.
- (c) alone (fix Genealogy's orphaned data without building Inventory) is
  low-risk and independently valuable regardless of the Inventory decision
  — it's arguably a pre-existing bug, not new scope.

### Verification/tests
No automated test suite exists in this repo (confirmed in earlier CE Forge
reconnaissance) — verification is live, targeted API queries and browser
checks, same discipline used for the Logistics Flow work earlier this
session: build in sandbox, verify exact row counts before/after, verify in
the actual browser UI, only then consider production.

### Recommended implementation order
1. Decide (a)/(b)/(c) — human decision, see §5.
2. If (c) is chosen (as a floor, regardless of the larger decision): wire
   Genealogy's real route — small, low-risk, fixes a real existing gap.
3. If (a)/(b): design the shared identity shape, sandbox-build, verify,
   then migrate.

### Classification
Deciding (a) vs (b) vs (c): **A — required architectural foundation.**
Fixing Genealogy's orphaned route (the (c) floor, independent of the
larger decision): **B — required implementation** (it's a real gap
regardless of what else is decided).
Full Inventory domain build (a/b): **D — deferred until §5 approval.**

---

## 2. Fleet / Autonomous Dollies

### Current state
No `Fleet` model, route, or feature exists anywhere — only one doc-comment
fragment in schema.prisma and a cosmetic `"Fleet / Transportation"` display
label in an unrelated Assets fixture file (`assetsData.ts`). `"autonomous_
handling"` is one of seven free-text `FlowPoint.type` suggestions
(confirmed `String`/`z.string()`, not an enum, in both Prisma and the Zod
validator) — not a modeled entity with its own identity or lifecycle.
`LogisticsTruck` is flat (`{id, identifier, dispatches}`), no subtype or
discriminator field. No `FleetTask` model exists; `LogisticsDispatch` is
the only task-like model in Logistics and is hard-FK'd to `LogisticsTruck`
specifically — there is currently only one vehicle model to begin with, so
"spans vehicle classes" isn't structurally possible yet.

### Target state (proposed by Manus, not yet a decision)
Fleet as the parent vehicle class; Autonomous Dollies as a Fleet
subcategory; Fleet Tasks as a dispatchable-task concept spanning vehicle
classes (trucks, dollies, and whatever else joins later).

### Architectural decision required
**What is the canonical Fleet entity model, and does it live under
Inventory (§1) or stand alone in Logistics?** Concretely:
- Does `LogisticsTruck` become a Fleet subtype, or does Fleet wrap it via a
  new parent table with `LogisticsTruck` as a foreign-keyed specialization?
- Is a real "Autonomous Dolly" record needed (its own identity, status,
  location, lifecycle), or does the existing `FlowPoint` mechanism (already
  shipped, already real, already resolves `load_assignment` points to real
  `LogisticsTruck` ids per this session's earlier Logistics Flow work)
  remain sufficient for representing dolly *movement*, with a separate
  real Dolly *asset* record only needed if dollies need independent
  status/maintenance tracking outside of any specific movement?
- Should `FleetTask` be a genuinely new polymorphic model, or should
  `LogisticsDispatch` be generalized (add a discriminator/vehicle-type
  field) rather than duplicating a second task concept alongside it?

### Database/schema changes
- A `Fleet`/`Vehicle` parent model with a class/discriminator field
  (`truck` | `autonomous_dolly` | future classes), OR a shared base table
  if Inventory (§1) is chosen as the umbrella — **this is why §0.2's
  ordering matters: building this before §1 is decided risks redoing it.**
- If Fleet Tasks are real: either a new `FleetTask` model with a polymorphic
  vehicle reference, or `LogisticsDispatch.truckId` generalized to a
  `vehicleId` + `vehicleType` pair (smaller, reuses the existing real
  staged→in_transit→delivered state machine and mileage-tracking work
  already built and working in production).
- Migration of existing `LogisticsTruck` rows (currently real, in both
  sandbox and production — including "Flatbed 7," confirmed shared
  lineage) into whatever the new shape is, without breaking existing
  `LogisticsDispatch` FKs.

### Backend/API changes
New/changed routes depending on the schema decision — either a new
`fleet-vehicles`/`fleet-tasks` route pair, or extensions to the existing
`logistics-trucks`/`logistics-dispatches` routes to accept a vehicle-type
discriminator. RBAC: likely reuses the existing `logistics` permission
module rather than a new one, since Fleet is a Logistics concept in the
Manus framing.

### Frontend/UI changes
- `LogisticsDispatchForm.tsx`'s truck picker becomes a vehicle-class-aware
  picker.
- `AddFlowPointForm.tsx`'s `load_assignment` picker (built this session,
  currently resolves to `LogisticsTruck` only) would need to resolve
  across vehicle classes too, once more than one exists.
- Possible new "Fleet" browse/inspector panels, or an extension of the
  existing Logistics Operations mode.

### Data migration requirements
Real migration of existing `LogisticsTruck`/`LogisticsDispatch` rows —
same "snapshot first, exact-count-assert after" discipline as §1.

### Dependencies
Blocked on §1's outcome for its canonical shape (§0.2). Not blocked by
Analytics or Reports.

### Risks
Touches the one Logistics subsystem already live in production with real
dispatch data (including the demo chain built earlier this session,
referencing the real "Flatbed 7" truck) — any schema change here needs the
same sandbox-first verification already established as this repo's working
pattern.

### Verification/tests
Same live-verification discipline as §1 — no automated suite exists.

### Recommended implementation order
1. Resolve §1 first (or explicitly decide Fleet proceeds independently of
   Inventory, accepting the rework risk).
2. Decide `FleetTask` vs. generalized `LogisticsDispatch` (smaller, reuses
   more).
3. Sandbox-build, verify, migrate.

### Classification
Canonical Fleet entity model decision: **A — required architectural
foundation.** Full Fleet/vehicle-class build: **D — deferred**, gated on
§1 and on the decision above.

---

## 3. Analytics

### Current state
Analytics (`AnalyticsPage.tsx`) uses `SimplePage`, not the `FeaturePage`/
`CommandRibbon`/`Workspace` pattern Logistics/Factory/Construction use.
`SimplePage`'s own doc comment states it's a **deliberate third shared
shell** for "pages that don't fit FeaturePage's Browse/Viewport/Selected
Workspace shape... Analytics, Reports, and Administration" — not an
oversight. It does reuse `CommandRibbon` (same page-identity bar,
Settings/Account menus) via `SimplePage`, but has no Metrics/Filters ribbon
dropdowns, no three-panel `Workspace`, no `react-resizable-panels`, and no
`useResponsiveMode`/`useViewportTier` integration — its only responsiveness
is plain Tailwind grid breakpoints (`md:grid-cols-2 xl:grid-cols-3`) on a
flat 10-card CSS grid.

Data is mostly real (aggregates real APIs from Factory/Scheduling/twin
state, with explicitly self-disclosed non-live structural data for
Genealogy/Construction/Scheduling-graph widgets) — no dedicated
`analyticsApi.ts` exists; it's a read-only aggregator over other domains'
existing APIs. Its own disclosure text excludes Logistics/Assets/Robotics
as "fixture placeholders, not real" — **this is stale for Assets
specifically**, since the real `Asset` model and 30 real rows already
existed before this session (§1).

### Target state
Per Joshua's own correction of the Manus framing (established earlier this
session): CloudFront's existing UX conventions are the *reference*, not a
mechanical requirement that Analytics literally become a `FeaturePage`.
Target state is Analytics presenting its real data through a genuinely
consistent interaction grammar with the rest of FF — not necessarily
identical component usage.

### Architectural decision required
**Does `SimplePage` get extended (add optional Metrics/Filters ribbon
dropdowns, add responsive-mode awareness) so Analytics/Reports/
Administration all gain more of the canonical pattern without becoming
`FeaturePage` consumers, or does Analytics specifically migrate to
`FeaturePage`/`Workspace` outright?** Because `SimplePage` is shared by
three pages (§0.1), extending it benefits Reports and Administration too;
migrating only Analytics to `FeaturePage` leaves Reports/Administration
behind and creates two divergent "secondary" patterns instead of one.

### Database/schema changes
None — this is presentation-layer only.

### Backend/API changes
None required for the shell decision itself. Separately (and smaller):
update the stale "fixture placeholder" disclosure text for Assets now that
it's real, and wire an Assets widget using the existing real `assetsApi.ts`
— independent, low-risk, doesn't wait on the shell decision.

### Frontend/UI changes
Depends entirely on the decision above:
- Extend `SimplePage`: add optional `toolbar`/`kpis` props mirroring
  `FeaturePage`'s, add `useResponsiveMode` awareness to its layout.
- Migrate to `FeaturePage`: rebuild `AnalyticsDashboard`'s flat card grid
  as `left`/`center`/`right` panels, which may not fit a dashboard's
  actual shape well (this is likely why `SimplePage` was built as a
  deliberate third pattern in the first place — worth weighing before
  assuming migration is strictly better).

### Data migration requirements
None.

### Dependencies
Independent of §1/§2 for the shell decision. The *data-completeness* half
(showing real Fleet/Inventory KPIs once they exist) is gated on §1/§2.

### Risks
Changing `SimplePage` affects Reports and Administration whether or not
their own domain work changes — needs to be tested against all three
consumers, not just Analytics.

### Verification/tests
Live browser verification across all three `SimplePage` consumers after
any shell change.

### Recommended implementation order
1. Fix the stale Assets disclosure text + wire a real Assets widget — small,
   independent, can happen immediately.
2. Decide extend-`SimplePage` vs. migrate-to-`FeaturePage`.
3. Implement the shell decision, verify against Reports/Administration too.

### Classification
Stale Assets disclosure fix: **B — required implementation** (small, real
gap, no dependency). Shell decision (extend vs. migrate): **A — required
architectural foundation.** Full shell rebuild: **C — enhancement**, not
blocking any other domain's real functionality.

---

## 4. Reports

### Current state
Reports (`ReportsLibrary.tsx`) has **zero document search capability of
any kind** today. It's three cards: a Mileage Tax Report (Logistics
dispatch data), a live Collision Report (in-memory twin collision log,
cleared on reload), and a Manufacturing instruction-sequence viewer
(in-memory `ManufacturingOutputContext`) — none touch construction
documents. No backend search endpoint exists, cross-project or otherwise.

Construction's document handling is confirmed genuinely project-scoped at
every layer: `ConstructionDocuments` requires a mandatory `projectId` prop;
the backend's `listQuerySchema` requires `projectId: z.string()`
(non-optional); `ProjectFile.projectId` is a mandatory FK with
`onDelete: Cascade`. Real document volume: 196 rows across 4 projects
(not literally "100+" as the review estimated, but the right order of
magnitude).

**Important finding: `projectId` being mandatory is not a schema
blocker.** Nothing in the database prevents a cross-project query — no
partitioning, no structural gap. Global search is a missing
service/route/UI feature, not a missing migration.

### Target state
Reports becomes real cross-project document discovery/search; Construction
keeps its existing project-scoped browsing model unchanged.

### Architectural decision required
**What exactly counts as "search"?** Filename/metadata match only
(category, uploader, date range, project) is a small, well-scoped change.
Full-text content search (inside PDFs/DOCX) is a materially larger
undertaking (needs an indexing strategy — Postgres full-text search vs. an
external index — and a content-extraction pipeline for non-text files).
This decision determines almost the entire scope of the work below and
should be made explicitly rather than assumed.

### Database/schema changes
None required for metadata/filename search (existing `ProjectFile` fields
— `originalFilename`, `category`, `subcategory`, `uploadedAt`, `projectId`
— are already sufficient). Full-text content search would need either a
Postgres `tsvector` column + GIN index on extracted text, or an external
search index — real new infrastructure, not a small addition.

### Backend/API changes
New route (e.g. `GET /project-files/search`) with `projectId` made
optional in `ProjectFileFilter` (currently non-optional by omission, not
by design constraint — confirmed in `projectFileRepository.ts`), plus a
new filename/metadata query parameter the current `listQuerySchema` doesn't
have at all. Full-text search would need a separate indexing
job/pipeline in addition.

### Frontend/UI changes
New search UI in Reports — query input, filters (project, category, date
range), result list with links back into each result's real project
context (not a flat unscoped list — results should stay traceable to their
real project).

### Data migration requirements
None for metadata search. Full-text search would need a one-time
backfill/index build over the real 196 existing rows.

### Dependencies
None on §1/§2. Shares `SimplePage` with Analytics/Administration (§0.1) —
coordinate shell timing, not backend timing.

### Risks
Scope risk is the main one: "search" silently expanding from metadata
match to full-text content search mid-build would roughly multiply the
real effort. Low data-safety risk otherwise — this is additive (new
optional query capability), not a change to existing project-scoped
behavior, which stays untouched per the review's own stated goal.

### Verification/tests
Live query against the real 196-row dataset; verify results stay correctly
scoped/linked to their real project (no orphaned/unscoped results).

### Recommended implementation order
1. Decide metadata-only vs. full-text (§ architectural decision above).
2. Build the backend search route (small if metadata-only).
3. Build the Reports UI.
4. Evaluate the three existing Reports cards (Mileage Tax/Collision/
   Instructions) for whether they stay, move, or get reorganized alongside
   the new search UI — not blindly discarded, per the request.

### Classification
Metadata/filename search build: **B — required implementation** once
scoped. Full-text content search: **C — enhancement** (real value, real
added scope, not required for the review's stated goal). Existing three
cards' fate: **C — enhancement/reorganization**, evaluate don't discard.

---

## 5. Architectural Decisions Awaiting Approval

None of the following have been decided — this plan stops here pending
Joshua's call on each:

1. **Inventory** — build it at all? If yes, absorb Assets + Genealogy (a),
   reference them without absorbing (b), or skip Inventory and just fix
   Genealogy's orphaned route on its own (c)?
2. **Genealogy's orphaned DB records** — wire the real route (independent
   floor, recommended regardless of #1), or fold into Inventory if (a) is
   chosen?
3. **Fleet's canonical entity model** — new parent `Vehicle`/`Fleet` model
   with `LogisticsTruck` as a specialization, or a shared base under
   Inventory if #1 is (a)/(b)? And does this wait on #1's decision or
   proceed independently (accepting rework risk)?
4. **`FleetTask` vs. generalized `LogisticsDispatch`** — new polymorphic
   model, or add a vehicle-type discriminator to the existing, already-
   working dispatch state machine?
5. **Analytics/Reports/Administration shell** — extend `SimplePage` (benefits
   all three) or migrate Analytics alone to `FeaturePage`/`Workspace`?
6. **Reports search scope** — metadata/filename match only, or full-text
   content search (materially larger, needs an indexing strategy)?
7. **CE Forge → FF integration contract** — already settled in
   `AI_Dispatch/CLAUDE.md` (independent systems, one disclosed gated
   data-population path, provenance ≠ dependency) — listed here only to
   confirm it should be treated as a fixed constraint on #1's design, not
   re-opened.

---

## 6. Proposed phased execution sequence

**Phase 0 (no dependencies, can start immediately in parallel):**
- Fix Analytics' stale "Assets is a fixture" disclosure + wire the real
  Assets widget (§3).
- Wire Genealogy's real route so its already-seeded DAG stops being
  orphaned (§1's floor, valuable regardless of the Inventory decision).
- Build Reports' metadata-search backend route, if #6 above is decided as
  metadata-only (§4).

**Phase 1 (after decisions #1, #3, #5, #6 above are made):**
- Inventory build, if (a)/(b) chosen (§1).
- `SimplePage` extension or `FeaturePage` migration for Analytics (§3),
  coordinated with Reports/Administration.
- Reports search UI, built against Phase 0's backend route (§4).

**Phase 2 (gated on Phase 1's Inventory outcome):**
- Fleet's real schema and migration (§2) — canonical shape depends on
  whether Inventory exists and what shape it took.

**Phase 3 (gated on Phase 2, and on Analytics' shell being settled):**
- Analytics data-completeness expansion to include real Fleet/Inventory
  KPIs, replacing the current disclosed-fixture placeholders for Logistics/
  Assets/Robotics.

Nothing in this document has been implemented. Phase 0 items are the only
ones that could reasonably start without further approval, since none of
them depend on an undecided architectural question — but per the brief,
no coding starts until this is confirmed.
