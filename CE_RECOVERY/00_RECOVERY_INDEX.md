# CE_RECOVERY Index

**Package status:** Draft baseline  
**Repository:** `Factory_To_Foundation`  
**Created:** 2026-08-17  
**Recovery objective:** Preserve the executable history, current implementation record, state, deployment path, and minimum viable reconstruction capability of Factory » Foundation independently of the current AWS and AI-tooling environment.

**See also:** `AI_Dispatch/CE_RECOVERY/CROSS_REPOSITORY_DEPENDENCY_MAP.md` — this repo is one of **four** (`CE_Forge`, `Construction_Enterprises`, `Factory_To_Foundation`, `AI_Dispatch`), and none is independently recoverable to full functionality. That document covers the real filesystem/hardcoded-path coupling to `Construction_Enterprises` and the orchestration relationship with `AI_Dispatch`.

**Architecture verification correction (2026-08-18, high-value recovery fact):** `CE_Forge` does not feed `Construction_Enterprises`. `CE_Forge` writes directly to Factory » Foundation through its own real API. `Construction_Enterprises` is an independent system with separate runtime/twin integrations into Factory » Foundation. The originally assumed linear chain (`CE_Forge → Construction_Enterprises → FF`) was never evidenced anywhere and has been corrected — see the cross-repository map above for the real topology.

## Recovery sequence

```text
BUILD → FREEZE → DOCUMENT → SNAPSHOT → AWS EXPORT → GCS MIRROR → COLD-START VALIDATION → RECOVERY-READY
```

## Canonical documents

| File | Role | Status |
|---|---|---|
| `01_CURRENT_STATE.md` | Forensic repository reality | Draft |
| `02_ARCHITECTURE.md` | System boundaries and data flow | Draft |
| `03_DATABASE_SCHEMA.md` | Persistent state and restoration | Draft |
| `04_API_REFERENCE.md` | Service contract | Draft |
| `05_FRONTEND_MAP.md` | UI and route reconstruction | Draft |
| `06_CE_FORGE_PIPELINE.md` | Generator and ingestion pipeline | Draft |
| `07_SYNTHETIC_DATA_CATALOG.md` | Reproducible representative data | Draft |
| `15_DEPLOYMENT.md` | Rebuild and deployment path | Draft |
| `16_AWS_INFRASTRUCTURE.md` | Current AWS environment | Draft |
| `17_GCS_RECOVERY.md` | Recovery archive and retrieval | Draft |
| `18_ENVIRONMENT_VARIABLES.md` | Redacted secrets and configuration inventory | Draft |
| `19_KNOWN_ISSUES.md` | Recovery-impacting defects | Draft |
| `20_NEXT_ACTIONS.md` | Concrete remaining work | Draft |

## Required archive layers

1. **Git repository:** executable history, source, scripts, migrations, generators, and tags.
2. **`CE_RECOVERY/`:** factual reconstruction guide tied to repository commits.
3. **Data archives:** database exports, native artifacts, object-storage manifests, uploaded assets, and synthetic datasets.
4. **GCS recovery copy:** encrypted archive with manifest and checksums.
5. **Independent second copy:** copy outside both AWS and GCP where feasible.

## Cold-start acceptance test

A technically competent person must be able to reconstruct the MVP Recovery target using only the repository, this directory, database backup, GCS recovery package, redacted environment-variable inventory, and deployment instructions. Any unanswered question becomes a recovery defect.

## Integrity record

| Artifact | SHA-256 | Location | Verified |
|---|---|---|---|
| `Factory_To_Foundation.bundle` (git bundle, full history, `f14a19c`) | `ba61ebe7...8df4307` (full hash in `CHECKSUMS.sha256`) | `AI_Dispatch/backups/FF-RECOVERY-v1.0/source-and-infrastructure/` (local, not yet mirrored to GCS) | **Yes** — `git bundle verify` passed |
| `Construction_Enterprises.bundle` (`7b6a678`) | `6295f135...dcefa8d` | same | **Yes** |
| `AI_Dispatch.bundle` (`3d64141`) | `e328f6f3...093c981b` | same | **Yes** |
| `CE_Forge.bundle` (`cad57d0`) | `90cf7fc9...3701e28b7` | same | **Yes** |
| `ff-postgres-dev-logical-export-20260818.tar.gz` (logical row-data export, 63 real models) | `13d8c8cc...025bb11` (full hash in `databases/CHECKSUMS.sha256`) | `AI_Dispatch/backups/FF-RECOVERY-v1.0/databases/` (local, not yet mirrored to GCS) | **Yes — restore-tested** (`RESTORE_TEST_RESULTS.md`): all 63 models reloaded with exact row-count parity, 0 orphaned references across 106 real FK constraints. Still a logical export, not a native RDS snapshot (see `20_NEXT_ACTIONS.md` for the IAM gap blocking the native form) |
| `CE_RECOVERY` archive (packaged, encrypted) | _To generate_ | _To record_ | _No_ |
| Object-storage archive | _To generate_ | _To record_ | _No_ |
| Full recovery package | _To generate_ | _To record_ | _No_ |
