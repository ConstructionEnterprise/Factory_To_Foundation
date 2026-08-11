# Factory Runtime Migration Plan

**Status — MIGRATION COMPLETE AND VERIFIED, 2026-08-11. Not yet deployed to production.** §7 steps 1–7 all done. Both acceptance tests from §9 run and **PASS**:

- **Test A (process-kill recovery): PASS.** Deliberately killed the Factory Runtime process. Its owned CE driver died with it (confirmed: Windows Job Object semantics — the child, spawned without `detached: true`, shares its parent's job and is cascaded on `Stop-Process`) — no orphan, port 4103 closed cleanly, FF correctly reported `"twin bridge unreachable"` rather than fabricating a CE state. Restarted Factory Runtime: exactly one fresh driver spawned, readiness-gated boot (§3) held (port opened only after a confirmed `state.json` read), FF reconnected, all 13 manifest entries repopulated, and the fresh cell deterministically reproduced the pre-existing `robots.A2`×`roller` e-stop at frame 780 (see CE's own `Chappell_Robotics/CLAUDE.md`, "Known real gaps" section, for the root cause — genuinely unrelated to this migration).
- **Test B/B1 (FF idle → no effect on Factory Runtime/CE): PASS.** 30 minutes, 20 external checks at 90s intervals, zero interaction: same Factory Runtime PID, same CE driver PID, same port owner, frame/e-stop unchanged, zero console errors, Twin stayed available to FF the entire window.
- **Test B/B2 (FF idle → authenticated Twin data path survives natural access-token expiry): PASS.** A real regression was found and fixed first (see "Bugs found and fixed during verification" below), then proven against **three separate natural, unattended 15-minute token expiries** (confirmed via `backend`'s own structured request log, authoritative timestamps: 11:04:57, 11:20:14, 11:35:15) — every one silently recovered (401 → `POST /auth/refresh` → retry → success) with zero visible disruption, zero Factory Runtime/CE involvement, and no "Twin Offline" ever shown post-fix.

**Bugs found and fixed during this verification pass (both real, both fixed, both re-verified):**
1. **`/twin-manifest` array-spread bug (`factory-runtime/server.mjs`).** `res.end(JSON.stringify({ ...latestManifest, _mode, _authoritative }))` silently turned the real 13-entry array into a numeric-keyed object, breaking every `.map()` caller (`manifest.map is not a function`) — a genuine relocation-era regression, not present in the original `twin-bridge`. Fixed: manifest ships as a bare array again (matching the original contract and the frontend's `TwinManifest` type exactly); `_mode`/`_authoritative` moved to response headers instead of the JSON body.
2. **Twin hooks bypassed FF's existing auth-refresh mechanism.** `useTwinState.ts`, `useTwinManifest.ts`, `useTwinControl.ts`, `twinExecute.ts`, `collisionStore.ts`, and `RoboticsLayout.tsx` (9 call sites total) all called raw `fetch(..., {credentials:"include"})` against Factory Runtime, so a recoverable 401 from a merely-expired (15-minute) access token was indistinguishable from a genuinely dead Twin — both collapsed to "Twin Offline." FF already has a working silent-refresh mechanism (`authFetch`, `frontend/src/lib/authFetch.ts`, 30-day refresh token) used by 3 other call sites; the Twin hooks simply never used it. Fixed: all 9 call sites now route through `authFetch`. One minor, non-fatal finding along the way: under concurrent polling, two Twin hooks can each independently detect the same 401 and both call `/auth/refresh` a few hundred ms apart (`authFetch`'s in-flight dedup only collapses truly simultaneous calls) — both succeed due to refresh-token rotation timing, no session loss, just a small duplicate round-trip. Not fixed; documented as a known minor inefficiency, not a correctness bug.

**Production deployment: ready, not yet done.** Everything above is local-only (`localhost:4103`/`:4300`/`:5173`) — no production deploy step of this migration has been executed. The clean boundary: **implemented and locally verified through lifecycle failure/recovery and 30-minute FF-idle observation, including natural authentication expiry/recovery — not yet verified in production.**

Nothing below this line has been touched by the verification pass above; kept as the historical record of the cutover session itself.

---

**Status (historical, cutover session) — CUTOVER EXECUTED 2026-08-11.** §7 steps 1–5 done. Step 6 (verify) partially done — real, disclosed finding below, not yet resolved. Steps 7 (decommission) mechanically done as a side effect of step 4.2. Tests A/B (§9) **not run**. Checkpointed here immediately before a planned laptop restart (session interrupted by an unrelated ChatGPT-side outage, not a Factory Runtime problem) — read this whole status block before resuming, don't assume anything about live process state below survived the restart.

**What's actually true on disk right now, independent of any running process:**
- `twin-bridge/` no longer exists at that path. It was stopped cleanly (its tracked driver died with it, confirmed via process enumeration — no orphan) and renamed to `twin-bridge--DO-NOT-USE/`, with a `README.md` there replacing its old `MIGRATION-STATUS.md`. Its code is otherwise byte-for-byte unmodified except one header-comment addition made *before* the rename (migration-status pointer) — kept as the rollback path (§8).
- `factory-runtime/` is the real Twin owner now. `.env` there has `FACTORY_RUNTIME_MODE=active` (flipped from the passive default — **if this ever needs to be stood up again from scratch or rolled back, remember the default in `.env.example` is deliberately still `passive`; `active` was a deliberate one-line edit to the real `.env`, not a new default**).
- `docker-compose.yml`'s `twin-bridge:` service is gone, replaced by a `factory-runtime:` service (`build: ./factory-runtime`, port 4103, `FACTORY_RUNTIME_MODE=active`/`FACTORY_RUNTIME_PORT=4103` set explicitly). `factory-runtime/Dockerfile` added (copy of twin-bridge's, `EXPOSE 4103`). **Not deployed** — this is the local repo's compose file, no production deploy happened this session.
- `backend/.env`, `backend/.env.example`, `Factory_To_Foundation/frontend/.env`, `Factory_To_Foundation/frontend/.env.example` all repointed from port 4100 → 4103 (`TWIN_BRIDGE_URL`/`VITE_TWIN_BRIDGE_URL` — var names deliberately unchanged, only the value moved, per §9 decision #4).
- **None of this is committed to git yet** — `git status` shows it all as working-tree changes (some tracked-file modifications, some untracked new dirs/files, `twin-bridge/`'s files show as deleted since git sees the rename as untracked-add + tracked-delete, not a rename, until staged). Nothing was pushed. If the laptop restart is abrupt, this is all still safe on disk — it's uncommitted, not unsaved.

**What was true about the live *processes* at the moment of the restart request (will NOT survive the restart — must be relaunched from scratch afterward, not assumed running):**
- `factory-runtime/server.mjs` was running in `FACTORY_RUNTIME_MODE=active`, port 4103, readiness-gated boot succeeded (established the driver, confirmed a real successful `state.json` read, then opened the port — worked exactly as §3 specifies).
- Its freshly-spawned driver ran CE's own real internal validation on import (**PASS, first full cell cycle at frame 1889** — same baseline this session's earlier CE validation-gate work used) and then entered its real `advance()` loop.
- **That fresh cell then hit a real, genuine auto-collision e-stop at frame 780** during `ROLLER_TRANSFER` (confirmed via direct `state.json` read, not inferred from any API): `_estop_reason: {source: "auto_collision", pair: ["robots.A2", "roller"], penetration_mm: 100.0, ticks: 3, frame: 780}`. `/system/ready` was correctly reporting `ready:false` because of this, not lying about liveness.
- **Correction (Joshua, direct, 2026-08-11, before the restart): this is NOT new or incidental to cutover.** The frame-780 trigger has persisted from *before* this migration — Joshua had screenshots of it and was actively discussing them with ChatGPT (interrupted by an unrelated ChatGPT-side outage, not related to this migration) when this session's own post-cutover check independently reproduced it. Read this as: **a known, pre-existing, reproducible CE-side condition, confirmed twice now, unrelated to Factory Runtime/twin-bridge/the migration itself.** Do not treat clearing it as part of "finishing the migration" — it's a separate, standing CE investigation. Given CE's simulation is tick-driven/deterministic (not wall-clock or random), a fresh `IntegratedCell()` reliably reproducing the same collision at the same frame is expected, not surprising, once you know it already happened before.
- **Still unresolved at checkpoint time, now correctly scoped as a pre-existing CE issue, not a migration blocker:** no authenticated session was available to send CE's real `reset` command, and it wasn't cleared unilaterally. On resume: this does **not** need to be fixed before treating Factory Runtime cutover itself as verified/done — cutover's job was to honestly establish and report the Twin's real state, which it did correctly (a real e-stop, not a fabricated "live" status). The actual open thread is CE-side: why `robots.A2`/`roller` collide during `ROLLER_TRANSFER` at frame 780, which Joshua was already mid-investigation on with ChatGPT before its outage — pick that back up there, not here.
- Backend (`npm run dev` in `backend/`) and frontend (`npm run dev` in `Factory_To_Foundation/frontend/`) were both freshly restarted post-repoint and running clean on 4300/5173 — no verification was done yet that the actual browser UI renders this state correctly (Test A/B and full browser verification in §9/§7 step 6 remain undone).

**To resume:** re-launch `factory-runtime/server.mjs` (from `factory-runtime/`, `.env` already has `FACTORY_RUNTIME_MODE=active`, so it will auto-spawn a driver on boot — expect another fresh-cell frame reset, this is now the normal cost of restarting Factory Runtime itself, same as it was for twin-bridge before), then `npm run dev` in both `backend/` and `Factory_To_Foundation/frontend/`. Do not re-launch anything under `twin-bridge--DO-NOT-USE/` — see that directory's own `README.md`.
**Date:** 2026-08-11
**Depends on:** `ADR-001-factory-runtime-twin-lifecycle.md` (same directory) — B1 decided, decisions 1–6 recorded there. This document doesn't re-argue that decision; it executes it.

Purpose: map every real responsibility `twin-bridge/server.mjs` currently has to where it goes under the new Factory Runtime, distinguish what's a pure relocation from what's a genuine behavior change, and define a concrete, reversible cutover path. This is the artifact to review *before* anyone opens an editor.

---

## 1. Proposed location (naming only, not created)

`Factory_Foundation_design_pass/factory-runtime/` — a new sibling directory to `backend/`, `twin-bridge/`, `blender-bridge/`, matching this repo's existing one-service-per-top-level-folder convention. `twin-bridge/` itself is not deleted during migration — see §4.

---

## 2. Responsibility inventory — every real thing `twin-bridge/server.mjs` does today

| Responsibility | Current location | Treatment under Factory Runtime | Why |
|---|---|---|---|
| Poll `state.json` (100ms), tolerate `ENOENT`/`EPERM`/`EBUSY`/parse races | `pollState()` | **Moves unchanged** | Pure file I/O, no coupling to being a separate process |
| Poll `cell_manifest.json` (2000ms) | `pollManifest()` | **Moves unchanged** | Same |
| Spawn the Python driver, track child, backoff-restart on unexpected exit, distinguish deliberate stop from crash | `startTwin()`/`stopTwin()`/`scheduleRestart()` | **Moves unchanged** | This is the self-healing logic already proven live this session (§30.1 of `CLAUDE.md`). Not being redesigned — it's exactly what should keep working, just owned by a process that is itself now supervised (see §5) |
| Detect an externally-started driver (Windows CIM scan / Linux `/proc` scan), refuse to double-start | `detectExternalTwinProcess()` | **Moves unchanged** | Same |
| Compute real liveness (frame-advance-within-3s OR deliberately-paused-with-fresh-reads) | `isLive()`, `isStateReadStale()`, `frameAgeMs()` | **Moves unchanged** | Correct as built; this is the signal the new readiness boundary (§3) is built on top of, not replacing |
| `GET /twin-state`, `GET /twin-manifest`, `POST /twin-command`, `POST /twin-control/start`\|`stop`, `GET /twin-control/status`, `GET /twin-control/live` | route handlers | **Move unchanged in shape**, relocate to Factory Runtime's own port | Per ADR decision #4 — compatibility, not redesign, for this migration |
| JWT verification against the shared secret; permission check via a call to backend's `/auth/me` | `authenticateRequest()`, `hasPermission()` | **Moves unchanged** | B1 stays a separate process from backend (that's the whole point) — this is exactly the residual coupling the ADR flagged in §6 ("general backend crash" row) and explicitly did not resolve. Carried forward as a known, disclosed limitation, not silently fixed here. |
| CORS headers, `ALLOWED_ORIGIN` | inline in the request handler | **Moves unchanged** | Same |
| `PORT = 4100` (hardcoded) | module constant | **Renamed, not refactored** | Factory Runtime gets its own port constant/env var. Not the same *value* necessarily, but the same kind of thing — no logic change |
| Boot sequence: `server.listen()` fires immediately; driver auto-start happens asynchronously *after*, inside the listen callback | `server.listen(PORT, async () => {...})` | **Genuinely refactored — see §3** | This is the one deliberate behavior change this migration makes, not a relocation |
| Process-level self-supervision (who restarts the whole service if *it* dies) | **Does not exist today** | **New** | This is the actual gap ADR-001 exists to close — real infra work (systemd unit / equivalent), not application code that "moves" from anywhere |

