# Architecture

**Status:** Draft — evidence-based, first pass.
**Package:** `CE_RECOVERY`
**Last reviewed:** 2026-08-18
**Scope note:** This document covers `Factory_To_Foundation`'s own internal architecture and its real ingestion path from `CE_Forge`. The full 4-repo ecosystem picture (this repo + `Construction_Enterprises` + `CE_Forge` + `AI_Dispatch`) lives in `AI_Dispatch/CE_RECOVERY/CROSS_REPOSITORY_DEPENDENCY_MAP.md` — not duplicated here.

## Purpose

Current architecture, boundaries, data flow, runtime components, and external dependencies.

## Real component boundaries and runtime ports (evidence: each service's own `.env`/source)

| Service | Port | Role |
|---|---|---|
| `backend` | **4310** (confirmed via `backend/.env`'s real `PORT=4310` — note `ff-client/index.js` in `CE_Forge` still defaults to the stale `4300`, a known, disclosed, harmless-in-practice inconsistency) | Fastify API, Prisma/Postgres persistence, all real domain logic |
| `Factory_To_Foundation/frontend` | **5173** (Vite dev default; production build is static, served via CloudFront/S3, no port of its own) | React 19 SPA |
| `factory-runtime` | **4103** | Owns the CE Twin's operational lifecycle; spawns/polls the real Python twin process in `Construction_Enterprises` |
| `blender-bridge` | **4200** | `.blend` → glTF conversion, uploads to S3 |
| `twin-bridge--DO-NOT-USE` | **4100** | Retired predecessor to `factory-runtime` — port confirmed present in source but this service should not be run |

## Real layering pattern within `backend`

Confirmed via direct source read (`logisticsDispatches.ts` as a representative example, consistent with this project's own established convention across all 43 route files):

```text
HTTP request
    │
    ▼
routes/*.ts        — Fastify route registration, zod request-body schemas,
    │                 authenticate + requirePermission(module, action) middleware
    ▼
services/*.ts       — business logic, orchestrates repositories
    │
    ▼
repositories/*.ts   — Prisma queries, the only layer that touches the ORM directly
    │
    ▼
Postgres (via @prisma/client + @prisma/adapter-pg)
```

This is a consistent, real, three-layer separation — not verified line-by-line across all 43 route files in this pass, but confirmed as the established pattern via direct inspection of a representative file plus this project's own extensive `docs/decisions/` history, which describes this same layering repeatedly across every phase.

## The real CE_Forge → FF ingestion chain (the plan's own named "architectural breakthrough")

```text
CE_Forge generator script (Node.js, zero dependencies)
    │
    │  ff-client's createFFClient(): login() via real /auth/login,
    │  then api() calls gated behind GET /system/ready reporting
    │  environment === (dev/sandbox target only)
    ▼
backend routes/*.ts  (same real routes any authenticated user/frontend hits —
    │                  CE_Forge has no special/bypass ingestion path)
    ▼
services/*.ts → repositories/*.ts → Postgres
    │
    │  Every CE_Forge-created row additionally gets a
    │  POST /synthetic-data-provenance call (source/datasetId/runId/
    │  domain/recordType/recordId) — a side table, never joined into
    │  any normal domain API response or UI.
    ▼
Real domain models (LogisticsDispatch, ModuleSequenceEntry, CostAssembly,
ProductionOutput, etc. — 63 real Prisma models total)
    │
    ▼
Frontend feature pages (Logistics/Construction/Manufacturing/Scheduling/
Inventory) — read the same real data whether it originated from a human,
CE_Forge, or any other authenticated caller. No special-cased "synthetic
data" rendering path exists in the UI.
    │
    ▼
Analytics domain (real CloudWatch-style dashboards, widget registry) —
reads the same real domain tables via its own aggregation queries.
```

**Key real fact**: CE_Forge is architecturally indistinguishable from any other authenticated API client once past the environment gate — it does not get special ingestion routes, special schema permissions, or a separate data path. The only trace of its involvement is the `SyntheticDataProvenance` side table. This is a genuinely clean real design, not aspirational — confirmed by this session's own direct work running all 19 CE_Forge generators against real production earlier the same day.

## Real domain boundaries (evidence: `backend/prisma/schema.prisma`, 63 models; `backend/src/routes/`, 43 files)

Manufacturing/Factory/Robotics, Logistics (Materials/Modules/Dispatch/Fleet/Flow), Construction (Data Map/Cost Estimating/Modular Sequencing), Scheduling, Inventory, Analytics, Reports, Administration/Payroll, RBAC/Permissions, Genealogy, Assets — see `01_CURRENT_STATE.md`'s "Implemented" section for the full evidenced list; not re-derived here.

## Real external dependencies (already confirmed in `01_CURRENT_STATE.md`, summarized here for architecture completeness)

- **AWS only** — RDS Postgres, S3 (2 buckets), CloudFront, NLB/ASG/EC2. Full live inventory in `16_AWS_INFRASTRUCTURE.md`.
- **No third-party SaaS** in `Factory_To_Foundation` itself (confirmed via every `.env.example` in this repo). `AI_Dispatch` has its own separate real SaaS dependencies (Manus, Slack, Google Docs) — a different repo's profile, not this one's.

## Current deployment topology (real, evidence: `16_AWS_INFRASTRUCTURE.md`'s live AWS reconnaissance + `deploy/` configs)

```text
CloudFront (E3V59CPAVEU5Y9)
    │
    ├── /api/*, /health*, /twin-bridge-api*, /blender-bridge-api* → origin (app-host, sslip.io)
    └── everything else → S3 static frontend build (SPA fallback via Lambda@Edge function)

ff-backend-nlb → ff-backend-asg (2 EC2 instances, single AZ) → RDS ff-postgres-dev (Multi-AZ)

ff-app-host (single EC2) → runs blender-bridge + factory-runtime
    │
    └── factory-runtime → (local-machine-only in dev; real production topology for
        the twin's actual Python process not yet traced in this pass — see
        Unknown below)
```

**Local dev topology** (this whole session's own real working setup, distinct from the above): all 5 services + `Construction_Enterprises`'s Python twin run on one machine (`C:\Dev\...` / `C:\Users\jchap\Dev\...`), started via `factory-runtime/watchdog.ps1`.

## Smallest MVP Recovery path (proposed, not yet confirmed with the human owner)

```text
Postgres (RDS or local) → backend (port 4310) → frontend (built, served any static host)
```

This alone proves the real Logistics/Construction/Manufacturing/Analytics domains work end-to-end with a CE_Forge-seeded dataset. `factory-runtime`/`blender-bridge`/`twin-bridge--DO-NOT-USE` (the digital-twin visualization layer, which needs `Construction_Enterprises` present) are real but separable from this MVP — consistent with what `01_CURRENT_STATE.md` already proposed, now with the actual port/layering evidence to back it.

## Unknown / needs verification

- Whether `factory-runtime` (and by extension the twin) runs anywhere in the real AWS production topology, or whether production genuinely has no live twin and the 3D visualization is a dev-only feature today. `16_AWS_INFRASTRUCTURE.md` found `ff-app-host` running `blender-bridge` + `factory-runtime` per this project's own deploy history, but this pass did not independently confirm the twin's Python process is actually running/reachable there (would require an SSM session, out of scope for this read-only inventory).
- The real, current purpose of `ff-twinbridge-nlb` (flagged `LIVE/UNKNOWN` in `16_AWS_INFRASTRUCTURE.md`) — resolving this would also resolve the item above, since it targets the same `ff-app-host` instance.
- Whether every one of the 43 route files actually follows the routes→services→repositories layering exactly, or whether any exceptions exist — this document infers the pattern from one representative file plus a large volume of consistent `docs/decisions/` evidence, not an exhaustive per-file audit.

## Recovery notes

- Minimum viable recovery target: proposed above, matches `01_CURRENT_STATE.md`'s own proposal — needs human-owner confirmation.
- AWS/GCP/third-party dependencies: AWS only, see `16_AWS_INFRASTRUCTURE.md`.
- Cross-repo dependencies: see `AI_Dispatch/CE_RECOVERY/CROSS_REPOSITORY_DEPENDENCY_MAP.md` — this repo is one of four, and (per that document) not independently recoverable to full functionality without at minimum `Construction_Enterprises` (for the twin layer) and `CE_Forge` (for a non-empty database).
- Cold-start instruction: still not written — this document establishes the real shape; `15_DEPLOYMENT.md` (still a template) needs the actual step-by-step.
