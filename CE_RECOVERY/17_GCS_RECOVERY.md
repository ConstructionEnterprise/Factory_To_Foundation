# GCS Recovery

**Status:** VERIFIED ARTIFACT — the real archive exists, is uploaded, and has been fully checksum-verified. Full inventory: `GCS_INVENTORY.md` (same directory).
**Package:** `CE_RECOVERY`
**Last reviewed:** 2026-08-18
**Terminology note:** "GCS" here means **Google Cloud Storage** specifically — the recovery destination — not "GCP" generally.

## Purpose

Google Cloud Storage archive layout, encryption, manifests, checksums, retrieval, and cold-start restoration.

## Real current state: archive live and verified

**Location:** `gs://ai-dispatch-504810-ff-recovery/CE_RECOVERY/`
**Project:** `ai-dispatch-504810` ("AI Dispatch") — the human owner's pre-existing GCP project, independently verified via `gcloud projects describe` (real, `ACTIVE`, billing enabled) before any resource was created. No new project was created — reusing an existing one was the deliberate choice, agreed explicitly, to avoid adding infrastructure complexity during an already-large recovery effort.

Full contents, configuration, and verification evidence: see `GCS_INVENTORY.md`. Summary: 98 real files (~4.9 MB), zero secrets, fully round-trip-verified (uploaded, then completely re-downloaded to a separate location and checksum-compared file-for-file against the original — zero discrepancies).

## Real hard boundary that governed how this happened

Creating a Google Cloud account or completing an interactive login is on the AI session's own prohibited-actions list — absolute, not a permission gate. What actually happened: the human owner already had an existing project (`ai-dispatch-504810`) and completed `gcloud auth login` themselves, interactively, in their own browser. Everything from bucket creation onward (creation, configuration, the test-object validation, the full archive upload, and the full re-download verification) was then executed directly by the AI session — real, executable, authorized end-to-end once that one human-only step was done.

## Controlled rollout procedure — actually followed, in this order

- **Step A — Create**: bucket created (`gcloud storage buckets create`), verified via `describe` (not assumed from exit status).
- **Step B — Configure**: versioning enabled, uniform bucket-level access enabled, lifecycle rule applied (STANDARD → NEARLINE at 30 days), IAM policy checked to confirm zero public exposure — each setting independently re-verified via `describe` after applying, not assumed.
- **Step C — Validate**: one small non-sensitive test object uploaded, downloaded back, SHA-256 compared (exact match), metadata and permissions checked. Only after this passed did Step D begin.
- **Step D — Archive**: the full recovery package assembled locally, secret-scanned (zero real secret values found), uploaded via `gcloud storage rsync`, then **fully re-downloaded to a separate location and checksum-compared against the original staged copy — all 98 files matched exactly.**

No step was skipped, and Step D did not begin until Step C's own verification passed — exactly the sequence agreed before execution began.

## Independent-redundancy principle — now real on all three layers

```text
GitHub (4 real repos, pushed)  →  Git bundles (local, `git bundle verify`-passed)  →  GCS (this archive, checksum-verified)
```

All three are now real and independently confirmed, not aspirational:
- GitHub: all four repos' latest commits pushed and reachable.
- Git bundles: verified at creation time, `AI_Dispatch/backups/FF-RECOVERY-v1.0/source-and-infrastructure/`.
- GCS: this archive, verified via full re-download + checksum comparison (`GCS_INVENTORY.md`).

## Real archive structure (as actually uploaded — see `GCS_INVENTORY.md` for the full per-folder breakdown)

```text
gs://ai-dispatch-504810-ff-recovery/CE_RECOVERY/
├── 00_INDEX/            (recovery index + validation test object)
├── 01_SOURCE/            (4 git bundles + manifest + checksums)
├── 02_DATABASE/          (logical export + restore-test results + manifest + checksums)
├── 03_AWS/               (infrastructure doc + 9 real deploy configs)
├── 04_APPLICATION/       (29 real CE_Forge generator run logs)
├── 05_BUSINESS_PRIVATE/  (8 real Investor/Executive/Risk documents, verified)
├── 06_DOCUMENTATION/     (every CE_RECOVERY/*.md file from all four repos)
└── 08_MANIFESTS/         (top-level checksum tying everything together)
```

`07_SCREENSHOTS/` was proposed but never populated — no real content exists for it yet; not created as an empty prefix.

**Secrets do not go in this archive at any layer** — confirmed via an explicit secret-scan of the entire staged archive before upload (zero real values found; one benign match on the word "password" in a dependency description, verified by inspection).

## Real applied configuration

| Setting | Applied value |
|---|---|
| Project | `ai-dispatch-504810` (existing, reused) |
| Bucket | `ai-dispatch-504810-ff-recovery`, `US-CENTRAL1` |
| Storage class | `STANDARD`, lifecycle → `NEARLINE` at 30 days |
| Versioning | Enabled |
| Uniform bucket-level access | Enabled |
| Public access | None — IAM policy confirmed project-scoped only |
| Encryption | Google-managed at rest (automatic). **Client-side encryption was not applied this pass** — real, disclosed gap, see `GCS_INVENTORY.md`'s Known Limitations |

## What's still a real, open item (not this document's call alone)

- Client-side encryption before upload, per the original plan's Non-negotiable Rule 6 — not applied. The archive's real security boundary today is GCS's default encryption-at-rest plus strict IAM (private, project-scoped). Whether to add a client-side layer on top is a real decision still open.
- The Cold Start Test (a third party reconstructing the system from this archive alone) has not been performed.

## Recovery notes

- Integrity table: see `00_RECOVERY_INDEX.md`, now populated with real, verified entries for this archive.
- Retrieval: `gcloud storage cp -r gs://ai-dispatch-504810-ff-recovery/CE_RECOVERY <destination>` reconstructs the full archive locally — the exact command used for this pass's own verification download.
