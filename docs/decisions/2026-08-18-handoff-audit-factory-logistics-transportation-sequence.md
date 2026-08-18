# Handoff Audit — Factory → Logistics → Transportation → Modular Sequence

**Status:** Audit only, per explicit instruction. No code written in this
pass. The objective is not "connect four systems" — it's to prove (or
disprove) that one real physical manufactured unit can already be followed
across these three operational boundaries, with each domain remaining
authoritative for its own state. This doc is the evidence a specific build
plan gets written against next.

This is the natural fourth instance of the pattern already formalized in
[`2026-08-17-cross-domain-projection-pattern.md`](./2026-08-17-cross-domain-projection-pattern.md)
— read before this doc if unfamiliar with the Data/Temporal/Nav contracts
referenced below.

## 0. The one physical identity

`InventoryItem` is confirmed (schema + live query) as the real shared
identity spine already threading through all four domains:

```
ProductionOutput.inventoryItemId   (required, unique)  — Factory
LogisticsModule.inventoryItemId    (optional, unique)  — Logistics
ModuleSequenceEntry.inventoryItemId(required, unique)  — Construction
```

No new "chain object" is needed or proposed. The chain for one unit is
already expressible as one `InventoryItem` id joined across three existing
tables, plus `LogisticsDispatch` reached through `LogisticsModule.dispatchId`.

## 1. Handoff Audit Matrix

| Boundary | Upstream authority | Downstream authority | Real record today | Shared identity | Missing link |
|---|---|---|---|---|---|
| Factory → Logistics | Factory (`ProductionOutput.status`) | Logistics (`LogisticsModule`) | ✅ `LogisticsModule.productionOutputId` → `ProductionOutput`, service-asserted to share the same `inventoryItemId` (`logisticsModuleService.ts:62-71`) | ✅ `InventoryItem` | **Not gated.** `productionOutputId` is fully optional at `LogisticsModule` creation (`createModule()`, no check on `output.status`) — a module can exist with zero production provenance, and a `complete` `ProductionOutput` can sit indefinitely with no module. Real, disclosed, live-confirmed state (`CW-WP-B-0002` below), not a bug. |
| Logistics → Transportation | Logistics (`LogisticsModule`) | Transportation (`LogisticsDispatch.status`) | ✅ `LogisticsModule.dispatchId` → `LogisticsDispatch`, real FK, service-validated to reference a real dispatch when given | ✅ same `InventoryItem`, reached transitively through the module | **Not gated either**, but this is by design, not a gap: a module legitimately sits `dispatchId: null` while staged in the yard. The real question isn't "is it linked" but "what does `dispatch.status` say" (`staged`/`in_transit`/`delivered`) once it is. |
| Transportation → Modular Sequence | Transportation (`LogisticsDispatch.status`) | Construction (`ModuleSequenceEntry`) | ✅ **Gated**, not just linked — `moduleSequenceService.createEntry()` (lines 114-136) throws unless `module.dispatch.status === "delivered"`. This is the one boundary in the whole chain with a real, enforced precondition, not just an optional pointer. | ✅ same `InventoryItem`; `sourceDispatchId` also carried onto the entry as a citation-only field (no DB FK — resolved by id at read time, same posture as `SyntheticDataProvenance`) | Entry creation is **manual**, not automatic. A `delivered` dispatch does not by itself create a `ModuleSequenceEntry` — a real person/action still has to call `createEntry()`. `ModuleSequenceStatus.pending`'s own doc comment states this explicitly: *"Real InventoryItem link exists, but no real delivered dispatch yet... this entry's own real state, not Logistics' concern to update."* This is the authority-boundary discipline already in the code, not something to add. |

## 2. Real example, live-queried against the sandbox DB

Two `ProductionOutput` rows exist with `status: complete`. Their real
downstream state today:

| Serial | Factory | Logistics module? | Dispatch status | Sequence entry? | Sequence status |
|---|---|---|---|---|---|
| `CW-WP-B-0001` | complete | ✅ yes | `delivered` | ✅ yes | `pending` |
| `CW-WP-B-0002` | complete | ❌ no | — | ❌ no | — |

