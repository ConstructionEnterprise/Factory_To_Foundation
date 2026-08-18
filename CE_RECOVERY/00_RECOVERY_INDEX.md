# CE_RECOVERY Index

**Package status:** Draft baseline  
**Repository:** `Factory_To_Foundation`  
**Created:** 2026-08-17  
**Recovery objective:** Preserve the executable history, current implementation record, state, deployment path, and minimum viable reconstruction capability of Factory » Foundation independently of the current AWS and AI-tooling environment.

**See also:** `AI_Dispatch/CE_RECOVERY/CROSS_REPOSITORY_DEPENDENCY_MAP.md` — this repo is one of three (`Construction_Enterprises`, `Factory_To_Foundation`, `AI_Dispatch`), and none is independently recoverable to full functionality. That document covers the real filesystem/hardcoded-path coupling to `Construction_Enterprises` and the orchestration relationship with `AI_Dispatch`.

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
| `CE_RECOVERY` archive | _To generate_ | _To record_ | _No_ |
| Database archive | _To generate_ | _To record_ | _No_ |
| Object-storage archive | _To generate_ | _To record_ | _No_ |
| Full recovery package | _To generate_ | _To record_ | _No_ |
