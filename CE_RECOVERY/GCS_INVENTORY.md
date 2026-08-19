# GCS Recovery Archive — Real Inventory

**Status:** VERIFIED ARTIFACT — the archive exists, is uploaded, and has been fully checksum-verified.
**Date:** 2026-08-18
**Location:** `gs://ai-dispatch-504810-ff-recovery/CE_RECOVERY/`
**Project:** `ai-dispatch-504810` ("AI Dispatch") — the human owner's existing GCP project, real, billing-enabled, verified live via `gcloud projects describe` before use. No new project was created.

## Bucket configuration (real, applied and verified)

| Setting | Value |
|---|---|
| Location | `US-CENTRAL1` |
| Default storage class | `STANDARD` |
| Versioning | **Enabled** (confirmed via `gcloud storage buckets describe`) |
| Uniform bucket-level access | **Enabled** |
| Public access | **None** — IAM policy confirmed project-scoped only (`projectOwner`/`projectEditor`/`projectViewer`), no `allUsers`/`allAuthenticatedUsers` |
| Encryption | Google-managed, automatic (default at-rest encryption) — **client-side encryption before upload was not applied this pass**, a real, disclosed gap (see Known Limitations) |
| Lifecycle | STANDARD → NEARLINE after 30 days |
| Soft-delete retention | 7 days (Google's own default, active) |

## Rollout procedure actually followed

1. **Step A (Create)**: bucket created (`gcloud storage buckets create`), verified via `describe`.
2. **Step B (Configure)**: versioning, uniform access, lifecycle rule all applied and independently re-verified via `describe` after each change (not assumed from command exit status alone).
3. **Step C (Validate)**: one small test object (`00_INDEX/test-object.txt`) uploaded, downloaded back down, SHA-256 compared — exact match. IAM policy checked to confirm no public exposure. Only after this passed did Step D begin.
4. **Step D (Archive)**: full recovery package assembled locally (98 real files, ~4.9 MB total), secret-scanned (zero real values found — one benign match on the word "password" in a dependency description, verified), uploaded via `gcloud storage rsync`, then **fully re-downloaded to a separate location and checksum-compared file-for-file against the original staged copy — all 98 files matched exactly, zero discrepancies.**

## Archive contents (98 real files, ~4.9 MB)

| Folder | Contents | Source |
|---|---|---|
| `00_INDEX/` | This repo's `00_RECOVERY_INDEX.md` + the validation test object | `Factory_To_Foundation/CE_RECOVERY/` |
| `01_SOURCE/` | 4 git bundles (full history, all branches, verified via `git bundle verify`) + manifest + checksums | `AI_Dispatch/backups/FF-RECOVERY-v1.0/source-and-infrastructure/` |
| `02_DATABASE/` | Real logical export (63 models, restore-tested, 0 orphaned FK references) + restore-test results + manifest + checksums | `AI_Dispatch/backups/FF-RECOVERY-v1.0/databases/` |
| `03_AWS/` | `16_AWS_INFRASTRUCTURE.md` + 9 real deploy configs (nginx/userdata/CloudFront/bucket-policy/SPA-fallback) | `Factory_To_Foundation/CE_RECOVERY/` + `Factory_To_Foundation/deploy/` |
| `04_APPLICATION/` | 29 real CE_Forge generator run-output logs (JSON) | `CE_Forge/*/generated/` |
| `05_BUSINESS_PRIVATE/` | 8 real Investor/Executive/Risk documents, SHA-256-verified copies, manifest | `AI_Dispatch/backups/FF-RECOVERY-v1.0/business-archive/` |
| `06_DOCUMENTATION/` | Every `CE_RECOVERY/*.md` file from all four repos | Each repo's own `CE_RECOVERY/` |
| `08_MANIFESTS/` | `FULL_ARCHIVE_CHECKSUMS.sha256` — SHA-256 of all 97 other real files | Generated this pass |

`07_SCREENSHOTS/` was proposed in the original structure but has no real content yet — not created as an empty prefix (GCS has no real concept of empty directories; nothing was uploaded there because nothing real exists to upload).

## Independent-redundancy status (real, current)

```text
GitHub (4 real repos, all pushed)  →  Git bundles (local, checksummed)  →  GCS (this archive, verified)
```

All three layers are now real and independently confirmed:
- GitHub: all four repos' latest commits pushed and verified reachable.
- Git bundles: `git bundle verify` passed on all four at creation time.
- GCS: this document's own verification (full re-download + checksum match).

## Known limitations (honest, current)

- **No client-side encryption was applied before upload.** The archive relies on GCS's default encryption-at-rest plus strict IAM access control (private, project-scoped only) as its real security boundary. This is real protection, not nothing — but it is not the additional client-side-encryption layer the original recovery plan's Non-negotiable Rule 6 called for. A real gap, not silently dropped.
- The retrieval/decryption procedure documented separately from the archive (per the same Rule 6) doesn't yet need to exist since no client-side encryption was applied — revisit if that changes.
- `03_DATABASE_SCHEMA.md`, `04_API_REFERENCE.md`, `05_FRONTEND_MAP.md`, `06_CE_FORGE_PIPELINE.md`, `07_SYNTHETIC_DATA_CATALOG.md`, and `18_ENVIRONMENT_VARIABLES.md` were uploaded as **templates** (per `00_RECOVERY_INDEX.md`'s own VERIFIED ARTIFACT / TEMPLATE distinction) — their presence in this archive does not mean their content is complete.
- The Cold Start Test (a technically competent third party reconstructing the system using only this archive) has **not** been performed.
