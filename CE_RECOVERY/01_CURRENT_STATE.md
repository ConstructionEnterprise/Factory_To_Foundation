# Current State

**Status:** Draft — first evidence-based pass, not yet independently reviewed.
**Package:** `CE_RECOVERY`
**Last reviewed:** 2026-08-18
**Repository root (real):** `C:\Dev\Factory_Foundation_design_pass` — single git repo, remote `https://github.com/ConstructionEnterprise/Factory_To_Foundation.git`. Note: a subdirectory literally named `Factory_To_Foundation/` also exists inside this same repo (holds only `frontend/`) — this is not a nested repo or submodule, just a subdirectory name that collides with the repo's own name. Do not assume `Factory_To_Foundation/` is the repo root; it isn't.
**Branch / commit at time of writing:** `main` @ `2097017` (merge of `8a33ae7` "Add forwardable AI recovery execution plan" with `34a4b8d` "Make Transportation Handoff's dispatch reference a real navigable link"). Working tree clean. **This merge commit exists locally only — not yet pushed to origin**, pending explicit go-ahead.

## Purpose

Forensic record of what exists now: implemented, partial, planned, broken, and unknown.

## Evidence standard

Record repository paths, commit IDs, commands, exports, screenshots, or test results for every material claim. Distinguish **implemented**, **partial**, **planned**, **broken**, and **unknown**. Do not put credentials, private keys, recovery codes, or other secrets in this package.

## Real top-level structure (evidence: `ls -la` at repo root)

| Path | Contents | Role |
|---|---|---|
| `backend/` | Fastify + Prisma API, 63 models, 38 migrations, 43 route files | Core API + persistence |
| `Factory_To_Foundation/frontend/` | Vite + React 19 + TypeScript SPA | Web UI |
| `factory-runtime/` | Node service, owns the CE Twin's operational lifecycle | Digital-twin driver, current/active |
| `blender-bridge/` | `.blend` → glTF conversion service, uploads to S3 | Model pipeline utility |
| `twin-bridge--DO-NOT-USE/` | Predecessor to `factory-runtime/`, retired but not deleted | **Do not run** — name is the disclosure |
| `deploy/` | nginx configs, ASG userdata script, CloudFront distribution config, S3 bucket policy, SPA-fallback Lambda@Edge function | Real, hand-maintained infra-as-config (not Terraform/CDK — see Unknown below) |
| `docs/decisions/` | 9 real dated architecture-decision docs, 2026-08-15 through 2026-08-18 | Authoritative build history for each phase |
| `docs/SYNTHETIC-DATA-RECONNAISSANCE.md` | Pre-CE_Forge investigation of what synthetic data was safe/needed | CE_Forge precursor |
| `docker-compose.yml` (root) | Defines `backend`, `blender-bridge`, `factory-runtime` services | Real deploy unit — this exact compose file is what production's EC2/ASG instances run |
| `CE_RECOVERY/` | This package | — |

Root also has a stray `package-lock.json` with no corresponding root `package.json` (109 bytes) — likely a leftover from an earlier scaffold; **not** a real root workspace. Each subproject (`backend/`, `frontend/`, `factory-runtime/`, `blender-bridge/`, `twin-bridge--DO-NOT-USE/`) has its own independent `package.json` — this is not an npm/pnpm workspace monorepo, just sibling directories.

## Runtimes and package managers (evidence: each `package.json`, `node --version`)

