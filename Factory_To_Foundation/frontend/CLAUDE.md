# Factory » Foundation — Frontend OS Handoff

**Status as of this document:** 8 of 11 features are live and running through the shared framework. Full design token pass complete. Construction, Genealogy, and Scheduling run on real (not fixture) data. **Digital twin integration (Milestone B) — manifest-driven rewrite done and live-verified:** Factory now consumes a twin-authored subsystem manifest generically instead of hardcoding subsystem identities. All **13 real subsystems** are shown (not the 7 previously visible) — the 7 with live `state.json` fields (gantry, roller, tilt, 4 robots) show real running/idle status; the 6 real rail/ATC subsystems `state.json` has no fields for yet show an honest `unknown`/`--` placeholder, never a fabricated value. Factory's old fixture (`factoryData.ts`) is deleted — Factory is manifest-driven only now, no fixture fallback. This document supersedes the prior handoff, which predated the manifest architecture entirely and still described Factory's twin integration as a hardcoded 7-node translation. This project is now version-controlled (git initialized this pass) — prefer `git diff`/`git log` over re-reading files by hand when checking what changed.

---

## 1. What Factory » Foundation Is, Right Now

A React 19 / Vite / TypeScript / Tailwind v4 single-page app. One shared application shell (`FeaturePage`) that every feature renders through — a slim command ribbon at the top, a three-panel resizable workspace below (Browse / Viewport / Selected), all styled through one design token system. Eleven features are routed; eight have real UI, three remain intentional placeholders.

```text
Sidebar (collapsible icon rail) ── routes to ──▶ FeaturePage
                                                    ├── CommandRibbon (dropdown menus + page identity)
                                                    └── Workspace (resizable, fully collapsible)
                                                          ├── Left:   Browse panel
                                                          ├── Center: Viewport (camera pan/zoom/fit)
                                                          └── Right:  Selected/Inspector panel
```

---

## 2. Folder Structure

```text
src/
  framework/           — shared, feature-agnostic
    workspace/          Workspace (react-resizable-panels, all 3 panels collapsible)
    viewport/            Viewport, ViewportControls, CameraContext (pan/zoom/fit engine)
                          EntityNode, EntityCanvas (generic node-graph rendering)
    ui/                  PanelCard, FeaturePage, CommandRibbon, DropdownMenu,
                          BrowseList (indent AND children — see §3), ToolbarShell(+Input/Select/Button),
                          StatusBadge, PreviewBox, Legend, DetailRow,
                          KpiCard, KpiRow, KpiList, PageHeader, CollapsibleSection
  features/            — business domain, one folder per feature
    genealogy/           graphData.ts, genealogyRegistry.ts (real QR/prefix scheme, ported from CE_Genealogy_AllInOne-5.py)
    factory/             useTwinState.ts + useTwinManifest.ts (live twin bridge clients) + twinTranslator.ts
                          (manifest-driven; no fixture — factoryData.ts was deleted, see §6.3)
    robotics/  logistics/  construction/
    manufacturing/  scheduling/  assets/           ← all 8 built
    analytics/  administration/  reports/           ← still placeholders (.gitkeep)
  pages/               — one page per route, composes a feature through FeaturePage
  router/routes.tsx    — single source of truth: path + label + icon + element,
                          drives both <Routes> and the Sidebar nav
  context/
    SelectionContext.tsx — discriminated union, one global selection engine
  layouts/AppLayout.tsx — Sidebar + content, locked to h-screen
  components/layout/Sidebar.tsx — collapsible icon rail (lucide-react)
  index.css            — design tokens (see §5)
```

`@` resolves to `src` (configured in `vite.config.ts` + `tsconfig.app.json`).

**Outside this project entirely:** `twin-bridge/server.mjs`, a sibling directory to `Factory_To_Foundation` (not under `src/`, not part of the Vite build) — a small dependency-free Node script that polls the real digital twin's `state.json` **and** `cell_manifest.json`, serving both over HTTP (`GET /twin-state`, `GET /twin-manifest`) for Factory's live mode. Also outside this project: the twin's own manifest-export script, inside `Construction_Enterprises` — a standalone, manually-run script (not wired into `run_twin_headless.py`) that writes `cell_manifest.json`. The twin owns and writes that file; FF only ever reads it. See §6.3.

---

## 3. The Framework Layer — What Each Piece Owns