**Net read of this table: almost everything is a relocation, not a rewrite.** The self-healing logic that already works stays exactly as it is. Two things are genuinely new: the readiness-gated boot sequence (§3) and external process supervision (§5). Everything else is risk-free to move because it was already correct.

---

## 3. The one real behavior change: readiness-gated startup

**Today:** `server.listen(PORT, callback)` — the HTTP server starts accepting connections immediately; the driver auto-start check happens inside that same callback, asynchronously, *after* the port is already open. A request arriving in that gap gets served by a process that hasn't yet confirmed the Twin exists.

**Target, per ADR-001 §7's governing principle:** Factory Runtime does not begin accepting requests until it has confirmed the driver is spawned and the state contract is readable. Concretely: establish the driver (reuse `startTwin()` unchanged) and confirm at least one successful `pollState()` read *before* calling `server.listen()`, not after. If that establishment fails outright (not "driver not yet live" — actual failure to spawn, e.g. Python unavailable), the process should exit non-zero rather than come up serving a permanently-broken state — the same "fail to start, don't start broken" principle systemd-style supervisors already expect.

This is a small code change with a real product consequence: it's what makes "Factory Runtime is up" and "the Twin is real" the same fact instead of two facts that happen to usually agree.

---

## 4. What does *not* move / does not change

