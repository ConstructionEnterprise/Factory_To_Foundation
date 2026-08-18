# CE_RECOVERY Package Review Checklist

## Purpose

Use this checklist to determine whether the `CE_RECOVERY/` package is merely documented, **reconstructable**, or **recovery-ready**. Claude and ChatGPT should review the package independently, then reconcile their findings. Every claim must be supported by repository evidence, a command result, a cloud export, a checksum, or a test record.

Use these statuses consistently:

| Status | Meaning |
|---|---|
| **PASS** | Evidence exists and the requirement has been verified. |
| **PARTIAL** | Some evidence exists, but an important gap remains. |
| **FAIL** | The requirement is missing, incorrect, or unverified. |
| **N/A** | The item does not apply; record why. |
| **UNKNOWN** | The reviewer cannot determine the answer from the available evidence. |

Do not mark an item **PASS** because the document contains a plausible description. A description is evidence only when it is tied to a path, commit, command, export, checksum, screenshot, or test result.

## Review gates

The package must pass these gates in order.

| Gate | Name | Required outcome |
|---|---|---|
| **G0** | Repository integrity | The reviewer is examining the correct repository, branch, commit, and `CE_RECOVERY` location. |
| **G1** | Factual completeness | The package describes what exists, what is partial, what is broken, and what remains unknown. |
| **G2** | Rebuild capability | A clean environment can install, start, test, migrate, and seed the application using documented commands. |
| **G3** | State preservation | Databases, object-storage data, synthetic datasets, DNS, integrations, and configuration are preserved or explicitly classified as unavailable. |
| **G4** | Archive integrity | Archives are encrypted, hashed, independently copied, and successfully retrieved. |
| **G5** | Cold-start recovery | A technically competent person can reconstruct the MVP Recovery target without AI history, owner memory, or AWS console access. |
| **G6** | Release baseline | `FF-RECOVERY-v1.0` is tagged with source commit, package commit, hashes, test results, known gaps, and archive locations. |

A package is **Recovery-Ready** only when G0–G5 pass and every remaining exception is explicitly recorded in G6.

## Review protocol

### 1. Confirm the review subject

- [ ] Repository remote is the intended `Factory_To_Foundation` repository.
- [ ] The reviewed branch and commit are recorded.
- [ ] The working tree status is recorded.
- [ ] The reviewer confirms that `CE_RECOVERY/` is at the repository root.
- [ ] The reviewer records the date, reviewer identity, tools used, and review scope.
- [ ] Any uncommitted changes are listed before review begins.

**Evidence to record:** repository URL, branch, commit hash, `git status`, and a file listing.

### 2. Confirm the package index

Review `00_RECOVERY_INDEX.md`.

- [ ] Recovery objective is stated in operational terms.
- [ ] The package status is explicit: Draft, Verified, or Recovery-Ready.
- [ ] The source commit described by the package is recorded.
- [ ] Every expected document is listed.
- [ ] Archive layers are explained: Git, `CE_RECOVERY`, data archives, GCS copy, and independent copy.
- [ ] The MVP Recovery target is named.
- [ ] RPO and RTO are defined or explicitly marked unresolved.
- [ ] Integrity table contains archive names, hashes, locations, and verification status.
- [ ] Cold-start acceptance criteria are stated.

## Document-by-document review

### 01 — Current state

- [ ] Exact application roots and entry points are identified.
- [ ] Runtime, package manager, dependency, and version information is evidence-backed.
- [ ] Start, build, test, migration, and seed commands are documented.
- [ ] Implemented, partial, planned, broken, and unknown areas are separated.
- [ ] Current branch, latest stable commit, and uncommitted changes are recorded.
- [ ] Known Logistics Flow freezes or crashes include reproduction details.
- [ ] Claims cite files, commands, commits, or test output.

### 02 — Architecture

- [ ] CE_Forge → ingestion → domain models → projections → Analytics is traced with actual files.
- [ ] Component boundaries and runtime processes are identified.
- [ ] Data stores, queues, scheduled jobs, and external services are listed.
- [ ] Authentication and authorization boundaries are documented.
- [ ] Local and cloud deployment topology are distinguished.
- [ ] MVP Recovery path is identified.
- [ ] Aspirational architecture is clearly separated from implemented architecture.

### 03 — Database schema

- [ ] Every persistent database is identified.
- [ ] Engine and version are recorded.
- [ ] Tables, collections, indexes, relationships, and migrations are documented.
- [ ] Seed and synthetic-data requirements are documented.
- [ ] Native recovery artifact exists where applicable.
- [ ] Logical portable export exists.
- [ ] Restore command or procedure is documented.
- [ ] A sample restore, validation query, or integrity check is recorded.

### 04 — API reference

- [ ] Routes and methods are enumerated from source or generated route output.
- [ ] Request, response, authentication, and error behavior are documented.
- [ ] Internal service-to-service calls are identified.
- [ ] Webhooks and external callback URLs are listed.
- [ ] At least one smoke test exists for the MVP Recovery route.
- [ ] Undocumented or unstable endpoints are marked clearly.