Built incrementally, each promoted to `framework/` only once a second (or third) real feature needed the identical thing — never spec'd in the abstract ahead of a real consumer.

- **`Viewport`** (`framework/viewport`) — owns camera state (`{x, y, zoom}`), left-drag pan, cursor-anchored wheel zoom, double-click fit-to-content, auto-fit on mount/bounds-change. Clips its content; the camera moves, nothing ever overflows the browser. `useCamera()` hook for any child to read/drive it.
- **`EntityCanvas` / `EntityNode`** (`framework/viewport`) — the generic "nodes positioned in world-space, connected by optional edges, click to select" renderer. Originally bespoke per-feature (`GraphNode`/`GraphCanvas`, `FactoryNode`/`FactoryCanvas`); promoted to `framework/` once Robotics/Logistics/Construction/Assets/Scheduling all needed the same shape at once. Genealogy and Factory still use their own bespoke node components (`GraphNode`, `FactoryNode`) because they existed before the promotion and have feature-specific visual treatment (Genealogy: tier-colored borders; Factory: a left-edge status strip) that doesn't fit the generic component's props — not a gap, a deliberate non-migration. Factory's node no longer has a `tier` concept at all — that field (and its `line`/`cell`/`machine`/`station` fixture values) was removed along with `factoryData.ts`; every live node gets the same visual treatment, distinguished only by `status` (`running`/`idle`/`down`/`unknown`). `FactoryCanvas` takes its `nodes` array as a prop (rather than importing data internally) — `FactoryLayout` passes manifest-driven-live nodes, or an empty array when the twin bridge isn't reachable (no fixture left to fall back to).
- **`Workspace`** (`framework/workspace`) — three-panel resizable layout via `react-resizable-panels`. **All three panels are `collapsible` with `collapsedSize={0}`** — drag any divider fully closed, drag it back open. This was a real bug fix, not a new feature: the library always supported this, `collapsible`/`collapsedSize` just weren't turned on originally.
- **`PanelCard`** — the one panel shell every Browse/Viewport/Selected panel renders through. Flat (thin border, minimal radius, no shadow) — not a floating SaaS card.
- **`CommandRibbon` + `DropdownMenu`** — replaced the old full-height `PageHeader` entirely. A single 40px bar: dropdown-triggered menus (Metrics, Filters) on the left, page label + avatar on the right. Dropdowns float over content — they never push the workspace down, unlike the earlier (now removed) `CollapsibleSection` inline-expand approach. Only one dropdown can be open at a time. `PageHeader` still exists and is still used by `ComingSoonPage` (the 3 unbuilt features) — it wasn't deleted, just superseded as `FeaturePage`'s header mechanism.
- **`BrowseList`** — **two permanent, independent display modes**, not one growing into the other:
  - `indent` (flat list, manually-specified depth) — for data that's a DAG or sequence, where a single-parent tree would misrepresent it. Genealogy stays on this permanently: the real registry data means Framing-Package has 2 material parents and Sub-Assembly has 4 — a `children` tree (one parent per node) would force an arbitrary-parent or duplicated-node hack.
  - `children` (real nested tree, expand/collapse per node, chevron matching `CollapsibleSection`'s rotation/timing) — for genuine one-parent containment or real groupings. Used by Construction (Project→Building/Floor), Robotics (each ATC→its real `tools[]`; Rail and ATCs stay root-level siblings, not nested — the rail coordinates them, doesn't contain them), Logistics (grouped by real `zone`), Assets (grouped by real `category`).
  - A row with `children` both toggles *and* calls `onSelect(id)` on click — some containers are genuinely inspectable (Robotics' ATCs), others aren't (Construction's Projects, whose `onSelect` handler just no-ops for those ids). `BrowseList` itself doesn't need to know which case it's in.
  - Factory's Browse is a flat list of manifest entries (`items` with neither `depth` nor `children`) — the real twin cell has no line/grouping concept at all (13 peer subsystems), so the old fixture's Line→Machines tree wasn't preserved; see §6.3.
- **`ToolbarShell` / `ToolbarInput` / `ToolbarSelect` / `ToolbarButton`** — shared flat toolbar primitives. All 8 feature toolbars render through these instead of each duplicating the same wrapper markup.
- **`StatusBadge`** — one status pill component, `tone: "positive" | "warning" | "critical" | "neutral"`. Every inspector with a status concept (Factory, Robotics, Logistics, Assets) uses this instead of a local Tailwind color map.
- **`PreviewBox`** — the empty "Preview Image" placeholder shared across every inspector panel.
- **`SelectionContext`** — one global selection engine, discriminated union keyed by `feature`. Every payload is fully typed per feature (no `unknown`, no casting):

```ts
type Selection =
  | { feature: "genealogy";     ...; payload: GenealogyPayload }
  | { feature: "factory";       ...; payload: FactoryPayload }     // status gained "unknown"; optional liveState?: string
  | { feature: "robotics";      ...; payload: RoboticsPayload }
  | { feature: "logistics";     ...; payload: LogisticsPayload }
  | { feature: "construction";  ...; payload: ConstructionPayload }
  | { feature: "manufacturing"; ...; payload: ManufacturingPayload }
  | { feature: "scheduling";    ...; payload: SchedulePayload }
  | { feature: "assets";        ...; payload: AssetsPayload };
```

- **`router/routes.tsx`** — single array of `{path, label, icon, element}`, consumed by both `<Routes>` in `App.tsx` and `Sidebar`'s nav list. A route can't exist in one place without the other picking it up automatically.

---

## 4. The Eight Live Features

| Feature | Data source | Notes |
|---|---|---|
| **Genealogy** | `graphData.ts` — real 7-tier hierarchy (Material → **Framing-Package** → Component → Sub-Assembly → Module → Building → Project), rebuilt from `CE_Genealogy_AllInOne-5.py`'s `build_thread()` | The tier was renamed from "Material Package" (naming error, corrected everywhere including the CSS token `--ff-tier-framing-package`). `genealogyRegistry.ts` ports the real prefix→tier registry, QR generation (`makeObjectQr`/`makeMaterialQr`, spot-checked against real Python output), and `canBeFinishedProduct`. The real thread is a DAG — Framing-Package has 2 material parents, Sub-Assembly has 4 — which is *why* Genealogy stays on `BrowseList`'s `indent` mode permanently (see §3). `SelectedObject` shows the real QR (monospace text) and a derived "Finished Product" indicator for nodes the real thread built; Module/Building/Project still show the placeholder (no real QR built them yet). |
| **Factory** | Live digital twin data only, driven by the twin's real subsystem manifest (`cell_manifest.json`) — no fixture | **Milestone B manifest-driven rewrite, done and live-verified.** `useTwinManifest.ts` polls `twin-bridge/server.mjs`'s `GET /twin-manifest` (outside this project, run manually) for real identities; `useTwinState.ts` polls `GET /twin-state` for live values. `twinTranslator.ts` maps every manifest entry — all **13** real subsystems, not just the 7 with live fields — onto `FactoryNodeData`/`FactoryPayload`, dispatching per-type for known types (gantry/roller/tilt/robot), falling back to a generic dotted-path lookup for an unmapped type with data, and falling back to an honest `unknown`/`--` placeholder for a manifest entry with no `state.json` data at all (the real rail/ATC case today). `FactoryLayout`, `FactoryBrowse`, and `FactoryInspector` show a "Live Twin Data" / "Twin Offline" badge tied to manifest connectivity — no manifest connection means no nodes, not stale sample data. Full details, real `state.json`/manifest schema, and what's deliberately NOT done yet: §6.3. |
| **Robotics** | `roboticsData.ts` — **seeded from the real digital twin subsystem model** (`CE_Integrated_Cell_V3_0-6.py`): 1 `RailSubsystem` + 4 `ATCSubsystem`, each with real 4-tool loadouts | Structure is real; live status/task/cycle-time values are still placeholders — Robotics hasn't been wired to the twin bridge yet (Factory-only first slice). Browse now shows each ATC's real `tools[]` as expandable children (Rail and ATCs stay root-level siblings — the rail coordinates them, doesn't contain them). |
| **Logistics** | `logisticsData.ts` — fixture yard/dock/transportation data | Browse now grouped by the real `zone` field (Receiving/Storage/Yard/Transportation) instead of a flat list. |
| **Construction** | `constructionData.ts` — **real Construction Enterprises project data**: Stonepine Residences (200-unit subdivision, honest "16 Floor Plans — not yet itemized" placeholder), Cedarwood Flats (Buildings A–E, confirmed naming), Garden Lofts (single 20-story tower, Floors 1–20), Skyline Towers (single 40-floor high-rise, confirmed despite the plural name) | No longer fixture Building A/B/C. Browse is a real `children`-based Project→Building/Floor tree. The Site Plan viewport shows the 4 projects as neutral boxes (no status color — there's no real per-project status yet); Building B intentionally matches Genealogy's `graphData.ts` fixture (same project, same building name). Buildings D/E and all Garden Lofts/Skyline floors have no real progress data yet — honest "No progress data yet / Unassigned" placeholders, not invented numbers. |
| **Assets** | `assetsData.ts` — fixture equipment/vehicle/tool data | Browse now grouped by the real `category` field (Vehicles/Equipment/Tools/Infrastructure). |
| **Scheduling** | `scheduleData.ts` — **the real 5-type taxonomy the user specified**: Inbound Material → Material Arrival → Sub-Assembly/Module Production → Storage & Logistics → Construction Schedule, rendered as the actual pipeline with connector edges | No KPIs (nothing real to summarize). Inspector is deliberately honest: "No live schedule data yet — owned by [Logistics/Factory/Construction]" instead of fabricated dates. `inbound-material` has no owning feature yet — flagged as an open gap. Deliberately NOT migrated to `BrowseList`'s `children` mode — it's a linear pipeline, not a containment hierarchy. |
| **Manufacturing** | **No fabricated data.** Browse/Viewport/Selected all render honest empty states ("No geometry imported yet") | Scoped for real `.blend` file ingestion — **still waiting on the file**, nothing uploaded to the project yet. "Import .blend File" button exists in the toolbar; not yet wired to anything. No Metrics dropdown (nothing to summarize). Deliberately untouched by the `BrowseList` migration — nothing to nest yet. |

**Deliberately still `ComingSoonPage`:** Analytics, Administration, Reports. Per the original spec these three have no viewport shape at all (dashboard/charts, settings, document library) — forcing Browse/Viewport/Selected onto them would fight the spec, not follow it.

---

## 5. Design System (built this session, applied last)

**Direction, explicitly chosen by the user after two rounds of correction:** light theme, orange accent — but adopting Revit/Blender's flat, dense, restrained-accent discipline, not a SaaS dashboard look. (First proposal was dark theme — wrong, corrected. Second was "muted but still card-based" — also revised once the Revit reference was actually looked at: Revit's default is light gray chrome with flat panels, no cards, no shadows.)

All tokens live in `src/index.css` under `:root`:

```css
--ff-chrome-bg / --ff-chrome-border     /* ribbon, panel headers — muted gray, separates chrome from content */
--ff-content-bg                          /* app background */
--ff-panel-bg / --ff-panel-border        /* panel body, thin 1px borders */
--ff-text-primary / --ff-text-secondary / --ff-text-muted
--ff-accent / --ff-accent-hover / --ff-accent-soft   /* the ONE brand color — #d9631e, not Tailwind orange-500 */
--ff-tier-material / -framing-package / -component / -subassembly / -module / -building / -project  /* muted genealogy tier palette — "framing-package" renamed from "material-package" */
--ff-status-positive / -warning / -critical / -neutral  /* shared status palette, used everywhere status exists */
--ff-radius: 0.3rem                      /* the one corner radius, used everywhere */
--ff-border-width: 1px
```

**What changed structurally, not just cosmetically:**
- Every `shadow-sm` + `rounded-xl` "floating card" replaced with flat 1px-bordered panels.
- Selection state changed from a glowing box-shadow ring to a 2px accent outline.
- All 8 toolbars, all status badges, all "Preview Image" placeholders, and both hand-rolled browse lists (Genealogy, Factory — built before `BrowseList` existed) consolidated onto shared primitives during this pass, closing duplication that had accumulated across the blitz.
- Factory's node status treatment upgraded to a left-edge color strip (an item agreed to weeks earlier in the Factory UX review but never actually built until this pass).

---

## 6. Known Gaps / Explicit Non-Decisions

1. **Manufacturing needs the `.blend` file.** Nothing uploaded yet. Shell is fully built and waiting.
2. **Scheduling's "Inbound Material" has no owning feature.** Flagged, not resolved — is it a new small feature, or does it fold into Logistics/Factory?
3. **Digital twin integration (Milestone B) — manifest-driven rewrite done, not complete.** Factory is fully manifest-driven now (13 real subsystems, honest placeholders for the 6 with no live data). See §6.3 for the full schema, the "13 not 7" finding, and what's still open (other features, WebSocket upgrade, real per-subsystem numerics, live KPIs).
4. **KPI numbers across Factory/Robotics/Logistics/Assets are fixture data**, consistent with the compromise already established for Factory in Phase 2 — plausible, not real. Construction's *original* fixture buildings (A/B/C) carry that same plausible-fixture compromise; everything added in the real-data pass (D/E, all floors, Stonepine's placeholder) instead uses honest "no data yet" placeholders rather than extending the fixture-plausibility compromise to brand-new content. Scheduling and Manufacturing deliberately have no KPIs rather than fabricate them.
5. **Robotics' structure is real (from the twin's subsystem model); its live values are not.** Factory received the twin bridge first — Robotics is the next-best-positioned feature to receive real state, once this pattern is extended past Factory.
6. **The "click to jump to that page's schedule" ribbon button** (discussed and scoped in detail — icon in `CommandRibbon`, navigates to `/scheduling?scope=X`) was **never built**.
7. **A third `CommandRibbon` menu type** (e.g. a "Tools" dropdown for Robotics) was discussed as a natural next step once more real pages existed to justify the taxonomy, but wasn't built — deliberately deferred until it's earned by real usage, not designed speculatively.
8. **Resolved — the app has now been run and visually verified.** `npm run dev` runs successfully in this environment (contrary to an earlier note in this doc claiming Windows-native binaries couldn't execute here); the Twin Bridge first slice was verified end-to-end in an earlier session — twin process running, bridge relaying live state, dev server serving current code, and the user confirmed visually in-browser (Factory showing the live badge and the real 7 nodes). Treat a live check as the norm going forward now that it's known to be possible here.
9. **Resolved — version control initialized.** This project had no `.git` at all through the manifest-driven rewrite (§6.3), which is why verifying "did anything survive the crash that interrupted that work" required manually reading `twinTranslator.ts`/`server.mjs`/this doc instead of one `git diff`/`git log`. Fixed this pass — prefer git history over manual file-by-file re-reads for any future "what actually changed / survived" question.

### 6.3 Digital Twin — Milestone B, manifest-driven architecture (Factory, read-only, polling)

**Real twin project root:** `C:\Users\jchap\Dev\Construction_Enterprises` (moved off OneDrive for performance). Has its own `CLAUDE.md` with hard rules — `IntegratedCell`/`cell.step()`/state-machine classes are do-not-modify, extensions wrap and never alter. Canonical way to run it: `Chappell_Robotics\run_twin_headless.py`. Never edit anything under that root from an FF session.

**Why this replaced the original 7-node first slice:** that slice worked, but hardcoded exactly 7 subsystem identities into `twinTranslator.ts` by name. Every time the twin grew, someone would have to manually go edit the FF frontend to notice — the opposite of what was wanted. Standing requirement now: **the OS must reflect the twin's real complexity dynamically, never via FF-side code hardcoded to today's subsystem list.**

**The manifest (`cell_manifest.json`):** a standalone, manually-run script inside `Construction_Enterprises` (mirrors `validate_contract.py`'s manual-run pattern — deliberately not wired into `run_twin_headless.py`, since the object graph is fixed/deterministic at `IntegratedCell.__init__` and nothing adds or removes subsystems at runtime today) writes a real, verified list of **13 subsystems**: `gantry`, `roller`, `tilt`, `robots.A1`/`A2`/`B1`/`B2` (the original 7), plus **2 real rail subsystems** (`rail_A`, `rail_B`) and **4 real ATCs** (`atc_A_far`, `atc_A_near`, `atc_B_far`, `atc_B_near`) — 6 identities FF had no visibility into before this. Each entry is `{ id, type, label }`; `id` follows the exact same dotted-path scheme `state.json` itself uses (e.g. `"robots.A1"`), so resolving an identity's live data is a direct path lookup, not a second name-mapping table that can drift. Pure additive, read-only — both twin validation gates (physics-equivalence at frame 1395, `validate_contract.py`) pass unchanged.

**Real `state.json` schema** (verified against both a live read and the exact write code in `CE_Integrated_Cell_V3_0-6.py`'s `advance()`, HOOK B — complete, not partial):
```
frame, master_phase, module_done, placed_walls, paused, _paused_by, _paused_at, _last_error,
gantry: {state, cycles, bridge_x, trolley_y, hook_z, carrying, panel_ang},
roller: {state, cycles, panel_x, travel_pct, speed},
tilt:   {state, cycles, angle_deg, pin_extended},
robots: {A1, A2, B1, B2}: each {state, x, cycles, tool_idx}
```
Write cadence confirmed ~100–150ms (`_WRITE_EVERY=10` × `_TICK_S=0.01` nominal, ~135ms measured live). **Only 7 of the 13 real manifest identities have any corresponding field here** — the 2 rails and 4 ATCs are real, manifest-confirmed identities with zero live data behind them; `state.json`'s schema hasn't grown to cover Pass 1/Pass 2's object model yet. Not hypothetical — the real, current shape.

**Two fields that are easy to misread:**
- `robots.*.x` is **rail-travel position** (a single linear DOF), not a screen or joint coordinate. Floor-plan layout in `twinTranslator.ts` is a separate, static table — deliberately not derived from this.
- `tool_idx` is an explicitly-decoupled **legacy cosmetic** color-cycle (per the twin's own `CLAUDE.md`), not real tool/ATC identity. The real Pass-2 ATC/tool object model exists in the twin's Python object graph but isn't exposed in `state.json` at all yet.

**Status mapping:** the twin has no per-subsystem fault/"down" concept — only a cell-wide `_last_error` for *rejected commands*, not equipment faults. Live-derived nodes never emit `"down"`; coarse running/idle comes from known at-rest state strings (`PARKED`, `PARKED_AT_ATC`, `IDLE`, `FLAT`), and the real granular state string is preserved via `FactoryPayload.liveState` rather than discarded. `FactoryStatus`/`FactoryPayload.status` gained a fourth value, **`unknown`** — reserved for a manifest-confirmed identity with no `state.json` data at all (the real rail/ATC case), rendered as `--` / muted styling, never guessed as idle/running.

**`twinTranslator.ts`'s three-tier resolution (this is the actual generic-consumption mechanism):**
1. Known type (`gantry`/`roller`/`tilt`/`robot`) → dispatch to that type's mapper function (currently each just does the dotted-path lookup, kept as separate functions as the seam for a future type-specific field, e.g. surfacing `bridge_x`).
2. Unmapped type that still resolves *something* at that `id`'s path in `state.json` → generic raw-field lookup, same dotted-path scheme.
3. Nothing resolves at all (today: all 6 real rail/ATC entries) → `status: "unknown"`, all display fields `--`.

Floor-plan position: a small hand-placed table (`KNOWN_LAYOUT`) for the 7 identities with a known real arrangement; anything else (today: the 6 rail/ATC entries) gets `fallbackGridSlot` — a generic auto-grid computed from whichever manifest entries aren't in the hand-placed table, so a manifest that grows doesn't require the table to grow in lockstep.

**What's built:** `twin-bridge/server.mjs` gained a second endpoint, `GET /twin-manifest`, serving `cell_manifest.json` the same tolerant-read way `/twin-state` serves `state.json` (polled every 2s, not 100ms — the manifest only changes on a manual twin-side re-run, unlike state). `features/factory/useTwinManifest.ts` (new, polls `/twin-manifest` every 3s, `{connected, manifest}`). `features/factory/twinTranslator.ts` rewritten around `translateManifest(manifest, state)`. `factoryData.ts` — deleted; confirmed unused after `FactoryNodeData`/`FactoryStatus`/`formatFactoryStatus` moved into `twinTranslator.ts` (the sole remaining producer of Factory's node shape) and every consumer (`FactoryLayout`, `FactoryBrowse`, `FactoryInspector`, `FactoryCanvas`, `FactoryNode`) was repointed. Factory's Browse panel is now unconditionally flat (no fixture fallback, no line grouping) — the real cell has no line concept at all. `FactoryNode`'s CSS lost its now-dead `line`/`cell`/`machine`/`station` tier variants along with the fixture; gained an `--unknown` status variant (muted left-edge strip).

**Live-verified this pass:** ran `run_twin_headless.py` + `twin-bridge/server.mjs` + the FF dev server together — `/twin-manifest` confirmed serving all 13 real identities, `/twin-state`'s `frame` confirmed actively advancing through the bridge, `tsc -b --force` clean, and every changed module confirmed transformable by Vite with no resolution/syntax errors. **Not confirmed:** an actual in-browser screenshot — no browser automation tool was available in that environment/session. If a future session has one (Playwright etc.), a visual check of `/factory` (13 nodes, 6 shown with muted "unknown" styling) is the one piece of this still worth doing by eye.

**Explicitly not started:** Robotics being wired to the bridge/manifest (deliberately waiting for the pattern to prove out on Factory first, now that it has — see gap #5), WebSocket upgrade (still polling), any live KPIs, and surfacing real per-subsystem numerics (`cycles`, `bridge_x`, `angle_deg`, etc. — `FactoryPayload`'s shape still has no slot for them; a real finding for a later pass, not forced into an unrelated field). The bridge's CORS is still hardcoded to port 5173 specifically — a dev server on any other port (e.g. Vite falling back to 5174 because 5173 was occupied) will be silently CORS-blocked. Check for an already-running dev server on 5173 before starting a new one.

---

## 7. Standing Engineering Discipline (apply to all future work)

These aren't preferences — they're patterns that held up repeatedly this session and are worth carrying forward automatically:

- **Promote to `framework/` only on a second or third real consumer**, never speculatively. Every shared primitive in `framework/ui` and `framework/viewport` exists because at least two features needed the identical thing, not because it seemed like good architecture in the abstract.
- **Don't fabricate data where real data exists or is knowable.** Robotics' subsystem structure, Scheduling's 5-type taxonomy, Construction's real project names, and Genealogy's real QR/prefix scheme all came from real project history/source files, not invention. Manufacturing has zero fabricated geometry — an honest empty state instead. Extends to *derived* fields too: Factory's live twin status never fabricates a "down"/fault state the twin doesn't actually expose.
- **`tsc -b --force` after every change, before every delivery.** Zero tolerance for shipping with type errors. Now that `npm run dev` is confirmed runnable in this environment, prefer an actual live check (like the Twin Bridge slice got) over `tsc` alone whenever the change has a runtime surface to observe.
- **Sequence, don't stack.** Every time a new idea arrived mid-task (the digital twin proposal during Factory polish; the ribbon redesign during Sprint 8; migrating Genealogy/Factory/Robotics off `BrowseList`'s `indent` mode during the Construction browse-tree task), it got explicitly deferred to its own milestone rather than absorbed into whatever was in flight.
- **One-file-per-subject discipline extends to CSS now too** — the design tokens are the single source of truth; components read `var(--ff-*)`, they don't hardcode hex or Tailwind color scales.
- **Investigate before building, and report real findings before writing code** — not just for the twin's own codebase (which has always required this) but for any FF work that depends on an external, real data source. The Twin Bridge slice's Step 0 (read the real `state.json`, the real write code, the real cadence, before touching `useTwinState.ts`) is the model: it surfaced the object-model mismatch that would have otherwise gotten silently papered over by forcing live data into the fixture's shape.
- **When a real data source doesn't map cleanly onto an existing fixture shape, say so and use the real shape — don't force it.** Construction's real projects, Factory's real subsystem count (twice now — 7 was already a correction, 13 corrected it further), and Genealogy's real DAG structure all diverged from what the fixture/original design assumed. In each case the fix was to let the real structure be what it is (a flat Browse list instead of a line-grouped one, a DAG-compatible `indent` mode instead of a `children` tree, real node counts instead of fictional ones) rather than distorting the data to fit.
- **Never hardcode an external system's current shape into FF when that system can grow.** The specific, hard-learned version of the rule above: a translator that hardcodes "these are the N things that exist" is already wrong the moment the source system changes, even if it's correct today — this is exactly what forced the 7-node Twin Bridge slice to be replaced by the manifest-driven rewrite in §6.3. Prefer consuming a self-describing manifest/schema over enumerating identities by hand, whenever the source system can plausibly grow.
- **After any crash or interruption, verify real on-disk state before resuming — never assume completion from the last thing that was asked for.** A crash doesn't damage saved files, but it does make "what actually got finished" genuinely unknown until checked (`git status`/`git diff` now that this project is version-controlled, `tsc -b --force`, and actually reading the files in question). This is what caught the manifest-driven rewrite never having actually been written to disk, ahead of this pass.