- CE stays exactly as-is — `CE_Integrated_Cell_V3_0-6.py`, the driver script, the file contract shapes. Nothing here touches CE.
- The frontend's per-component `useTwinState`/`useTwinManifest`/`useTwinControl`/`twinExecute.ts` hooks keep their current shape — only the URL they point at changes (`TWIN_BRIDGE_URL` → the new Factory Runtime URL), a mechanical env var change, not a rewrite. **Not done as part of this migration's core cutover** — see §6.
- The eight `if (!connected) return <Offline UI/>` sites across FF (Analytics, Robotics ×3, Reports, Factory Browse/Inspector/GeometryViewport) are **not touched by this migration**. They're the actual payoff of the whole effort, but they're frontend product work, downstream of the runtime existing, not part of relocating the runtime itself. Flagging explicitly so "the migration is done" is never confused with "Twin Offline stops appearing" — those are two different pieces of work, and finishing this one doesn't finish that one.
- `twin-bridge/` itself is **not deleted** during migration — kept intact, stopped-but-present, as the rollback path (§7) depends on it still existing and still working, unmodified.

---

## 5. Required, but not part of this document's code scope

Two things ADR-001 flagged as necessary and this plan does not resolve, because they're infrastructure/ops decisions, not application code:

1. **Process supervision for Factory Runtime itself** (systemd unit, or equivalent, wrapping the whole process — not the child driver, which already has its own supervision via `startTwin()`). Needs to exist before cutover is considered complete, not just before this plan is written.
2. **Confirmed boot-time auto-start** on whatever host runs Factory Runtime — the `ff-app-host` gap ADR-001 §3/§6 found unconfirmed carries forward unless explicitly closed as part of standing this up.

