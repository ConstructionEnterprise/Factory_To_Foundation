# CE_RECOVERY Index

**Package status:** Phase 1 (reconnaissance) closed, Phase 2 (preservation) closed, Cold Start Test executed and passed — see status summary below.
**Repository:** `Factory_To_Foundation`
**Created:** 2026-08-17
**Last major update:** 2026-08-19
**Recovery objective:** Preserve the executable history, current implementation record, state, deployment path, and minimum viable reconstruction capability of Factory » Foundation independently of the current AWS and AI-tooling environment.

**See also:** `AI_Dispatch/CE_RECOVERY/CROSS_REPOSITORY_DEPENDENCY_MAP.md` — this repo is one of **four** (`CE_Forge`, `Construction_Enterprises`, `Factory_To_Foundation`, `AI_Dispatch`), and none is independently recoverable to full functionality. That document covers the real filesystem/hardcoded-path coupling to `Construction_Enterprises` and the orchestration relationship with `AI_Dispatch`.

**Architecture verification correction (2026-08-18, high-value recovery fact):** `CE_Forge` does not feed `Construction_Enterprises`. `CE_Forge` writes directly to Factory » Foundation through its own real API. `Construction_Enterprises` is an independent system with separate runtime/twin integrations into Factory » Foundation. The originally assumed linear chain (`CE_Forge → Construction_Enterprises → FF`) was never evidenced anywhere and has been corrected — see the cross-repository map above for the real topology.

## Recovery sequence — real progress

```text
BUILD → FREEZE → DOCUMENT → SNAPSHOT → AWS EXPORT → GCS MIRROR → COLD-START VALIDATION → RECOVERY-READY
  ✅       ✅        ✅         ✅          ✅ (logical)    ✅ (verified)     ✅ (executed & passed,      ✅
                                                                              2026-08-19)
```

## Phase status summary

- **Phase 1 (reconnaissance): CLOSED.** All four repos inspected with real evidence, cross-repo topology mapped and corrected (see the architecture-correction note above), AWS resources inventoried read-only.
- **Phase 2 (preservation): CLOSED.** All four repos committed and pushed to GitHub; local git-bundle snapshots (verified, checksummed); logical database export (restore-tested, verified, zero data-integrity defects); business-archive documents copied and verified into a private location (originals untouched); real cold-start deployment procedure written (`15_DEPLOYMENT.md`); **GCS recovery archive created, configured, populated (98 real files, ~4.9 MB), and fully round-trip-verified (full re-download + checksum comparison, zero discrepancies) — see `GCS_INVENTORY.md`.** All three independent-redundancy layers (GitHub / git bundles / GCS) are now real and verified.
- **Cold Start Test: EXECUTED AND PASSED, 2026-08-19.** Real GCS download into an isolated environment with no access to any existing local checkout; MVP Recovery target achieved (Postgres → backend → frontend, real restored data, confirmed via API and a live logged-in browser session); 5 real defects found in the package and fixed in the same pass, including reconstructing a previously-deleted, unpreserved restore-loader script (`backend/scripts/cold-start-restore.ts`, now committed). Full detail: `19_KNOWN_ISSUES.md`, `15_DEPLOYMENT.md` §21.
- **Not yet done, deliberately**: native RDS snapshot (blocked on a real IAM gap, exact policy proposed in `20_NEXT_ACTIONS.md`), S3 object-level export (same IAM gap), client-side encryption of the GCS archive (real, disclosed gap — see `17_GCS_RECOVERY.md`).

## Canonical documents

Two distinct statuses are used deliberately, per explicit instruction — do not conflate them:

- **VERIFIED ARTIFACT** — this document's own content is the real, evidence-based record. Trust what it says.
- **TEMPLATE / NOT YET CONSOLIDATED** — this specific file is still the original placeholder. The real underlying information may already exist (cited below, per file), but has not been written into *this* document. Do not infer completeness from this package's file listing alone — check the cited real location instead.