Read as an operational truth table, per the framing requested:

```
CW-WP-B-0001
  FACTORY               complete
  LOGISTICS HANDOFF      complete   (real LogisticsModule exists)
  TRANSPORTATION          delivered
  SEQUENCE               WAITING FOR SITE ACCEPTANCE  (status=pending, not yet advanced)

CW-WP-B-0002
  FACTORY               complete
  LOGISTICS HANDOFF      NOT STARTED   (no LogisticsModule at all)
  TRANSPORTATION          —
  SEQUENCE               —
```

Neither line is a bug. `CW-WP-B-0001` shows the chain working exactly as
designed, stalled at a real, honest boundary (delivered, not yet
site-accepted — Construction's own state, not Logistics'). `CW-WP-B-0002`
shows a unit that finished Factory but was never hooked into Logistics
custody — a real gap in the *data*, not the *model*.

## 3. Correction to the originally proposed shape

The proposed per-unit checklist (Receiving / Staging / Loading /
Transportation Handoff, one row per physical unit) does **not** map onto
what `FlowPoint`/`FlowConnection` ("Logistics Flow") actually is. Confirmed
from schema + the existing interoperability map
(`2026-08-17-cross-domain-projection-pattern.md` §3, row 8, independently
flagged there already):

- `LogisticsFlow`/`FlowPoint` is a **per-project facility topology** (one
  flow per `ConstructionProject`), not a per-unit tracker. Its 7 stages
  (Receiving → ... → Transportation Handoff) are fixed map nodes, not
  progress checkboxes for a specific serial number.
- `FlowPoint.status` is `normal`/`held`/`halted` — a blockage/hold state
  for that physical location, unrelated to which unit is currently passing
  through it.
- `FlowPoint.assetRef` only carries a real link for `load_assignment`/
  `transportation_handoff` point *types*, and that link points at a
  `Vehicle`/`LogisticsDispatch` (a truck assignment), never at a specific
  `InventoryItem`/`ProductionOutput`.
- There is no FK anywhere from `FlowPoint` to `InventoryItem`,
  `LogisticsModule`, or `ProductionOutput`.

**The real per-unit Logistics state is `LogisticsModule` +
`LogisticsDispatch.status`, not `FlowPoint`.** Logistics Flow and this
handoff chain are two real, coexisting, un-joined features. Building the
per-unit tracker against `FlowPoint` would require fabricating a join that
doesn't exist — this audit surfaces that rather than routing around it.

## 4. What already exists vs. what's actually missing

**Already built (Phase 10, `factoryFlowService.ts:146-166`):** the
Factory → Logistics leg already has a real, live, read-only answer.
`getFactoryFlow()`'s `logisticsHandoff` stage walks
`ProductionOutput → inventoryItem.logisticsModule → dispatch.status` per
completed output and reports `handed_off`/`pending` plus real
`dispatchStatus`. This is boundary 1 and half of boundary 2, already
shipped, already matches the Data Projection Contract.

**Not built anywhere yet:** nothing continues that same read past
`dispatchStatus` into whether a `ModuleSequenceEntry` exists for the same
`InventoryItem`, or what its real status is. That's the actual gap — a
narrow, well-scoped extension of an existing real projection, not a new
subsystem. It is a natural fourth candidate for
`2026-08-17-cross-domain-projection-pattern.md` §1 (Data Projection
Contract: read the same real API `ModuleSequenceEntry`'s own UI uses,
create nothing new).

## 5. What this audit is not

No implementation follows from this doc automatically. In particular, per
explicit instruction: no new chain-of-custody entity, no duplicated
physical identity, no change to which domain owns which state, and no
auto-advancing a downstream domain's status off an upstream domain's
change (e.g. `dispatch.status = delivered` does **not** imply
`ModuleSequenceEntry.status = site_arrival` — that remains Construction's
own explicit action, exactly as `moduleSequenceService.ts` already
enforces today). The next step is a separate, explicit plan scoped against
§1's matrix and §4's actual gap.
