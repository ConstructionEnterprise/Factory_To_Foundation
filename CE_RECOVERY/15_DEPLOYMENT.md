# Deployment — Cold-Start Recovery Procedure

**Status:** VERIFIED ARTIFACT — executed end-to-end as a real Cold Start Test 2026-08-19 (see step 21). 5 real defects found by that execution are corrected in this revision.
**Package:** `CE_RECOVERY`
**Last reviewed:** 2026-08-19

## Purpose

A literal, step-by-step cold-start procedure for reconstructing the CE digital system from the recovery package alone — not a generic deployment guide. Every step below is grounded in evidence gathered elsewhere in this package (`01_CURRENT_STATE.md`, `02_ARCHITECTURE.md`, `16_AWS_INFRASTRUCTURE.md`, `AI_Dispatch/CE_RECOVERY/CROSS_REPOSITORY_DEPENDENCY_MAP.md`, and the real restore test in `AI_Dispatch/backups/FF-RECOVERY-v1.0/databases/RESTORE_TEST_RESULTS.md`), not invented for this document.

Each step is tagged:
- **[LOCAL]** — required to run the system locally, on one machine, for development/demo purposes.
- **[AWS]** — required specifically to reconstruct the real production AWS topology.
- **[OPTIONAL]** — a real capability, but separable from the MVP recovery target.
- **[UNAVAILABLE/UNKNOWN]** — cannot currently be completed from this package alone; disclosed, not silently skipped.

---

## 0. Recovery prerequisites

