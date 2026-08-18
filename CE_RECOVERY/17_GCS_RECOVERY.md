# GCS Recovery

**Status:** Draft — real reconnaissance pass, read-only, nothing created or uploaded.
**Package:** `CE_RECOVERY`
**Last reviewed:** 2026-08-18
**Terminology note (per explicit instruction):** "GCS" here means **Google Cloud Storage** specifically — the recovery destination — not "GCP" generally.

## Purpose

Google Cloud Storage archive layout, encryption, manifests, checksums, retrieval, and cold-start restoration.

## Real current state: nothing exists yet

- **No `gcloud` or `gsutil` CLI is installed on this machine** (`where gcloud`/`where gsutil` both failed, confirmed live).
- **No existing Google Cloud project, bucket, or configuration was found or referenced anywhere** in any of the four repos' `CE_RECOVERY` packages, `.env.example` files, or deploy configs inspected this session.
- This means GCS is a genuinely **from-scratch setup**, not an existing resource to inventory. This document is therefore a recommendation for what to create, not a record of what exists — clearly distinguished from `16_AWS_INFRASTRUCTURE.md`, which is all real, live, existing resources.

**Per explicit instruction: nothing is uploaded yet.** This document establishes the target shape and the exact controlled procedure to follow once access exists.

## Real hard boundary — why Step A can't happen from an AI session alone

Creating a Google Cloud account, or completing any interactive login/authentication flow, is on this AI session's own **prohibited-actions** list — not merely something requiring the human owner's sign-off, an absolute boundary regardless of authorization. Concretely, before any part of this document's plan can execute:

1. The human owner creates the Google Cloud account/project and enables billing themselves (console, a few clicks).
2. The human owner either (a) runs `gcloud auth login` interactively themselves on this machine, or (b) creates a service-account key and hands the key file to the AI session.
3. Only then can bucket creation, configuration, the test-object validation, and the real archival upload proceed — all real, executable steps once access exists.

## Controlled rollout procedure (agreed 2026-08-18, execute in this exact order)

Do **not** jump straight to a full upload. Four distinct, separately-verified steps:

- **Step A — Create**: the dedicated GCP project + bucket (human owner does the project/billing part per the boundary above; bucket creation itself can be done by the AI session once authenticated).
- **Step B — Configure**: region/location, versioning, encryption, lifecycle policy, access control, naming convention — see the configuration table below.
- **Step C — Validate**: upload one small, non-sensitive test artifact first. Verify upload succeeded, retrieval works, the downloaded copy's checksum matches the original, object metadata is correct, and access permissions are as configured. **Do not proceed to Step D until Step C passes.**
- **Step D — Archive**: only after Step C passes, perform the real upload of the full recovery package.

## Independent-redundancy principle (explicit, load-bearing)

The four repository git bundles (`AI_Dispatch/backups/FF-RECOVERY-v1.0/source-and-infrastructure/`) remain the deepest source-preservation layer, **independent of GCS**:

```text
GitHub  →  Git bundles (local)  →  GCS (cloud mirror)
```

If GitHub becomes unreachable, the bundles survive. If this workstation is lost, GCS survives. If GCS is ever unavailable, GitHub still has the real repos. Do not treat GCS as replacing either of the other two layers — it is the third, independent copy, not a consolidation of the first two.

## Recommended structure (proposal, not yet built)

```text
gs://<project>-ff-recovery/CE_RECOVERY/
├── 00_INDEX/                    (this package's own index + phase status)
├── 01_SOURCE/
│   ├── Factory_To_Foundation/   (git bundle)
│   ├── Construction_Enterprises/(git bundle)
│   ├── AI_Dispatch/             (git bundle)
│   └── CE_Forge/                (git bundle)
├── 02_DATABASE/
│   ├── logical-snapshot/        (ff-postgres-dev-logical-export-20260818.tar.gz)
│   ├── restore-test/            (RESTORE_TEST_RESULTS.md)
│   └── manifests/
├── 03_AWS/
│   ├── infrastructure/          (16_AWS_INFRASTRUCTURE.md)
│   ├── resource-inventory/
│   ├── deployment/              (deploy/ configs)
│   └── manifests/
├── 04_APPLICATION/
│   ├── exports/
│   ├── generated-data/          (CE_Forge synthetic datasets)
│   └── artifacts/
├── 05_BUSINESS_PRIVATE/         (the 8 real Investor/Executive/Risk documents — strict access control, separate from everything else)
├── 06_DOCUMENTATION/            (the rest of CE_RECOVERY/'s own .md files)
├── 07_SCREENSHOTS/
└── 08_MANIFESTS/                (top-level checksums tying every layer together)
```

**Secrets do not go in this archive at any layer** — it contains inventories and recreation instructions (variable names, IAM policy proposals, credential *identifiers*), never actual secret values, matching the same discipline already applied to every git commit this recovery effort has made.

## Recommended configuration (proposal, not yet applied)

| Setting | Recommendation | Rationale |
|---|---|---|
| Project | A new, dedicated GCP project (not reused from anything else) | Cost isolation, clean IAM boundary |
| Bucket region/location | `us-east4` (Ohio) or `us-central1` — closest real GCP regions to the AWS `us-east-2` resources being mirrored | Minimize egress cost/latency for the initial upload |
| Storage class | **Standard** for the first 30 days (active recovery-build phase), transition to **Nearline** or **Coldline** via lifecycle rule once `FF-RECOVERY-v1.0` is tagged and stable | This is an active recovery build right now, not long-term cold storage yet |
| Versioning | **Enabled** | Protects against an accidental overwrite during the archival phase itself |
| Encryption | Google-managed encryption at rest (default) is real and automatic; **client-side encryption before upload** (per the plan's own Non-negotiable Rule 6) is a separate, additional step this document does not yet specify a tool/method for |
| IAM | Single owner (the human owner's own Google account), no service-account sharing until a specific automation need is identified | Minimizes blast radius while nothing is automated yet |
| Retention/lifecycle | No hard retention lock recommended yet — this is an active project, not a compliance archive | Revisit once `FF-RECOVERY-v1.0` ships |
| Budget alert | Recommend setting one immediately upon project creation, before any upload | Given the AWS-side financial pressure motivating this whole effort, the same discipline should apply here from day one |

## What still needs a real decision (not this document's call alone)

- Which real Google account/billing profile owns the new project, and completing the account/project creation itself — see the hard boundary above.
- Whether client-side encryption uses a tool already available on this machine or needs a new one installed.
- The exact retrieval/decryption procedure — must be documented and stored **separately** from the archive itself, per the plan's own Non-negotiable Rule 6, and has no draft yet.

## Recovery notes

- This document intentionally has no integrity table, checksums, or "verified: yes/no" entries yet — there is nothing to checksum until Step C's test object exists. Compare against `00_RECOVERY_INDEX.md`'s Integrity Record table, which is correctly still all "_To generate_ / _No_" for the same reason.
- Next real action here requires the human owner to complete Google Cloud account/project creation and hand over access (interactive `gcloud auth login` or a service-account key) — everything from bucket creation onward is a real, executable AI-session task once that happens.
