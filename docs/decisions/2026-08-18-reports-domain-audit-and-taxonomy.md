# Reports Domain — Audit + Taxonomy

**Status:** Audit and taxonomy proposal only, per explicit instruction — "I
would not start building the End-to-End report yet. First, let's gut-check
the existing Reports domain." No code in this pass. The End-to-End report
(Boundary work already implemented: `2026-08-18-handoff-audit-...md` +
commit `a763c74`) is the first thing built once this taxonomy is agreed,
not before.

## 1. What's actually in Reports today

`pages/reports/ReportsPage.tsx` is a bare `SimplePage` — **no command
ribbon, no capability switching, no taxonomy** — mounting one monolithic
component, `features/reports/ReportsLibrary.tsx` (694 lines), which stacks
four real, unrelated capabilities vertically on one page:

| Card | Real data source | Persisted? | Notes |
|---|---|---|---|
| Document Search | `GET /construction-files/search` (real `ProjectFile` rows) | Yes | Real, enterprise-wide, metadata/filename only — genuinely a Reports-shaped capability. |
| Mileage Tax Report | `logisticsDispatchService.listTaxReportEntries()` | Yes (source data); report itself is computed at read time | The most "report-shaped" thing in the app today: real IRS-recordkeeping fields, effective-dated rate lookup, CSV export, print-to-PDF. The template this domain should generalize from. |
| Collision Report | Live twin collision monitor (in-memory `collisionStore`) | **No — session-only, cleared on reload** | Real data, but a live operational monitor, not an archived business report. Mismatched category (see §3). |
| Generated Reports / Instruction Sequence | `ManufacturingOutputContext` (in-memory) | **No — session-only** | **This is a straight duplicate of Factory's own "Instructions" ribbon view** (`FactoryInstructions.tsx`) — same in-memory store, two separate read paths for the same data, not a projection of it. |

None of this is fake/mock — everything reads real records. The problem
isn't fabricated data, it's that four genuinely different real
capabilities are crammed into one un-navigable page with no organizing
principle, and one of the four (Instruction Sequence) shouldn't exist here
at all in its current form.

## 2. The Analytics vs. Reports distinction (adopted)

> **Analytics** → interactive analysis and live dashboards; projections of
> ongoing operational data.
> **Reports** → formal, purpose-built views that answer one specific
> business question and can be exported/archived/shared.

Scored against that line:

- **Mileage Tax Report** — clearly Reports (formal, exportable, IRS-shaped).
- **Document Search** — Reports (a specific, answerable question: "find this file").
- **Collision Report** — reads like **Analytics**, not Reports: it's a live monitor of the current twin run with no persistence and no formal export shape. Candidate to relocate to Analytics (Analytics already owns other live-twin/observability widgets — see `project_ff_analytics_phase3_plan`), not to survive in Reports as-is.
- **Instruction Sequence** — belongs to neither. It's Factory's own real data, already shown in Factory. Recommend dropping it from Reports entirely rather than relocating it — a "View in Factory" link, if anything, never a second render of the same in-memory object (same Nav/Reselection Contract discipline as `2026-08-17-cross-domain-projection-pattern.md`).

## 3. Proposed taxonomy — real buildability, not aspiration

Same format as the cross-domain-projection doc's own interoperability
map: every row is checked against real models/services that exist today,
not assumed.