### 05 — Frontend map

- [ ] Pages, routes, components, and state boundaries are listed.
- [ ] Data-loading and mutation paths are documented.
- [ ] Required environment variables are identified.
- [ ] Known stale-state, crash, or freeze conditions are cross-referenced to `19_KNOWN_ISSUES.md`.
- [ ] MVP Recovery UI path is identified.
- [ ] Large refactors are not presented as completed work unless verified.

### 06 — CE_Forge pipeline

- [ ] Generator locations and commands are recorded.
- [ ] Inputs, outputs, schemas, and transformations are documented.
- [ ] External dependencies and nondeterminism are identified.
- [ ] A clean-checkout generation test is recorded.
- [ ] Generated artifacts are classified as reproducible or irreplaceable.

### 07 — Synthetic data catalog

- [ ] Representative datasets are named and located.
- [ ] Seed values and generation commands are documented.
- [ ] Dataset coverage includes domain relationships and Analytics projections.
- [ ] Expected row/object counts or validation conditions are recorded.
- [ ] Generated data can be recreated without Claude, ChatGPT, Manus, or AWS.
- [ ] The data is sufficient for the MVP Recovery test.

### 08–13 — Domain modules and Analytics

For Logistics Flow, Dispatch, Construction Data Map, Cost Estimating, Modular Sequencing, and Analytics:

- [ ] Domain purpose and current implementation status are clear.
- [ ] Source paths, schemas, routes, and UI paths are identified.
- [ ] Inputs, outputs, relationships, and dependencies are documented.
- [ ] Representative fixtures or synthetic data are available.
- [ ] Known defects and last-known-stable commits are recorded.
- [ ] The module’s role in MVP Recovery is explicit.
- [ ] At least one meaningful validation or demonstration path is documented.

### 14 — CloudWatch UX target

- [ ] Required logs, metrics, alerts, and dashboards are identified.
- [ ] Current observability is separated from future target state.
- [ ] Recovery-critical operational signals are identified.
- [ ] The document does not imply that a future dashboard already exists.

### 15 — Deployment

- [ ] Clean-environment prerequisites are listed.
- [ ] Install, build, test, migrate, seed, start, and deploy commands are complete.
- [ ] Environment-specific differences are documented.
- [ ] Rollback procedure exists.
- [ ] Smoke-test procedure exists.
- [ ] Deployment does not depend on undocumented interactive AI assistance.
- [ ] The MVP Recovery deployment has been attempted.

### 16 — AWS infrastructure

- [ ] Actual AWS account plan and billing state are recorded separately from assumptions.
- [ ] Active regions and services are inventoried.
- [ ] Compute, databases, object storage, networking, IAM, DNS, queues, schedules, and integrations are covered.
- [ ] Infrastructure-as-code or provider exports are preserved.
- [ ] Resource dependencies and deletion risks are documented.
- [ ] No credentials or private keys are present.
- [ ] The review distinguishes credit exhaustion, billing suspension, and account closure.

### 17 — GCS recovery

- [ ] GCP project and billing state are recorded.
- [ ] GCS bucket location, access policy, encryption, retention, and lifecycle are documented.
- [ ] Archive naming and versioning convention is defined.
- [ ] Upload and retrieval commands are documented.
- [ ] Checksum verification after upload is recorded.
- [ ] GCS is not treated as the only backup.
- [ ] Cost controls and budget alerts are documented.
- [ ] A representative recovery artifact has been retrieved successfully.

### 18 — Environment variables

- [ ] Every required variable name is listed.
- [ ] Provider, consumer, environment, owner, rotation method, and replacement procedure are recorded.
- [ ] No raw values, tokens, passwords, private keys, or recovery codes are present.
- [ ] Variables needed for local cold-start recovery are distinguished from production-only variables.
- [ ] Missing or inaccessible secrets are marked as blockers.

### 19 — Known issues

- [ ] Each issue has a concrete title and affected component.
- [ ] Reproduction steps are present.
- [ ] Observed and expected results are separated.
- [ ] Impact and priority are recorded.
- [ ] Last-known-stable commit is recorded where possible.
- [ ] Workaround and next action are concrete.
- [ ] No issue is hidden merely because it is embarrassing or inconvenient.

### 20 — Next actions

- [ ] Actions identify a file, component, command, or cloud resource.
- [ ] Each action has an acceptance condition.
- [ ] Actions are ordered by irreversibility and recovery impact.
- [ ] Deferred feature work is separated from recovery blockers.
- [ ] The first three actions can be started without additional architecture design.

### 21 — Forwardable AI execution plan

- [ ] The plan points to the actual repository and `CE_RECOVERY` path.
- [ ] Claude and ChatGPT roles are clear but not rigidly exclusive.
- [ ] Human approval boundaries are explicit.
- [ ] Secrets and irreversible changes are protected.
- [ ] The plan includes evidence requirements and failure reporting.
- [ ] It includes the Cold Start Test and `FF-RECOVERY-v1.0` release gate.