- Node.js `v24.18.0`, npm `11.16.0` (local dev machine's actual installed versions — not pinned anywhere in an `.nvmrc`/`engines` field; **unknown** what the real production containers pin, since Dockerfiles weren't inspected in this pass).
- **backend**: Fastify 5, Prisma 7 (`@prisma/client` + `@prisma/adapter-pg`), zod 4, argon2 (password hashing), jose (JWT), `@aws-sdk/client-s3`. `type: module` (ESM). TypeScript 7 (devDependency).
- **frontend**: React 19, react-router-dom 7, Vite 8, Tailwind 4, `@xyflow/react` (Logistics Flow's map canvas), `@react-three/fiber`/`three` (twin visualization), recharts (Analytics charts), TypeScript ~6.
- **factory-runtime / blender-bridge / twin-bridge--DO-NOT-USE**: minimal, near-zero-dependency Node services (`dotenv` + `jose` only, `blender-bridge` also has the S3 SDK).

## Real commands (evidence: each `package.json`'s `scripts` block)

| Subproject | Dev | Build | Typecheck | Migrate | Seed | Test |
|---|---|---|---|---|---|---|
| backend | `npm run dev` (`tsx watch src/server.ts`) | — (ships as TS via tsx in the real deploy, not compiled) | `npm run typecheck` | `npm run prisma:migrate` (dev) / `npx prisma migrate deploy` (prod, run manually via SSM — see Known Issues) | `npm run prisma:seed` | **none exists** |
| frontend | `npm run dev` (Vite) | `npm run build` (`tsc -b && vite build`) | part of build | n/a | n/a | **none exists** |
| factory-runtime | (no `dev` script listed — started via `factory-runtime/watchdog.ps1` locally, or `docker compose up factory-runtime` in prod) | — | — | n/a | n/a | none |

**No automated test suite exists anywhere in this repository** (confirmed: no `"test"` script in any of the 5 `package.json` files, no `*.test.ts`/`*.spec.ts` files found in this pass — this needs a dedicated follow-up grep to be fully certain, marked **unknown/needs verification** below). Every "verification" this project has relied on so far is manual: `tsc`/`tsc -b` typechecking, live `curl` against real endpoints, and live browser click-through. This is a real, material gap for the Cold-Start Test in Phase 6 of the recovery plan — a person rebuilding this system has no automated way to confirm correctness.

## Implemented (real, deployed to production as of 2026-08-18)

Evidence: `docs/decisions/*.md` (one dated plan doc per phase, each with its own verification section), 38 real Prisma migrations, 43 real route files, and this session's own live `curl`/browser verification against the real production URL (`https://dgzxyhsayte98.cloudfront.net`, backend NLB `https://3-23-62-46.sslip.io`).

- **Manufacturing / Factory / Robotics**: real digital-twin integration via `factory-runtime/` (successor to `twin-bridge--DO-NOT-USE/`), Production Run/Output tracking (Phase 9), Factory Flow with a real 6-stage pipeline including Modular Sequence (added 2026-08-18).
- **Logistics**: Materials, Modules, Dispatch (full staged→in_transit→delivered lifecycle with mileage/tax tracking), Fleet (Vehicle registry), Logistics Flow (FlowPoint/FlowConnection graph + Live Monitor with real linked-asset state).
- **Construction**: Data Map, Cost Estimating (CostAssembly/MarketCostRecord/ProductivityRecord bottom-up SKU costing), Modular Sequencing (real per-project sequence entries + live monitor + transitive blockage propagation).
- **Scheduling**: Schedule/Step persistence, Gantt Timeline + Schedule Map ribbon capabilities.
- **Inventory**: shared `InventoryItem` identity spine joining Logistics/Construction/Manufacturing; Materials as a first-class capability.
- **Analytics**: CloudWatch-style observability dashboards, widget registry, real (non-mocked) charts.
- **Reports**: 7-tab command-ribbon rebuild (End-to-End / Production / Logistics / Inventory / Construction / Genealogy / Document Search), real cross-domain Unit Lifecycle report.
- **Administration**: Payroll Accounts, User Management, RBAC/Permissions.
- **CE_Forge → FF ingestion**: real, gated HTTP integration (`CE_Forge/ff-client/index.js`) — 19 real generator scripts across logistics/construction/scheduling/assets domains, each POSTing through FF's real API and tagging every created row via `SyntheticDataProvenance`. All 19 have now been run against real production at least once (2026-08-18).

## Partial / Known-incomplete

- **Logistics Flow cross-domain navigation**: a clickable "Dispatch: ... ↗" link (Transportation Handoff → Logistics Operations deep link) was added 2026-08-18 (`34a4b8d`) and fixed once for a URL-sync bug (`capability` query param wasn't re-read after a same-page client-side navigation). Re-tested and confirmed working across 4/4 repro attempts, direct load, and back/forward — **but the user reports it still failing in their own live testing after that fix**, and the discrepancy is not yet resolved. See Known Issues.
- **CE_Forge material-quantity data**: fastener count-per-SF and labor-productivity-per-SF were explicitly left unpriced in the one real CostAssembly built this project (`market-cost-generator.js`'s own disclosed gap) — real, sourced dollar figures exist for the priced components only, not a complete assembly.
- **Sandbox vs. production data divergence**: `ff-postgres-sandbox` (local dev target) and `ff-postgres-dev` (real production, confirmed via `CE_Forge/ENVIRONMENT.md`'s own incident record) have been separate databases since 2026-08-12 and have accumulated independent history since. Not a bug — deliberate isolation — but means dev-observed state does not equal production state without explicit verification.

## Broken / open defects

See `19_KNOWN_ISSUES.md` for the full entry-format log. Headline item: Logistics Flow's dispatch-link navigation (above).

## Confirmed via direct check (resolved from "unknown" in this same pass)

- **No test files exist anywhere in the repo** (`find . -iname "*.test.ts*" -o -iname "*.spec.ts*"`, excluding `node_modules`, returned zero results). The "no automated test suite" claim above is now confirmed, not inferred.
- **No third-party SaaS dependency exists.** `backend/.env.example`, `factory-runtime/.env.example`, `blender-bridge/.env.example` (var names only, values never read) show only: `DATABASE_URL` (Postgres/RDS), `JWT_SECRET` (self-managed, not a third-party auth provider), `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`AWS_REGION` (S3, for blender-bridge's model uploads), and internal service URLs (`TWIN_BRIDGE_URL`, `BACKEND_URL`, `ALLOWED_ORIGIN`). No Stripe, Auth0, SendGrid, or equivalent. This means AWS is the only real external cloud dependency to replace — materially simplifies the recovery plan's Phase 4 (external-integration inventory).
- Frontend has **no** `.env.example` at all — confirms the frontend has no server-side secrets of its own (consistent with it being a static Vite build served from S3/CloudFront).

## Unknown / needs verification (do not treat as fact until checked)

- Exact Dockerfile contents / base images for `backend`, `blender-bridge`, `factory-runtime`, `twin-bridge--DO-NOT-USE` (files confirmed to exist at their paths; contents not yet read into this document).
- Whether `deploy/` is the complete real infrastructure definition or whether unversioned manual AWS console changes exist on top of it (the plan's own Non-negotiable Rule 3 warns against assuming Terraform/CDK-equivalent completeness — this repo has **no** Terraform/CDK/CloudFormation; `deploy/` is hand-written nginx/userdata/JSON configs only).
- Real current AWS billing/credit state — see `16_AWS_INFRASTRUCTURE.md` (not yet populated with live figures in this pass).

## Recovery notes

- **Minimum viable recovery target (proposed, not yet confirmed with the human owner):** backend + Postgres + frontend, serving the real Logistics/Construction/Manufacturing domains with a CE_Forge-seeded representative dataset. `factory-runtime`/`blender-bridge`/`twin-bridge--DO-NOT-USE` (the digital-twin visualization layer) are real but separable — the business-data chain (CE_Forge → ingestion → domain models → Analytics) does not require the twin to be running.
- Real external/cloud dependencies to resolve before a cold start can succeed: AWS RDS Postgres (`ff-postgres-dev` prod / `ff-postgres-sandbox` dev), S3 (frontend bucket + deploy-artifacts bucket), CloudFront, an NLB in front of the backend ASG. No non-AWS SaaS dependency was found in this pass (no Stripe/Auth0/SendGrid-style third party confirmed) — **unknown**, needs a real `grep` of `.env.example` files across all 5 subprojects to confirm exhaustively.
- Cold-start instruction is **not yet written** — this file is evidence-gathering only; `15_DEPLOYMENT.md` needs the actual step-by-step.