| Category | Report | Real data today? | What it would read |
|---|---|---|---|
| **Operations** | End-to-End Production Lifecycle | ✅ **Built** (`factoryFlowService.getFactoryFlow()`, commit `a763c74`) | `ProductionOutput → InventoryItem → LogisticsModule → LogisticsDispatch → ModuleSequenceEntry` |
| Operations | Production Completion (project-level rollup, e.g. "96/100 outputs complete") | ⚠️ Partial — the per-unit facts exist (`ProductionOutput.status`), but **no project-level aggregate query exists anywhere in the backend today**; would be new (real, read-only) aggregation, not new persistence |
| Operations | Logistics / Transportation Performance (on-time %, dwell time) | ❌ Not really — `LogisticsDispatch.eta` is a real user-entered estimate with no real routing/GPS data behind it (confirmed earlier this session); an honest "performance" report would be limited to real odometer/mileage facts, not on-time accuracy, without fabricating a routing layer |
| Operations | Modular Sequence Completion (project-level) | ⚠️ Partial — same shape as Production Completion: real per-entry status exists, no existing project-level rollup query |
| **Construction** | Project Status | ⚠️ Partial — would compose several real per-domain facts (Production/Logistics/Sequence rollups above, none of which exist as aggregates yet) |
| Construction | Cost / Estimate Reconciliation | ✅ Real data exists (`CostAssembly`/`MarketCostRecord`/`ProjectQuantityTakeoff`, Phase 6 SKU breakdown) — currently surfaced in Analytics' Cost Intelligence widget, not Reports; a Reports-side formal/exportable version would be a real projection of the same data, same pattern as Mileage Tax Report |
| Construction | Production-to-Installation Progress | Same data as End-to-End, scoped to one project — buildable now, same underlying chain |
| **Inventory** | Material Inventory (on-hand/reserved/consumed) | ✅ Real (`MaterialInventoryEvent` ledger, Phase 8) |
| Inventory | Material Consumption | ✅ Real, same ledger, filtered/grouped differently |
| Inventory | Reservation / Shortage | ✅ Real, same ledger (`quantityAvailable = onHand - reserved`, already computed) |
| **Compliance / Traceability** | Genealogy | ✅ Real (`GenealogyNode`/`GenealogyEdge`, real DAG) — already has its own live view in Inventory's Genealogy capability; a Reports version would be a formal export of that same graph, not new data |
| Compliance | Production / QC History | ✅ Real — confirmed `ProductionOutput.qcStatus` + `ProductionOutputStatusEvent.fromQcStatus/toQcStatus` is a real, timestamped QC transition history, not just a current-state flag |
| Compliance | Asset / Equipment History | ✅ Real (`Asset` model exists with real category/status/serial/manufacturer fields) — no dedicated history/event table for Assets specifically confirmed yet, would need a quick follow-up check before promising a *history* report, not just a current-state one |

## 4. Recommendation

**Buildable now, zero new backend work, real data confirmed:** End-to-End
(done), Material Inventory/Consumption/Reservation, Genealogy export,
Production/QC History, Cost/Estimate Reconciliation (Reports-side
projection of Analytics' existing real data).

**Buildable, but needs new real read-only aggregation first (no new
persistence, just new queries):** project-level Production/Sequence
rollups, Project Status, Production-to-Installation Progress at project
scope.

**Not honestly buildable without fabrication today:** Logistics/
Transportation "performance" in the on-time/routing sense — real mileage
data can be reported, real punctuality cannot without inventing a routing
layer that doesn't exist.

**Relocate, don't rebuild:** Collision Report → Analytics (live monitor,
wrong category). Instruction Sequence → drop from Reports (pure
duplicate of Factory's own view).

**Keep as-is, already correctly shaped:** Document Search, Mileage Tax
Report.

## 5. Ribbon structure (once agreed)

Convert `ReportsPage.tsx` from bare `SimplePage` to the same real
`FeaturePage`/`CommandRibbon` capability-switch pattern every other domain
now uses (Phase 10 standardization). Proposed first real set, scoped to
what §4 confirms is honestly buildable:

**End-to-End | Production | Logistics | Inventory | Construction |
Genealogy | Document Search**

Each button is a real capability switch (own workspace), not a dropdown —
matching the now-standard rule. Mileage Tax Report likely nests under
Logistics; Document Search stays its own button (already real, already
enterprise-wide, no change needed).

## 6. What this doc is not

No implementation yet. Next step is Joshua's sign-off on this taxonomy
(and, in particular, on relocating Collision Report and dropping
Instruction Sequence), then a scoped implementation plan for the Reports
ribbon restructure with End-to-End as its first real tab.