- A Windows machine (this whole system was built and only ever run on Windows — no WSL2 distro exists anywhere in this project's real history, confirmed via `wsl -l -v` early in this project). **[LOCAL]**
- Node.js (developed against v24.18.0) and npm. **[LOCAL]**
- Python 3.14.6, or as close as practically obtainable — see `Construction_Enterprises/CE_RECOVERY/07_RUNTIME_ENVIRONMENT/PYTHON_VERSION.txt` for the exact captured version, `PIP_FREEZE.txt` for the exact captured package list. **[LOCAL, only if reconstructing the twin]**
- A PostgreSQL target — either a fresh RDS instance **[AWS]** or any reachable Postgres 14+-compatible instance **[LOCAL]**. This project has **no local Postgres/Docker capability today** — confirmed absent on the machine this package was built from; the real restore test (see below) used an isolated schema inside the existing `ff-postgres-sandbox` RDS instance instead. A from-scratch recovery machine will need its own Postgres target, local or cloud.
- Real credentials for whichever pieces are being reconstructed — none are stored in this package; see each repo's own `.env.example` for names, and `18_ENVIRONMENT_VARIABLES.md` (still a template — see Known Limitations).

## 1. Clone/restore repositories **[LOCAL]**

Two real options, both evidenced:

- **From GitHub** (if the four real remotes are still reachable): `git clone https://github.com/ConstructionEnterprise/Factory_To_Foundation.git`, and the same pattern for `Construction_Enterprises`, `AI_Dispatch`, `CE_Forge`.
- **From the local git bundles** (if GitHub is unreachable — this is the actual point of the bundles): `git clone AI_Dispatch/backups/FF-RECOVERY-v1.0/source-and-infrastructure/Factory_To_Foundation.bundle <destination>`, same pattern for the other three `.bundle` files.

Real directory-name note: `Factory_To_Foundation`'s real working directories in this project's own history were `C:\Dev\Factory_Foundation_design_pass\` (repo root) and `C:\Users\jchap\Dev\Construction_Enterprises\` (a **different** Dev root under the user's home directory) — **not the same parent directory**. Several hardcoded paths across this project assume this exact split (see step 8). A recovery onto a different machine/user account should either replicate this exact layout or be prepared to find-and-replace every hardcoded reference — see `02_ARCHITECTURE.md` and the cross-repo map for the specific files.

## 2. Verify git bundle checksums **[LOCAL]**

Before trusting any bundle, verify it against `AI_Dispatch/backups/FF-RECOVERY-v1.0/source-and-infrastructure/CHECKSUMS.sha256`:

```
sha256sum -c CHECKSUMS.sha256
```

All four bundles were confirmed matching at archive-creation time (2026-08-18) — see `MANIFEST.md` in the same directory for the exact recorded hashes and the commit each bundle represents.

## 3. Reconstruct `Construction_Enterprises` runtime **[LOCAL, OPTIONAL relative to the MVP target]**

- Install the real captured Python environment: `pip install -r <a requirements.txt generated from PIP_FREEZE.txt>` — **note: `PIP_FREEZE.txt` is a raw capture, not yet turned into a proper pinned `requirements.txt` file; this conversion is a real, simple, not-yet-done step** (see Known Limitations).
- No `pip_dump`/native dependency manifest exists in the repo itself — the captured freeze is the only authoritative source.
- No Docker/deployment automation exists for this repo at all (confirmed, `01_CURRENT_STATE.md`) — the twin runs as a directly-launched Python process.
- **This entire step is separable from the MVP recovery target** (per `02_ARCHITECTURE.md`'s own proposal) — a working Factory » Foundation instance with real Logistics/Construction/Manufacturing data does not require the twin to be running.

## 4. Reconstruct `CE_Forge` **[LOCAL, OPTIONAL — only needed to (re-)populate a database with representative data]**

- Zero dependencies, zero package manager (`CE_RECOVERY/01_CURRENT_STATE.md`) — clone/restore the repo, that's the entire setup.
- Only 4 of 16 domain folders have real generator code: `construction/`, `logistics/`, `scheduling/`, `assets-equipment/` (19 real `.js` files total).
- Real credentials needed: `backend/credentials.local.json` (gitignored, not part of this repo — see `18_ENVIRONMENT_VARIABLES.md`).
- Real safety gate: `ff-client/index.js`'s `REQUIRED_ENVIRONMENT` (env-var controlled as of `9c0ad9c`, default `"development"`) — refuses to write anywhere that isn't confirmed dev/sandbox unless `FF_REQUIRED_ENVIRONMENT` is deliberately set.

## 5. Reconstruct `Factory_To_Foundation` **[LOCAL for dev, AWS for production]**

Real per-service setup (`02_ARCHITECTURE.md`):

| Service | Setup | Port |
|---|---|---|
| `backend` | `npm install`, configure `.env` (see step 7), `npx prisma migrate deploy`, `npm run dev` | 4300 |
| `Factory_To_Foundation/frontend` | `npm install`, `npm run dev` (dev) or `npm run build` (production static assets) | 5173 (dev) |
| `factory-runtime` | `npm install`, requires `Construction_Enterprises` present at its hardcoded path (step 8) if `FACTORY_RUNTIME_MODE=active` | 4103 |
| `blender-bridge` | `npm install`, requires real AWS S3 credentials | 4200 |
| `twin-bridge--DO-NOT-USE` | **Do not run** — retired, superseded by `factory-runtime` | 4100 |

**No automated test suite exists** (confirmed, zero `*.test.ts`/`*.spec.ts` files anywhere) — `npm run typecheck` (backend) and `tsc -b` (frontend) are the real minimum verification available; do not expect `npm test` to exist.

**Correction (2026-08-19, Cold Start Test):** this table originally listed the backend's port as 4310. That was wrong — confirmed live during the Cold Start Test both from `backend/src/server.ts`'s own default (`PORT ?? 4300`) and from every consumer that references it (`factory-runtime/.env.example`, `blender-bridge/.env.example`, `frontend/.env.example` all point `BACKEND_URL`/`VITE_BACKEND_URL` at 4300). The real port is **4300**.

## 6. Restore PostgreSQL **[LOCAL or AWS]**

Real, restore-tested procedure (full detail: `AI_Dispatch/backups/FF-RECOVERY-v1.0/databases/RESTORE_TEST_RESULTS.md`):

1. Stand up a target Postgres instance (RDS or otherwise).
2. Run `npx prisma migrate deploy` from `backend/` against it — applies all 38 real migrations in order.
3. Load the real logical export (`ff-postgres-dev-logical-export-20260818.tar.gz`, 63 real models) via **`backend/scripts/cold-start-restore.ts`** (`EXPORT_DIR=<export dir> DATABASE_URL=... npx tsx scripts/cold-start-restore.ts`) — **do not use Prisma's typed client's `?schema=` URL parameter for a non-default schema; it is confirmed broken in this project's Prisma/adapter version (see `RESTORE_TEST_RESULTS.md` for the exact bug and workaround)**. This script uses raw `pg.Client` with an explicit `SET search_path` instead.
4. If reloading into a fresh, empty target (not a shared schema), the two-phase truncate-then-insert discipline documented in the restore test is not strictly required for cascade-safety — it existed specifically to handle a shared, non-empty target safely. A genuinely fresh database only needs the insert phase for that specific concern. **This does not mean insert order is unconstrained even on a fresh target** — see the self-referencing-FK note below.
5. **This restore procedure has been verified twice now**: the original 2026-08-18 run (sandbox schema, script since discarded) and independently again during the 2026-08-19 Cold Start Test (a genuinely fresh, from-scratch local Postgres instance, using the reconstructed script below). Both runs: all 63 models, exact row-count parity, zero orphaned FK references across 106 real constraints.

**Real gap found and closed, 2026-08-19:** the script used for the 2026-08-18 restore test was a "temporary script" that was deliberately deleted afterward per that session's own cleanup discipline (see `RESTORE_TEST_RESULTS.md` step 5) — it was never preserved anywhere in this recovery package. The Cold Start Test hit this directly: step 3 above could not actually be executed by "a technically competent person" using only the package, because the only artifact describing *how* was prose, not a runnable script. **This has been fixed**: the loader has been rewritten from that prose description and committed as `backend/scripts/cold-start-restore.ts` — a real, reusable, checked-in artifact, not a future action item.

**A fifth real restore-tooling bug was found and fixed while reconstructing the script**, beyond the four already documented in `RESTORE_TEST_RESULTS.md`: **self-referencing foreign keys break table-level insert ordering.** `ConstructionTreeNode.parentId` and `NetworkDevice.uplinkDeviceId` both reference their own table — a topological sort at the *table* level (parents before children) can't resolve a row that references a sibling row in the same table's own insert batch, in whatever order the export happens to list them. **Fix applied in the script**: for any column identified (from Postgres's own `information_schema`, not the Prisma schema) as a self-referencing FK, insert the row with that column NULLed out, then run a second UPDATE pass per table to patch in the real value once every row in that table exists. Verified against real data: 66 patched rows in `ConstructionTreeNode`, 28 in `NetworkDevice`, zero FK violations after.

**Native RDS-snapshot restoration is UNAVAILABLE/UNKNOWN** — the IAM credential used throughout this recovery effort lacks `rds:CreateDBSnapshot`; only the logical export form has been produced and tested. See `20_NEXT_ACTIONS.md` for the exact minimal IAM policy needed to close this gap.

## 7. Configure environment variables **[LOCAL and AWS]**

Real variable names (no values — see `01_CURRENT_STATE.md` and each repo's own `.env.example`):

- `backend`: `DATABASE_URL`, `JWT_SECRET`, `ALLOWED_ORIGIN`, `TWIN_BRIDGE_URL`, `FF_TARGET_ENV`, plus `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`AWS_REGION`/`S3_BUCKET_NAME` — **correction, 2026-08-19: these four are not optional.** `backend/src/lib/s3.ts` calls `requireEnv()` on `S3_BUCKET_NAME` and `AWS_REGION` at module-load time, so the process crashes on startup without them, even if no S3 feature is ever exercised. Confirmed live during the Cold Start Test: the backend would not boot until placeholder values were added. Real deployments need real values; a local/demo recovery that doesn't need working S3 can use any non-empty placeholder string.
- `factory-runtime`: `JWT_SECRET`, `BACKEND_URL`, `ALLOWED_ORIGIN`, `FACTORY_RUNTIME_MODE`, `FACTORY_RUNTIME_PORT`
- `blender-bridge`: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `ALLOWED_ORIGIN`, `JWT_SECRET`, `BACKEND_URL`
- `CE_Forge`: `FF_BASE_URL`, `FF_REQUIRED_ENVIRONMENT`, `FF_QA_*_PASSWORD` (per-role QA credentials)
- Frontend: **correction, 2026-08-19 — this was wrong.** `Factory_To_Foundation/frontend/.env.example` does exist (`VITE_BACKEND_URL`, `VITE_TWIN_BRIDGE_URL`, `VITE_BLENDER_BRIDGE_URL`), and there's a separate `frontend/.env.production` too. No server-side secrets either way — still a static build — but the earlier claim that no `.env.example` exists at all was never actually checked.

A complete redacted inventory with owner/rotation-method per variable is **not yet written** — `18_ENVIRONMENT_VARIABLES.md` is still a template. See Known Limitations.

## 8. Reconstruct local CE ↔ FF filesystem paths **[LOCAL, load-bearing if the twin is wanted]**

Two real, hardcoded couplings (full detail: `AI_Dispatch/CE_RECOVERY/CROSS_REPOSITORY_DEPENDENCY_MAP.md`):

1. `factory-runtime/` polls `C:\Users\jchap\Dev\Construction_Enterprises\state\state.json` and `state\cell_manifest.json` directly off local disk.
2. `factory-runtime/twin_headless_driver.py` hardcodes and `importlib`-loads `C:\Users\jchap\Dev\Construction_Enterprises\Chappell_Robotics\CE_Integrated_Cell_V3_0-6.py` by absolute path.

**Both paths bake in the literal Windows username `jchap`.** A recovery onto any other user account or machine must either (a) recreate a user account named exactly `jchap`, or (b) edit these hardcoded paths in `factory-runtime`'s source before it will find the twin. This is real, disclosed technical debt, not a documentation gap — no environment-variable override exists for either path today.

## 9. Reconstruct FF's API relationship with CE_Forge **[LOCAL]**

Real, evidenced, and the simplest cross-repo relationship of the four (`CE_Forge/CE_RECOVERY/01_CURRENT_STATE.md`): CE_Forge is architecturally indistinguishable from any other authenticated API client. No special ingestion route, no schema exception. Set `FF_BASE_URL` to the running backend's real address, provide real QA credentials, and any of the 19 real generator scripts will work identically to how they worked against the original environment.

## 10. Reconstruct `AI_Dispatch` / n8n **[LOCAL, OPTIONAL relative to the MVP target]**

- Install n8n (native npm global install in this project's own real history — `npm install -g n8n`, confirmed version `2.33.5` at the time of this document).
- Only 2 real workflows exist: `ENG-001` (Active) and `AI-001` (Draft), both exported as JSON in `AI_Dispatch/workflows/` — import via n8n's own "Import from file" mechanism.
- **Real, disclosed caveat**: those 2 JSON exports are only confirmed current as of 2026-08-09 — the live n8n app, not the repo, is the real authoritative source (`AI_Dispatch/CLAUDE.md`'s own stated architecture). A bounded attempt to start n8n and take a fresh export during this recovery effort failed silently (empty log, no listening process) and was not further investigated per explicit instruction — **treat the imported workflows as a known-stale-but-best-available snapshot, not a guaranteed-current one.**
- Neither workflow has any scheduled/webhook trigger — both are Manual-Trigger-only, human-gated by design.

## 11. Configure external SaaS credentials **[OPTIONAL, per-repo]**

- `Factory_To_Foundation`: **none** — AWS only, confirmed no third-party SaaS dependency anywhere in this repo.
- `AI_Dispatch`: real, separate profile — Manus API (credential name `Manus API Key`), Slack (credential name `Slack account`, posts to `#general`), Google Docs (real target doc "AI Dispatch — Categorization Log"). Credential values must be re-established directly in n8n's own credential store (not in any repo's git history) — names only are recorded in `AI_Dispatch/CE_RECOVERY/01_CURRENT_STATE.md`.

## 12. Reconstruct AWS infrastructure **[AWS]**

Full real inventory: `16_AWS_INFRASTRUCTURE.md`. Real topology, in dependency order:

1. VPC (single default VPC in the original — `172.31.0.0/16`).
2. RDS Postgres (`ff-postgres-dev` equivalent — `db.t4g.micro`, Multi-AZ for production fidelity).
3. EC2 instances: one `ff-app-host`-equivalent (runs `blender-bridge` + `factory-runtime`), plus an Auto Scaling Group of backend instances (original: min 2 / max 4 / desired 2, single AZ — a real, disclosed asymmetry against the Multi-AZ database, not something this recovery is obligated to fix).
4. NLBs fronting the ASG (`ff-backend-nlb`-equivalent, 2 target groups for 443/80).
5. S3 buckets: one for the frontend static build, one for deploy-artifact tarballs.
6. CloudFront distribution, origin pointed at the app-host (the original used `sslip.io` wildcard DNS specifically to avoid needing a real Route53 hosted zone — no custom domain was ever set up).

**Real, unresolved item carried over from recon**: `ff-twinbridge-nlb`'s real current purpose was never confirmed (flagged `LIVE/UNKNOWN` in `16_AWS_INFRASTRUCTURE.md`) — a from-scratch AWS rebuild should not assume this component is required without first resolving what it actually served.

## 13. Deploy the application **[AWS]**

Real deploy mechanism (`deploy/` directory, hand-written nginx/userdata/JSON configs — **no Terraform/CDK/CloudFormation exists in this project**): ASG instances pull a deploy-artifact tarball (`ff-app.tar.gz`, containing `backend/`, `blender-bridge/`, `factory-runtime/`) from S3 at boot/redeploy and run `docker compose up -d --build backend`. Migrations are **never automatic** — run manually via SSM (`docker compose exec backend npx prisma migrate deploy`) as a deliberate, established convention in this project's real history.

## 14–18. Validation steps **[LOCAL and/or AWS, as applicable]**

- **14. Validate health**: `curl <backend>/health` → expect `{"status":"ok"}` (confirmed real response shape, used throughout this whole project's own verification history).
- **15. Validate CE_Forge ingestion**: run any one CE_Forge generator against the freshly-stood-up backend; confirm the created row appears via the normal API and a matching row appears in `SyntheticDataProvenance`.
- **16. Validate twin integration**: only applicable if `Construction_Enterprises` was reconstructed (step 3) — confirm `factory-runtime` logs show `"ACTIVE MODE"` and real validation output (`[CONTRACT VALIDATION] PASS`), not a spawn error.
- **17. Validate database**: re-run the same restore-test procedure and acceptance criteria as `RESTORE_TEST_RESULTS.md` — row-count parity across all real models, zero orphaned FK references.
- **18. Validate AI_Dispatch**: only applicable if n8n was reconstructed (step 10) — confirm both imported workflows appear and their Manual Trigger nodes are present; do not expect the CLI branches (`build`/`scripts`/`ff_implementation`) to work without also reconstructing their target repos at the exact hardcoded paths (step 8's caveat applies here too).

## 19. Recovery acceptance criteria (proposed, not yet formally confirmed with the human owner)

The **MVP Recovery target** (per `02_ARCHITECTURE.md`): Postgres → backend → frontend, serving the real Logistics/Construction/Manufacturing/Analytics domains against a CE_Forge-seeded or restored dataset. This alone constitutes a successful minimum recovery. `Construction_Enterprises`/`AI_Dispatch`/full AWS topology are real, valuable, but **separable** extensions beyond the MVP.

## 20. Known limitations (honest, current as of this document)

- `18_ENVIRONMENT_VARIABLES.md` is still a template — variable *names* are scattered correctly across `01_CURRENT_STATE.md` and this document, but no single consolidated redacted inventory with owner/rotation-method exists yet.
- `Construction_Enterprises`'s Python dependencies are captured (`PIP_FREEZE.txt`) but not yet turned into a real pinned `requirements.txt`, and no clean-environment install has been tested. Not exercised by the 2026-08-19 Cold Start Test — the MVP Recovery target is explicitly separable from twin reconstruction (see step 3), and the test respected that.
- Native RDS-snapshot / S3-object-level export are both blocked on a real IAM gap (exact policy proposed in `20_NEXT_ACTIONS.md`, not yet applied).
- n8n's live workflow state cannot currently be freshly exported from this machine — the bounded attempt to start it failed silently and was not investigated further, per explicit instruction not to let this become a debugging rabbit hole during recovery. Not exercised by the Cold Start Test (n8n/`AI_Dispatch` reconstruction is optional relative to the MVP target).
- `ff-twinbridge-nlb`'s real purpose is unconfirmed.
- The hardcoded `C:\Users\jchap\...` paths (step 8) are real, load-bearing technical debt with no environment-variable override today. Not exercised (same reason as the twin/Python item above).

## 21. Cold Start Test — executed and passed, 2026-08-19

This procedure **has now been executed end-to-end**, independently of the AI sessions that wrote it, per Step 18 of `21_FORWARDABLE_AI_EXECUTION_PLAN.md`. Full detail, defects found, and evidence: see the new entry in `19_KNOWN_ISSUES.md` ("Cold Start Test — executed 2026-08-19"). Summary:

- Ran from a real download of the GCS archive (`gs://ai-dispatch-504810-ff-recovery/CE_RECOVERY/`) into an isolated directory with no access to any existing local checkout — not from files already on the machine.
- All 97 archive files and all 4 git bundles passed SHA-256 verification; all four bundle HEAD commits matched `01_SOURCE/MANIFEST.md` exactly.
- MVP Recovery target achieved for real: fresh local Postgres → `prisma migrate deploy` (38/38 migrations) → real data restored via the reconstructed loader (2,194 rows, 63/63 models, 0 orphaned FKs) → backend → frontend, logged in, rendering real project data (Stonepine Residences, Cedarwood Flats, Garden Lofts, Skyline Towers) through the actual UI.
- 5 real defects found in this package during the test; all 5 fixed in this revision (port, frontend `.env.example` claim, S3-env-var-required-at-startup, the deleted restore script, the self-referencing-FK bug) — see steps 5–7 above and `19_KNOWN_ISSUES.md`.
- Twin/`Construction_Enterprises` reconstruction and `AI_Dispatch`/n8n reconstruction were **not** exercised — both are explicitly optional relative to the MVP target (steps 3 and 10), not a gap in this test's coverage.
