# ADR-001 — FF Factory Runtime / Twin Lifecycle

**Status:** **Accepted, IMPLEMENTED, and DEPLOYED TO PRODUCTION — B1 (dedicated Factory Runtime service).** Decision recorded 2026-08-11 (see §8). **Cutover executed and fully verified locally 2026-08-11** (migration plan §7 all steps; §9 Tests A and B/B1/B2 all PASS — process-kill/recovery lifecycle, 30-minute FF-idle observation, and natural auth-token-expiry recovery all confirmed live), **then deployed to real production the same day**: `factory-runtime/` is the real, sole Twin owner on `ff-app-host`; `twin-bridge/` stopped (both locally-renamed to `twin-bridge--DO-NOT-USE/` and, in production, stopped-but-undeleted on the host) — kept intact, unmodified, as the rollback path only, not an active runtime, in both places. Two real bugs found and fixed during local verification (a manifest-response array-spread regression, and the Twin hooks' own bypass of FF's existing auth-refresh mechanism), plus two more found and fixed *during the production deploy itself* (a missing `X-Origin-Verify` header on backend's server-to-server Twin call; `/system/ready` needing both a CloudFront behavior and an ASG-nginx allowlist entry) — see the migration plan's own status block for all four. **Verified against the real public site**, not just APIs: correct readiness banner, all 13 manifest entries, zero console errors. **See the migration plan's own status line for the complete, current record — including the pre-existing, migration-independent `robots.A2`×`roller` CE e-stop this cutover's own testing repeatedly and deterministically reproduced, now four times, including once on real production infrastructure (also documented in CE's own `Chappell_Robotics/CLAUDE.md`).**
**Date:** 2026-08-11
**Supersedes conceptually, doesn't replace on disk:** the current Twin Bridge architecture documented in `frontend/CLAUDE.md` §30 and `twin-bridge/server.mjs`. Nothing there has been changed by this ADR — it's the record of *why* it should, and *what to*, not a rewrite.

This document is the output of a same-day investigation chain (all in `frontend/CLAUDE.md` §30 and this session's own history): the geometry-membership bug → the manifest-vs-live-state finding → the three-cell contract sketch → the Twin lifecycle trace → this. Each step is real evidence, not restated assumption; this ADR cites them rather than re-deriving them.

---

## 1. The problem, stated precisely

`Twin Offline`, `Twin Bridge Offline`, `Twin Starting`, and (implicitly) any future "Twin Recovering" are currently **first-class, deliberately-designed UI states**, independently implemented in at least eight places across FF (`AnalyticsDashboard.tsx` ×2, `RoboticsLayout.tsx` ×3, `RoboticsInspector.tsx`, `ReportsLibrary.tsx`, `FactoryBrowse.tsx`, `FactoryInspector.tsx`, `FactoryGeometryViewport.tsx`'s `RunSimulationButton`) and documented as intentional in `Administration`'s `dataProvenance.ts` ("Shows an honest 'Twin Offline' state... never stale/fabricated data").

This was never one bug. It's the consistent, correct execution of a design premise that this ADR now argues is wrong: **that the Twin is an external service whose reachability is a legitimate thing for the product to have an opinion about.** The counter-premise: the Twin is not external to FF's Factory workspace — it's the thing the Factory workspace *is*. An operator of a real automation system doesn't get shown "PLC Offline" as a mode; a fault gets fixed, and if it can't be fixed instantly, the system reports a fault, not a feature.

---

## 2. Invariants (as given, recorded verbatim as the governing constraints)

1. The CE `IntegratedCell` remains authoritative for Twin behavior and remains Python.
2. FF owns the operational lifecycle of the Factory runtime.
3. The Twin is integral to the Factory runtime, not an optional external service.
4. `Twin Offline`, `Twin Bridge Offline`, `Twin Starting`, and `Twin Recovering` are not valid Factory operating states.
5. Driver failure is an infrastructure/runtime failure, not a user-facing Twin state.
6. The Python Twin remains a child process.
7. The single-instance constraint of the CE Twin must be preserved.
8. The general FF backend must retain its horizontally scalable/stateless architecture.
9. Twin Bridge should cease to be an independent lifecycle boundary.

---

## 3. Current architecture (as investigated, evidence-cited)

```
FF Frontend (browser — no OS/process access at all, hard sandboxing constraint)
       │
       ├── FF Backend (Fastify, Node) ── PostgreSQL         [ASG, horizontally scaled]
       │        no lifecycle link to anything below this line except one
       │        read-only HTTP poll: GET /twin-control/live → /system/ready
       │
       └── twin-bridge (raw Node http, zero-dependency by original design)
                │  spawns via child_process, auto-restarts on unexpected exit
                ▼
           Python driver (twin_headless_driver.py)
                │  imports, calls advance() in a loop
                ▼
           CE IntegratedCell (CE_Integrated_Cell_V3_0-6.py)
```

**Why twin-bridge is separate — historical, not principled (confirmed, not assumed).** twin-bridge predates `backend/` entirely: at the time it was built, it was the *only* FF server-side component that existed. `backend/` (Fastify, Postgres, real auth) arrived later, in the Enterprise Migration phases, and twin-bridge was never folded into it — nothing forced that reconsideration at the time, so it simply stayed separate. Every later addition (its own JWT auth reusing backend's secret over an HTTP call to `/auth/me`, self-healing, `/system/ready`) was layered onto the *existing* separate process. No single decision chose this shape for a stated reason; it's decision-by-default.

**Production topology (confirmed, from the actual deployed architecture):** general backend runs on `ff-backend-asg` — an Auto Scaling Group, multiple stateless instances behind a load balancer. twin-bridge and blender-bridge run on `ff-app-host` — one single, non-scaled EC2 instance, of necessity: **the Python driver is a singleton by construction** (one module-global `cell`, one `state.json`). This is the one real, load-bearing technical constraint in the whole investigation, not incidental: two concurrent driver instances would each maintain a separate `state.json` and corrupt each other the moment both wrote — not hypothetical, this is the exact failure mode already demonstrated live this session (the CE validation-gate file-contention incident), just at container scale instead of stray-process scale.

**What's already correct and should not change:** the Twin's own liveness is already fully decoupled from any browser session — twin-bridge polls the file contract on its own timer, the driver's loop runs regardless of HTTP traffic, closing a tab or leaving one idle has zero effect on the twin. This property is worth stating explicitly so it survives the migration, not just assumed to.

**What's missing today, confirmed directly:** nothing supervises twin-bridge itself. `twin-bridge/package.json` has no `scripts` block at all — not even a bare `start`, let alone a process manager. Confirmed by repeated direct experience this session: killing twin-bridge left it dead indefinitely until manually relaunched, every time, with zero effect on backend or frontend. In production, Docker's `restart: unless-stopped` supervises the *container* — but whether the host itself reliably brings Docker (and therefore the container) back up after a full host reboot was investigated earlier this session and left **unconfirmed** — no systemd unit or boot-time script for `ff-app-host` specifically was found in this repo, unlike the ASG backend, which has explicit userdata because ASG instances are ephemeral by design.

---

## 4. Target architecture

```
FF General Backend  ── PostgreSQL          [ASG, horizontally scaled, unchanged]

FF Factory Runtime  ── single instance     [owns Twin lifecycle end to end]
       │  spawns directly, no intermediate service
       ▼
  CE Python Twin Driver (child process, unchanged)
       ▼
  CE IntegratedCell (unchanged — Python, authoritative, CE-owned)
```

Twin Bridge's *code* (the file-contract polling, the route surface, the self-healing logic already proven this session) doesn't disappear — it relocates and becomes owned by whichever process the Factory Runtime turns out to be, rather than remaining a peer service reachable-or-not over HTTP from FF's perspective.

---

## 5. B1 vs. B2

**B1 — dedicated Factory Runtime service.** A separate deployable process/package (structurally, twin-bridge's own successor — same kind of thing, same host role as `ff-app-host` plays today, but reframed as *the* Factory backend rather than a bolted-on bridge), still distinct from general backend.

**B2 — Factory Runtime mode within the backend codebase.** Same package/repo as `backend/`, same dependencies (Prisma, Fastify, the JWT/RBAC middleware), launched in one of two roles via a flag/env var: "general API" (joins the ASG) or "Factory Runtime" (the one designated singleton instance, also spawns/owns the driver).

| Dimension | B1 | B2 |
|---|---|---|
| **Process ownership** | Separate codebase/package; twin-bridge's logic relocates, largely intact | Same codebase as backend; twin-bridge's route handlers get rewritten into Fastify's style, not just moved |
| **Deployment topology** | A third deployable artifact — but this already matches today's real shape (backend ASG + `ff-app-host` + frontend static assets), so low disruption to existing pipelines | One artifact, two roles — simpler build, but the deploy config must correctly assign the role per target, and that target can no longer be "any ASG member" |
| **Single-instance enforcement** | Structural — enforced by deployment (only ever launch one), no code path where a general instance could accidentally also own the twin | Enforced by a runtime flag — a misconfigured deploy that leaves the flag set on a second instance reproduces the exact multi-writer corruption already demonstrated live this session, just relocated into backend. Real operational risk, not hypothetical. |
| **Failure isolation** | A Factory Runtime crash doesn't affect general backend at all — Logistics/Construction/Genealogy/etc. stay fully up | Achievable, but only if the codebase cleanly separates "any instance can serve this" from "only the Factory-Runtime instance can," **and** routing (load balancer / frontend) is set up to reach that *specific* instance, not any ASG member — a real, non-trivial addition, not free |
| **Startup/shutdown semantics** | Own boot sequence, straightforwardly "spawn/verify driver before considering myself ready" | Same backend boot sequence gains a conditional branch — not fundamentally harder, just one more thing every backend boot has to check |
| **FF authentication** | Can keep reusing backend's JWT secret (as twin-bridge does today); can reduce but not fully eliminate the two-services-checking-auth-independently shape unless a shared internal auth library is factored out | Genuine simplification — same in-process middleware as every other backend route, the current `/auth/me` HTTP round-trip for permission checks disappears entirely |
| **Existing routes** (`/twin-state`, `/twin-manifest`, `/twin-command`, `/twin-control`) | Move to the new service's own port/domain; same shapes | Same shapes, likely namespaced (e.g. `/factory-runtime/...`), same "must reach the right instance" constraint as failure isolation above |
| **Existing hooks** (`useTwinState`, `useTwinManifest`, `useTwinControl`) | Small, mechanical change — point at the new service's URL instead of `TWIN_BRIDGE_URL` | Same mechanical change; potentially collapses to the same origin as everything else (`BACKEND_URL`) if instance-routing is solved, one fewer URL concept exposed to the frontend |
| **CE file-contract ownership** | Unaffected either way — `state.json`/`command_queue.json`/`cell_manifest.json`'s shape and CE-side ownership don't change under either option |||
| **Local development** | Basically unchanged from today's shape — still one more terminal/process alongside backend + frontend | Genuine improvement — potentially one process (`FACTORY_RUNTIME=true npm run dev`) instead of a separate one, directly reducing the class of contamination incident this session hit repeatedly from juggling independent processes |
| **Production deployment** | Low disruption — mostly a rename/refactor of what already runs on `ff-app-host` | Backend's deploy artifact is no longer uniform across its own targets — a real, new deployment-pipeline concern |
| **Logging/observability** | Cleanly separated log stream, same as today — easy to tell "twin problem" from "general API problem" from source alone | Mixed into the same process type's log stream unless deliberately tagged by role — minor but real |
| **Scaling to three cells** | **Correction (2026-08-11, post-decision review): not "solved," provides a boundary.** B1 provides a natural runtime boundary for future per-cell runtimes — one Factory Runtime instance per cell is structurally where a second/third cell would go — but **B1 does not itself resolve the three-cell state/command/identity contract** (the `cell_id` file/process-scoping question from the same-day cell-scoping investigation remains fully open and unstarted). Do not read this row as "three cells is now easy" — it means "B1 doesn't foreclose it or make it harder," nothing more. | The same backend codebase would need to support 1 general role + N per-cell singleton roles simultaneously, a combinatorially growing shape — a real added difficulty B1 doesn't have, independent of the point above |
| **Backward compatibility during migration** | Clean — run old twin-bridge and new service side by side on different ports, cut the frontend over, decommission after | Equally clean — new Factory-Runtime-mode instance stood up alongside the still-running old twin-bridge, same cutover pattern |
| **Migration complexity** | Moderate — largely relocating already-working code, not rewriting its shape | Higher — twin-bridge's raw-`http` handlers need porting into Fastify's conventions, plus the role-conditional startup logic, plus resolving instance-specific routing |

**Reading the evidence:** B1 is lower-migration-risk, structurally safer against the single-instance violation, and gives future per-cell runtimes a clean place to live without itself resolving that contract. B2's real advantages (no auth duplication, simpler local dev) are genuine but come with a code-enforced (not structural) single-instance guarantee and materially more migration work. **Decided: B1 — see §8.**

---

## 6. Failure/lifecycle scenarios — current vs. target

| Scenario | Current (confirmed) | Target |
|---|---|---|
| **Python driver crashes** | twin-bridge auto-restarts w/ backoff (2s–60s) — real, already built, already verified live this session | Identical mechanism, now owned by Factory Runtime instead of twin-bridge — relocated, not redesigned |
| **Factory Runtime crashes** *(≈ today's "twin-bridge crashes")* | Nothing supervises it; stays dead until manually restarted; every one of the 8 sites independently shows an Offline variant — confirmed directly, repeatedly | This is the actual gap the ADR exists to close. Requires real process supervision (systemd/Docker restart policy/orchestrator) — the ADR establishes there's *one* thing to supervise, not two, and that the resulting brief restart window is an infra event, not a badge language. It does not, by itself, make restart instantaneous. |
| **General FF backend crashes** | No effect on twin-bridge (already independent) | No effect on Factory Runtime under B1 (fully separate process). Under B2, no effect on the *specific* Factory-Runtime-designated instance (different instance, even if same codebase) — **but under B1, if Factory Runtime still calls back to general backend for permission checks the way twin-bridge does today, a general-backend outage would still degrade Factory Runtime's own auth even though the Twin itself is "up." This residual coupling needs an explicit decision, not an assumption — either accept it, or have Factory Runtime verify JWTs locally without the `/auth/me` round-trip.** |
| **Browser closes** | No effect — already correctly decoupled | Unchanged, preserved deliberately |
| **Browser idle** | No effect on the twin; only affects how promptly one tab's own display refreshes (Chrome background-tab throttling) — a distinct, separate, already-open issue (`frontend/CLAUDE.md` §30.5), not something this ADR resolves | Unchanged — out of scope here |
| **Factory workspace closes** (in-app navigation away) | No server-side effect — purely client-side routing | Unchanged, preserved deliberately — "the factory floor doesn't power down because the supervisor left the office" |
| **FF restarts** (a real redeploy) | Backend and twin-bridge redeploy independently, on independent schedules — has caused real, confirmed bugs this session's own reading surfaced (stale baked-in URLs, etc.), adjacent to but not caused by this ADR's concerns | A genuine, bounded startup window exists between "Factory Runtime process starts" and "driver confirmed alive and advancing" under any option — **this is a real tension with invariant #4, not silently resolved here.** The invariant likely means this window should present as ordinary application loading (a spinner, a "connecting" affordance no different from any other page load), not as a distinctly-named, semi-permanent "Twin Starting" badge sitting next to otherwise-normal controls. That's a presentation decision worth making explicitly, not a claim that zero-latency startup is achievable. |
| **Host reboots** | **Unconfirmed** whether `ff-app-host` reliably brings Docker (and therefore twin-bridge's container) back up after a full reboot — no systemd unit or boot script found in this repo for that host specifically, unlike the ASG's explicit userdata | Must be closed as a real requirement of this ADR, not optional polish — whatever host runs Factory Runtime needs confirmed, verified boot-time auto-start, under either B1 or B2 |

---

## 7. The governing principle (added at decision time, 2026-08-11)

The investigation surfaced something worth stating as a hard rule, not just an implementation detail:

> **A Factory Runtime is not a service dependency of the Factory application. It is part of the Factory application.**

This changes what the Factory startup sequence conceptually *is*. Not:

```
Load FF
  ↓
Is Twin available?
  ↓
Yes → show Factory      No → show "Twin Offline"
```

but:

```
Start Factory Runtime
  ↓
Establish CE IntegratedCell
  ↓
Establish Twin Runtime
  ↓
Factory becomes operational
```

**If that sequence cannot complete, the Factory Runtime has failed to start — full stop.** That is categorically different from "Factory started successfully and separately discovered the Twin isn't reachable." There is no product state in between "Factory Runtime is up, twin included" and "Factory Runtime is not up." This is the concrete mechanism by which invariant #4 (no `Twin Offline`/`Twin Starting`/`Twin Recovering` as valid states) actually gets enforced, rather than just asserted: it's enforced by *what counts as the process being ready at all*, not by hiding a bad state behind better UI copy.

This directly motivates decision #6 in §9 — the thing to define and expose isn't "is the Twin reachable," it's "has the Factory Runtime finished establishing itself."

## 8. What this ADR does not decide or build

- Does not touch CE. `IntegratedCell` stays Python, stays authoritative, stays untouched (invariant #1).
- Does not resolve the three-cell contract — the cell-scoping sketch from earlier the same day is a separate, compatible piece of work; this ADR's target architecture is *designed* to accommodate it (see the B1 scaling row) without having implemented it.
- Does not implement process supervision, does not rewrite any route, does not touch the frontend hooks, does not deploy anything.

---

## 9. Decision (recorded 2026-08-11)

1. **B1 — dedicated Factory Runtime service.** Chosen for the reasons in §5's evidence table: lower migration risk, structural (not code-enforced) single-instance safety, a clean place for future per-cell runtimes without claiming to have solved that contract (§5's corrected scaling row).
2. **Local development topology: standalone Factory Runtime process.** One more terminal/process alongside backend + frontend, same shape as today's `node twin-bridge/server.mjs`, not a flag on the backend dev server.
3. **Production topology: a dedicated single-instance Factory Runtime deployment, on the existing appropriate host topology initially.** Do not stand up new cloud infrastructure (new instance class, new orchestration layer, etc.) until the runtime itself is proven — reuse the same class of host `ff-app-host` already represents rather than redesigning deployment and runtime ownership in the same pass.
4. **Compatibility: yes — the existing Twin Bridge routes stay live and unchanged in shape during migration.** `/twin-state`, `/twin-manifest`, `/twin-command`, `/twin-control/*` are relocated, not redesigned, for this migration.
5. **Migration sequencing: side-by-side → cutover → verify → retire old bridge.** Full detail in `FACTORY-RUNTIME-MIGRATION-PLAN.md` (same directory) — not expanded further here; this ADR records the decision, the plan document records the steps.
6. **Define the Factory Runtime readiness boundary — not Twin readiness.** Per §7, the thing that gets checked, exposed, and gated on is "has the Factory Runtime finished establishing ownership of its CE Twin" — a single, boolean, process-level fact — not a composed opinion about the reachability of a peer service. This supersedes `/system/ready` *as a concept*, though not necessarily as a literal implementation detail — whether the existing `/system/ready` endpoint gets repointed at this new meaning or replaced outright is a decision for the migration plan, not this ADR.

Host-reboot/boot-time supervision hardening (§6, confirmed unresolved for `ff-app-host` today) and the three-cell state/command/identity contract (§5's corrected row) are explicitly **not** part of this migration — real, tracked, separate follow-on work, not bundled in.

**Next artifact: `FACTORY-RUNTIME-MIGRATION-PLAN.md`** — maps every current `twin-bridge/server.mjs` responsibility to unchanged/refactored/retired, and defines the exact cutover/rollback path. Still no code changes until that plan itself is reviewed.
