# GCS Recovery

**Status:** Draft — real reconnaissance pass, read-only, nothing created or uploaded.
**Package:** `CE_RECOVERY`
**Last reviewed:** 2026-08-18
**Terminology note (per explicit instruction):** "GCS" here means **Google Cloud Storage** specifically — the recovery destination — not "GCP" generally.

## Purpose

Google Cloud Storage archive layout, encryption, manifests, checksums, retrieval, and cold-start restoration.

## Real current state: nothing exists yet

- **No `gcloud` or `gsutil` CLI is installed on this machine** (`where gcloud`/`where gsutil` both failed, confirmed live).
- **No existing Google Cloud project, bucket, or configuration was found or referenced anywhere** in any of the three repos' `CE_RECOVERY` packages, `.env.example` files, or deploy configs inspected so far this session.
- This means GCS is a genuinely **from-scratch setup**, not an existing resource to inventory. This document is therefore a recommendation for what to create, not a record of what exists — clearly distinguished from `16_AWS_INFRASTRUCTURE.md`, which is all real, live, existing resources.

**Per explicit instruction: nothing is uploaded in this pass.** This document establishes the target shape only.

## Recommended structure (proposal, not yet built)

```text
gs://<project>-ff-recovery/
├── FF-RECOVERY-v1.0/
│   ├── portable-core/
│   ├── source-and-infrastructure/
│   │     ├── Factory_To_Foundation/    (full git bundle or tarball)
│   │     ├── Construction_Enterprises/ (full git bundle or tarball)
│   │     └── AI_Dispatch/              (full git bundle or tarball)
│   ├── databases/
│   ├── object-storage/                 (mirrors of the two real S3 buckets)
│   ├── synthetic-data/                 (CE_Forge datasets)
│   ├── business-archive/               (the 9 Investor/Executive/Risk docs from Construction_Enterprises, per BUSINESS_ARCHIVE_CLASSIFICATION.md — private-archive-only material, this is its actual real destination)
│   ├── dns-and-integrations/
│   ├── manifests/
│   └── recovery-tests/
```

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

- Which real Google account/billing profile owns the new project — human-owner decision, needs explicit go-ahead before creation (this is an "Explicit permission required" action per this session's own operating rules: creating accounts is prohibited for an AI to do unilaterally).
- Whether client-side encryption uses a tool already available on this machine or needs a new one installed.
- The exact retrieval/decryption procedure — must be documented and stored **separately** from the archive itself, per the plan's own Non-negotiable Rule 6, and has no draft yet.

## Recovery notes

- This document intentionally has no integrity table, checksums, or "verified: yes/no" entries yet — there is nothing to checksum until something is actually created and uploaded. Compare against `00_RECOVERY_INDEX.md`'s Integrity Record table, which is correctly still all "_To generate_ / _No_" for the same reason.
- Next real action here requires the human owner's decision on the account-ownership question above before any GCP/GCS resource can be created.