## Artifact review

### Source and Git

- [ ] Full Git history is available in the independent source snapshot.
- [ ] Branches, tags, submodules, lockfiles, manifests, Dockerfiles, migrations, generators, scripts, and CI/CD definitions are preserved.
- [ ] The recovery package is committed and tied to a source commit.
- [ ] No required source file is ignored accidentally.
- [ ] Repository can be cloned and inspected without the original workstation.

### Database exports

- [ ] Native artifacts and logical exports are both present where applicable.
- [ ] Export timestamps and source database versions are recorded.
- [ ] File sizes and checksums are recorded.
- [ ] At least one export has been opened or restored successfully.
- [ ] Restoration does not depend on a still-running AWS resource unless that dependency is documented.

### Object-storage archives

- [ ] Bucket and object manifests are present.
- [ ] Critical uploaded assets are present.
- [ ] Versions and metadata are preserved where required.
- [ ] Representative files can be retrieved and opened.
- [ ] Large archives are split logically and resumably.
- [ ] Archive checksums match the source copy.

### DNS and integrations

- [ ] Registrar and DNS ownership is documented.
- [ ] Nameservers and records are captured.
- [ ] Certificates and renewal responsibility are recorded.
- [ ] Email, payments, OAuth, webhooks, AI services, maps, and analytics dependencies are listed.
- [ ] Re-enablement procedures exist without exposing credentials.

## Security review

- [ ] No raw credentials exist in Git history, current files, archives, logs, screenshots, or terminal captures.
- [ ] Secrets inventory contains names and procedures, not values.
- [ ] Recovery archives are encrypted before external upload.
- [ ] Encryption-key ownership and recovery procedure are documented separately.
- [ ] GCS access is least-privilege and limited to required operators or service accounts.
- [ ] Archive sharing links, if any, are private and time-limited.
- [ ] The review does not copy sensitive cloud identifiers unnecessarily into public documentation.

## Integrity and archive tests

Record every test in `CE_RECOVERY/recovery-tests/` or the repository’s designated test location.

- [ ] All expected files are included in the manifest.
- [ ] SHA-256 hashes are generated for each logical archive.
- [ ] Source and GCS hashes match.
- [ ] Source and independent-copy hashes match.
- [ ] Encrypted archives can be decrypted by the authorized recovery owner.
- [ ] Archive extraction succeeds into a clean directory.
- [ ] No archive contains unexpected secrets.
- [ ] A representative database export is usable.
- [ ] A representative object-storage file is usable.
- [ ] The GCS retrieval command works from a clean authenticated session.
- [ ] The recovery package remains readable if AWS is unavailable.

## Cold-start test

### Preparation

- [ ] Create a clean workspace or isolated directory.
- [ ] Do not use the AWS console.
- [ ] Do not use the original developer’s memory.
- [ ] Do not ask Claude, ChatGPT, Manus, or the current conversation to fill undocumented gaps during the first attempt.
- [ ] Use only the repository, `CE_RECOVERY`, database backup, GCS package, environment-variable inventory, and deployment instructions.

### Execution

- [ ] Clone or unpack the repository.
- [ ] Install dependencies using documented commands.
- [ ] Generate synthetic data.
- [ ] Run migrations or restore the database.
- [ ] Start the application.
- [ ] Execute the MVP Recovery smoke test.
- [ ] Confirm the CE_Forge-to-domain-model-to-Analytics path.
- [ ] Retrieve at least one artifact from the GCS recovery package.
- [ ] Record elapsed time, manual interventions, errors, and missing instructions.

### Acceptance

The test passes only if a technically competent person can reach a functioning MVP endpoint and explain the remaining limitations without contacting the original owner. Every failure must become a documented issue and next action.

## Review report template

```text
CE_RECOVERY REVIEW REPORT

Review date:
Reviewer:
Repository:
Branch:
Source commit:
Recovery-package commit:

G0 Repository integrity: PASS / PARTIAL / FAIL
G1 Factual completeness: PASS / PARTIAL / FAIL
G2 Rebuild capability: PASS / PARTIAL / FAIL
G3 State preservation: PASS / PARTIAL / FAIL
G4 Archive integrity: PASS / PARTIAL / FAIL
G5 Cold-start recovery: PASS / PARTIAL / FAIL
G6 Release baseline: PASS / PARTIAL / FAIL

Critical blockers:
1.
2.
3.

High-priority corrections:
1.
2.
3.

Known accepted gaps:
1.
2.
3.

RPO:
RTO:
MVP Recovery target:

Recommendation:
[ ] Continue documentation
[ ] Begin archive creation
[ ] Run cold-start test
[ ] Fix blockers and re-review
[ ] Approve FF-RECOVERY-v1.0
```

## Final approval rule

Do not approve `FF-RECOVERY-v1.0` because the directory exists or because the documents look complete. Approve it only when the package has evidence, preserved state, verified archives, documented limitations, and a successful cold-start reconstruction of the defined MVP Recovery target.