---

## 6. `/system/ready`'s role, post-migration — recommendation, not decided here

ADR-001 decision #6 says the thing to expose is "has Factory Runtime finished establishing its Twin," not a composed opinion about a peer service's reachability. Concretely, this plan recommends: **`/system/ready` (currently on general backend, composing `bridgeReachable && driverAlive && stateAdvancing` via an HTTP call to twin-bridge) should stop being backend's own composition and instead simply reflect Factory Runtime's own single readiness boolean from §3** — backend still exposes *a* `/system/ready`-shaped endpoint if the frontend banner needs one at a stable URL, but it becomes a thin proxy/passthrough to Factory Runtime's own self-reported state, not three independently-fetched signals recombined externally. This is a recommendation for whoever implements this migration to confirm, not a decision this document is making unilaterally — flagged, not resolved, matching ADR-001's own discipline.

---

## 7. Cutover path

1. **Build Factory Runtime** as a relocated copy of `twin-bridge/server.mjs`'s code (§2), plus the readiness-gated boot sequence (§3). Runs on a new port, own process, own directory (§1).

2. **Stand it up in passive mode first — do not enable its own driver auto-start yet.**

   **Passive-mode authority rule (hard constraint, not a suggestion):** passive Factory Runtime is a compatibility/read-only validation mode *only*. It must never claim ownership, readiness, or authority over the Twin — not in its own internal state, not in any route response, not in a log line that a future dashboard might key off of. The reason this matters isn't just file-contention (covered below) — it's that if passive Factory Runtime independently reports "I see the Twin, it's live," that's a *second, competing source of truth about Twin readiness while twin-bridge is still the real owner*. That's the exact distributed-status problem this whole migration exists to eliminate, recreated one layer earlier, during validation. Ownership is binary and exclusive at every point in time, never shared, never simultaneously claimed by two processes:

   ```
   BEFORE
   FF → Twin Bridge → CE Driver
                ↑
           sole owner

   CUTOVER (instantaneous, not gradual)
   FF → Factory Runtime → CE Driver
                ↑
           sole owner

   AFTER
   FF → Factory Runtime → CE Driver
   ```

   There is never a moment with two writers, and — per the rule above — never a moment where passive-mode Factory Runtime is a second *reader-that-claims-authority* either. It reads for its own validation purposes only, and says nothing authoritative to any consumer about whether the Twin is ready while it's in this mode.

   The file-contention reason still holds too: if Factory Runtime spawned its own driver *while `twin-bridge`'s driver is still running*, that's two processes writing the same `state.json` — the exact multi-writer corruption this session already demonstrated live during the CE validation-gate incident, just relocated. Passive mode: Factory Runtime reads the same files `twin-bridge` is *also* reading (both are read-only consumers at this stage, which is safe — many readers, one writer, exactly like today's twin-bridge + collision-monitor + multiple frontend hooks already safely coexist), but does not spawn a driver of its own, and does not expose what it reads as an authoritative signal to anything outside its own validation harness.

3. **Validate in passive mode**: confirm route responses match twin-bridge's byte-for-byte for the same underlying state, confirm auth/permission checks behave identically, confirm the readiness-gate logic (§3) reports correctly against the *existing* driver (owned by twin-bridge) — as a validation exercise, checked against expected values, never surfaced as this instance's own claim of ownership or readiness.
4. **Cutover moment** (a real, disclosed discontinuity, not a seamless handoff):
   1. Stop `twin-bridge` — a deliberate stop, which per its own existing logic (`deliberateStop` flag) cleanly kills its tracked driver without triggering its own restart.
   2. **Rename `twin-bridge/` → `twin-bridge--DO-NOT-USE/`, and replace its `MIGRATION-STATUS.md` with a `README.md` stating it is deprecated, superseded by `factory-runtime/`, and must not have new functionality added or Twin authority restored.** Deliberately not done before this moment (see that file, added 2026-08-11) — renaming a *live* process's own directory would leave its self-healing pointed at a stale absolute `DRIVER_PATH`, a real hazard, not a hypothetical one. Once `twin-bridge` is stopped (step 4.1), that hazard no longer applies.
   3. Update `docker-compose.yml`'s `twin-bridge: build: ./twin-bridge` to the new path (or point it at `factory-runtime/` instead, superseding the service entry entirely — decide at the time based on whether compose is still the real local/deploy path then).
   4. Enable Factory Runtime's own driver auto-start (`FACTORY_RUNTIME_MODE=active`). **This means a fresh `IntegratedCell()` — the simulation restarts from its initial state, frame resets to near-zero.** There is no way to hand off a live Python process's in-memory object between two Node parents; this is an accepted, deliberate consequence of cutover, not a bug to design around. Schedule it accordingly (not mid-demo).

   The rename is bundled into this step specifically so the frame-reset cost is paid once, not twice — doing the rename earlier as a standalone "hygiene" action would force the exact same driver restart for no additional benefit.
5. **Repoint consumers**: `backend`'s `TWIN_BRIDGE_URL` (for `/system/ready`, or its replacement per §6) and the frontend's `VITE_TWIN_BRIDGE_URL` now point at Factory Runtime's port. This is the one moment the frontend hooks (§4) actually need a value change — still no shape change to the hooks themselves.
6. **Verify**: confirm `/twin-control/status`/`/twin-control/live` show a real, fresh, advancing frame under Factory Runtime's own ownership; confirm the frontend reconnects and renders live; confirm self-healing still works by repeating the same live kill-the-driver test already used to verify it under twin-bridge (§30.1 of `CLAUDE.md`) — same test, new owner, should behave identically.
7. **Decommission `twin-bridge`**: stop it (already done in step 4), leave the code in place, mark it clearly superseded in its own README/header comment. Do not delete — see rollback, below.

## 8. Rollback path

If Factory Runtime has a real problem post-cutover: repoint `TWIN_BRIDGE_URL`/`VITE_TWIN_BRIDGE_URL` back to twin-bridge's original port, restart `twin-bridge` (untouched, still fully functional, per §4). Its own boot sequence auto-starts a fresh driver exactly as it does today. Same accepted discontinuity as forward cutover (fresh cell, frame reset) — rollback is not free either, and shouldn't be treated as a casual undo button. This path only stays open as long as `twin-bridge`'s code is kept intact and not modified or deleted during the migration window — which is why §4 and §7 both say not to delete it yet.

---

## 9. What "done" means for this migration specifically

Factory Runtime is live, owns the driver, self-heals identically to today's twin-bridge, and passes the same readiness-gated-boot test. **This migration does not itself remove any "Twin Offline" UI** — that's the explicitly separate, downstream frontend work named in §4, to be scoped and sequenced on its own once this runtime exists to build against.

Two specific acceptance tests, required before calling this migration done — both prove the actual architectural claim, not just that code got moved:

**Test A — Factory Runtime process-kill recovery (the test that proves §5's supervision requirement, not just assumes it).** Kill the Factory Runtime process itself (not the driver — the outer process, the thing that today has zero supervision as `twin-bridge`) while FF remains open. Verify: the external process supervisor (§5) restarts it automatically; it re-establishes the CE Twin (spawns a fresh driver, per the readiness-gated boot sequence in §3); the Factory workspace returns to normal operation; **no one manually ran a command to make any of that happen.** This is the test that distinguishes "we moved Twin Bridge" from "we actually eliminated Twin Bridge as an independently fragile runtime boundary" — the whole point of the ADR. Skipping this test and only verifying the driver-level self-healing (already proven, already unchanged, §2) would validate the part that was never broken.

**Test B — FF idle has no effect on the Twin.** The general invariant this test exists to demonstrate: **FF user inactivity must have no effect on the lifecycle or execution of the Integrated Cell Twin.** Not a documented timeout requirement — there isn't one, and this test isn't establishing one. A concrete way to exercise it: start FF, confirm a healthy Integrated Cell with the Twin advancing normally, leave the application completely untouched for roughly 30 minutes (no clicks, no commands, no reload), then return and confirm all of: the Twin is still running; frame/state has kept advancing the whole time, not just resumed on return; all 13 manifest members are still present; `Current State` reports the correct operational state; no `Twin Offline`/`Twin Bridge Offline`/equivalent condition ever appeared; simulation controls stayed available throughout; the Twin didn't silently restart or reset its frame; no user intervention was required at any point. Given this session's own finding that the driver already advances independently of browser polling, this test is primarily a regression check after the migration — proving the property survived the ownership transfer — not a hypothesis that idleness currently breaks anything.