| File | Role | Status |
|---|---|---|
| `01_CURRENT_STATE.md` | Forensic repository reality | **VERIFIED ARTIFACT** — evidence-based, real commands/paths cited throughout |
| `02_ARCHITECTURE.md` | System boundaries and data flow | **VERIFIED ARTIFACT** — real ports/layering/CE_Forge ingestion chain traced |
| `03_DATABASE_SCHEMA.md` | Persistent state and restoration | **TEMPLATE / NOT YET CONSOLIDATED** — real schema is `backend/prisma/schema.prisma` (38 migrations, already in the git bundle) and the restore-tested export in `AI_Dispatch/backups/FF-RECOVERY-v1.0/databases/`; this file itself has not been written |
| `04_API_REFERENCE.md` | Service contract | **TEMPLATE / NOT YET CONSOLIDATED** — 43 real route files exist at `backend/src/routes/`, named (not documented) in `01_CURRENT_STATE.md` only |
| `05_FRONTEND_MAP.md` | UI and route reconstruction | **TEMPLATE / NOT YET CONSOLIDATED** — no real content gathered anywhere yet |
| `06_CE_FORGE_PIPELINE.md` | Generator and ingestion pipeline | **TEMPLATE / NOT YET CONSOLIDATED** — real content exists in `CE_Forge/CE_RECOVERY/01_CURRENT_STATE.md` and this repo's own `02_ARCHITECTURE.md` ingestion-chain section; not copied into this file |
| `07_SYNTHETIC_DATA_CATALOG.md` | Reproducible representative data | **TEMPLATE / NOT YET CONSOLIDATED** — no real content gathered anywhere yet |
| `15_DEPLOYMENT.md` | Rebuild and deployment path | **VERIFIED ARTIFACT** — real 20-step cold-start procedure, LOCAL/AWS/OPTIONAL/UNAVAILABLE tagged throughout |
| `16_AWS_INFRASTRUCTURE.md` | Current AWS environment | **VERIFIED ARTIFACT** — real, read-only resource inventory with LIVE/REQUIRED/OPTIONAL/UNKNOWN classification |
| `17_GCS_RECOVERY.md` | Recovery archive and retrieval | **VERIFIED ARTIFACT** — real archive exists at `gs://ai-dispatch-504810-ff-recovery/CE_RECOVERY/`, uploaded and fully round-trip-verified; see `GCS_INVENTORY.md` for the complete breakdown |
| `GCS_INVENTORY.md` | Real GCS archive inventory | **VERIFIED ARTIFACT** — 98 files, ~4.9 MB, full verification evidence |
| `18_ENVIRONMENT_VARIABLES.md` | Redacted secrets and configuration inventory | **TEMPLATE / NOT YET CONSOLIDATED** — real variable names exist correctly in `01_CURRENT_STATE.md` and `15_DEPLOYMENT.md`; no single inventory with owner/rotation-method per variable exists yet |
| `19_KNOWN_ISSUES.md` | Recovery-impacting defects | **VERIFIED ARTIFACT** — 3 real entries: the Logistics Flow deep-link bug (still disputed, pending the human owner's own repro), the test-suite absence, and the 2026-08-19 Cold Start Test (5 defects found and fixed) |
| `20_NEXT_ACTIONS.md` | Concrete remaining work | **VERIFIED ARTIFACT, actively maintained** — real punch list, updated each session |

## Required archive layers

1. **Git repository:** executable history, source, scripts, migrations, generators, and tags.
2. **`CE_RECOVERY/`:** factual reconstruction guide tied to repository commits.
3. **Data archives:** database exports, native artifacts, object-storage manifests, uploaded assets, and synthetic datasets.
4. **GCS recovery copy:** real, uploaded, checksum-verified archive with manifest — see `GCS_INVENTORY.md`. Relies on GCS's default encryption-at-rest + strict IAM (private, project-scoped); client-side encryption on top was not applied this pass (real, disclosed gap).
5. **Independent second copy:** copy outside both AWS and GCP where feasible.

## Cold-start acceptance test

A technically competent person must be able to reconstruct the MVP Recovery target using only the repository, this directory, database backup, GCS recovery package, redacted environment-variable inventory, and deployment instructions. Any unanswered question becomes a recovery defect.

**Executed 2026-08-19 — PASSED.** See `19_KNOWN_ISSUES.md`'s "Cold Start Test" entry and `15_DEPLOYMENT.md` §21 for full evidence.

## Integrity record

| Artifact | SHA-256 | Location | Verified |
|---|---|---|---|
| `Factory_To_Foundation.bundle` (git bundle, full history, `f14a19c`) | `ba61ebe7...8df4307` (full hash in `CHECKSUMS.sha256`) | Local (`AI_Dispatch/backups/FF-RECOVERY-v1.0/source-and-infrastructure/`) **and** GCS (`gs://ai-dispatch-504810-ff-recovery/CE_RECOVERY/01_SOURCE/`) | **Yes** — `git bundle verify` passed; GCS copy checksum-verified via full re-download comparison |
| `Construction_Enterprises.bundle` (`7b6a678`) | `6295f135...dcefa8d` | same (local + GCS) | **Yes** |
| `AI_Dispatch.bundle` (`3d64141`) | `e328f6f3...093c981b` | same (local + GCS) | **Yes** |
| `CE_Forge.bundle` (`cad57d0`) | `90cf7fc9...3701e28b7` | same (local + GCS) | **Yes** |
| `ff-postgres-dev-logical-export-20260818.tar.gz` (logical row-data export, 63 real models) | `13d8c8cc...025bb11` (full hash in `databases/CHECKSUMS.sha256`) | Local + GCS (`.../02_DATABASE/`) | **Yes — restore-tested** (`RESTORE_TEST_RESULTS.md`): all 63 models reloaded with exact row-count parity, 0 orphaned references across 106 real FK constraints; GCS copy checksum-verified. Still a logical export, not a native RDS snapshot (see `20_NEXT_ACTIONS.md` for the IAM gap blocking the native form) |
| Business archive (8 real Investor/Executive/Risk documents) | Per-file SHA-256 in `business-archive/CHECKSUMS.sha256` + `BUSINESS_ARCHIVE_MANIFEST.json` | Local + GCS (`.../05_BUSINESS_PRIVATE/`) | **Yes** — every copy verified byte-for-byte identical to its original at copy time, and again after the GCS round-trip. Originals still present at their source location (a separate, not-yet-made decision) |
| `CE_RECOVERY` full archive (98 real files, ~4.9 MB) | `FULL_ARCHIVE_CHECKSUMS.sha256` (in `08_MANIFESTS/`, both local and GCS) | `gs://ai-dispatch-504810-ff-recovery/CE_RECOVERY/` | **Yes** — full re-download + file-for-file checksum comparison against the original staged copy, zero discrepancies across all 98 files. Not client-side encrypted (see `17_GCS_RECOVERY.md`'s Known Limitations) |
| Object-storage archive (real S3 bucket contents) | _To generate_ | _To record_ | _No_ — blocked on the same IAM gap as the native RDS snapshot |
| Full recovery package (including future S3 export + native RDS snapshot) | _Partial — see individual rows above_ | `gs://ai-dispatch-504810-ff-recovery/CE_RECOVERY/` | **Partial** — everything currently possible from this machine's real access is done and verified; the two IAM-gated items remain open |
