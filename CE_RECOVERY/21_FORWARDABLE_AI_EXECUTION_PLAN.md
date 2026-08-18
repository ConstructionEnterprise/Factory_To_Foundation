# Factory » Foundation — Forwardable AI Execution Plan

## Mission

You are helping preserve and stabilize **Factory » Foundation** before the current AI-tooling and cloud-credit environment becomes unreliable. The goal is **not** to perform a rushed full migration from AWS to Google Cloud. The goal is to make AWS disposable as an execution environment while preserving the system’s intellectual property, source code, data, architecture, deployment capability, and minimum viable recovery path.

The governing model is:

```text
AWS = active engineering environment
Git = executable history
CE_RECOVERY = factual reconstruction guide
GCS = recovery archive and standby destination
Independent copy = protection from a cloud-provider failure
```

The operational sequence is:

```text
BUILD → FREEZE → DOCUMENT → SNAPSHOT → AWS EXPORT → GCS MIRROR → COLD-START VALIDATION → RECOVERY-READY
```

The existing architectural breakthrough is:

```text
CE_Forge → Factory » Foundation ingestion → domain models → projections → Analytics
```

Everything in this plan should strengthen that chain rather than introduce speculative architecture.

## Repository and working location

The target repository is the private GitHub repository:

```text
ConstructionEnterprise/Factory_To_Foundation
```

The recovery package already exists on the `main` branch under:

```text
CE_RECOVERY/
```

The initial structure was committed as:

```text
acbde6d Add CE_RECOVERY recovery package structure
```

Begin by pulling the latest `main` branch and inspecting the repository. Do not assume that the existing templates describe the actual implementation. The purpose of this effort is to replace assumptions with evidence from files, commands, schemas, routes, commits, and test results.

## Roles for Claude and ChatGPT

Use the two AI systems as complementary reviewers rather than as competing architects.

| Role | Primary responsibility | Required behavior |
|---|---|---|
| **Claude** | Forensic implementation analysis and focused code work | Inspect the repository carefully, identify what actually exists, fix narrowly scoped issues, and record exact evidence. |
| **ChatGPT** | Orchestration, synthesis, recovery planning, and quality review | Maintain the overall sequence, compare findings, identify gaps, improve documentation, and test whether the recovery story is coherent. |
| **Human owner** | Final authority and credential holder | Approve scope changes, provide secrets through secure channels only, confirm domain and cloud ownership, and decide what is safe to deploy or spend. |

Either AI may perform any task when necessary, but neither should silently invent facts about the repository or cloud environment. When one system makes a claim, the other should request a file path, command output, commit ID, test result, or other evidence before treating it as confirmed.

## Non-negotiable operating rules

1. **Do not introduce a major new subsystem** unless it is required to make an implementation already in motion work.
2. **Do not perform broad UI refactors** during the recovery sprint. Stability and documentation are more valuable than visual polish.
3. **Do not delete, rename, or rewrite existing project files** without first identifying the affected scope and preserving a recoverable commit.
4. **Do not paste or commit API keys, private keys, passwords, recovery codes, payment data, or raw secrets.** Create a redacted inventory instead.
5. **Do not treat source code as a complete backup.** Databases, uploaded files, cloud configuration, DNS, secrets, scheduled jobs, and external integrations must be handled separately.
6. **Do not treat one ZIP file as the recovery plan.** Use logical archives, manifests, SHA-256 checksums, encryption, independent copies, and restore tests.
7. **Do not assume that AWS credit exhaustion equals AWS account closure.** Determine the actual AWS plan, credit state, billing state, payment state, and account notifications. AWS has different recovery behavior for suspension, voluntary closure, and credit exhaustion. [1] [2]
8. **Do not assume Google Cloud is automatically safe because it is unused.** Keep GCS minimal, cost-controlled, encrypted, and independently backed up. Google warns that billing suspension can stop workloads and that some resources may be removed; project recovery periods do not guarantee preservation of every resource. [3] [4]
9. **Do not mark an item complete because a command was run once.** Completion requires evidence, a recorded result, and—where relevant—a successful restore or retrieval test.
10. **When uncertain, stop and report the uncertainty.** Do not make an irreversible change to compensate for missing information.

## Phase 1 — Establish the forensic baseline

### Step 1: Inspect the repository

Record the current branch, latest commit, working-tree status, top-level directories, package managers, runtimes, Docker files, deployment files, database files, and test commands. Identify the actual application roots inside the repository.

Produce or update `CE_RECOVERY/01_CURRENT_STATE.md` with:

- Exact repository paths and application entry points.
- Current branch, latest stable commit, and uncommitted changes.
- Implemented, partial, planned, broken, and unknown areas.
- Runtime and dependency versions.
- Local start, build, test, migration, and seed commands.
- Known failures, including Logistics Flow freezes or crashes.
- A list of evidence files and commands used.

Do not write “the system contains X” unless a repository path, command, or test supports the statement.

### Step 2: Map the existing architecture

Trace the real path from CE_Forge through ingestion, domain models, relationships, projections, and Analytics. Identify which parts are implemented, which are simulated, and which depend on external services.

Update `CE_RECOVERY/02_ARCHITECTURE.md` with:

- Component boundaries.
- Data flow and transformation stages.
- Runtime processes and ports.
- Database and object-storage dependencies.
- External APIs and authentication boundaries.
- Current local and cloud deployment topology.
- The smallest end-to-end path that can serve as MVP Recovery.

### Step 3: Establish the current AWS and GCP facts

Create a redacted inventory of AWS and Google Cloud. Do not include credentials. Record account or project identifiers only where safe and necessary.

Capture:

- AWS account plan and billing state.
- Credit balance, expiration, and monthly burn.
- Active AWS regions and services.
- RDS, DynamoDB, S3, EBS, Lambda, ECS/ECR, API Gateway, CloudFront, Route 53, EventBridge, SQS/SNS, IAM, and networking resources actually used.
- Google Cloud project and billing state.
- Intended GCS bucket, region, retention policy, encryption approach, and budget alerts.
- Domains, registrars, DNS providers, certificates, and renewal ownership.

Update `CE_RECOVERY/16_AWS_INFRASTRUCTURE.md` and `CE_RECOVERY/17_GCS_RECOVERY.md` with evidence and unresolved questions.

## Phase 2 — Stabilize and harvest existing value

### Step 4: Freeze the scope of active development

Create a short list of implementations already in motion. The likely priority areas are Construction Data Map, Estimating, CE_Forge generators, Logistics Flow, Dispatch, Modular Sequencing foundation, and Analytics integration.

For every active area, record:

- What is already implemented.
- What single change is necessary to make it demonstrable or recoverable.
- What must explicitly be deferred.
- The acceptance condition for stopping work.

Do not begin another major subsystem during this phase.

### Step 5: Stabilize before polishing

For every crash, freeze, stale-state problem, or broken route, create a concrete entry in `CE_RECOVERY/19_KNOWN_ISSUES.md` and `20_NEXT_ACTIONS.md`.

Each entry must include:

```text
Issue title
Affected component and file path
Reproduction steps
Observed result
Expected result
Impact on recovery or income
Last-known-stable commit
Likely investigation point
Workaround, if any
Next action
Acceptance condition
```

A useful action is specific, such as:

> Reproduce stale localhost state when selecting Logistics Flow. Inspect the selection component and state hydration path. Compare with commit `<hash>`. Acceptance: selecting a route twice produces the same state after a clean restart.

### Step 6: Preserve synthetic-data capability

Treat synthetic-data generators as architectural assets, not disposable test utilities. Update `CE_RECOVERY/06_CE_FORGE_PIPELINE.md` and `07_SYNTHETIC_DATA_CATALOG.md` with:

- Generator locations and commands.
- Inputs and seed values.
- Output files and schemas.
- Dataset size and representative coverage.
- Expected relationships and projections.
- How to regenerate from a clean checkout.
- Known nondeterminism or external dependencies.

The minimum representative dataset must demonstrate:

```text
CE_Forge → ingestion → domain models → relationships → projections → Analytics
```

## Phase 3 — Populate the recovery package

### Step 7: Complete the forensic implementation record

Populate every requested file in `CE_RECOVERY/`. Use “not found,” “not implemented,” or “not yet verified” when appropriate. Empty claims are better replaced by explicit unknowns than by invented documentation.

The package must cover:

- Current state and architecture.
- Database schema and restore instructions.
- API routes and contracts.
- Frontend pages and components.
- CE_Forge and synthetic-data pipelines.
- Logistics Flow, Dispatch, Construction Data Map, Cost Estimating, Modular Sequencing, and Analytics.
- CloudWatch UX target and observability requirements.
- Deployment and rollback.
- AWS infrastructure and GCS recovery.
- Environment-variable inventory.
- Known issues and next actions.

### Step 8: Make `CE_RECOVERY/` version-controlled

Commit recovery documentation in the same repository as the source, and tag it to the source commit it describes. Include a current-state timestamp and a clear status such as `Draft`, `Verified`, or `Recovery-Ready`.

Do not allow the recovery package to become a second, disconnected architecture document. Every material statement should point to a repository path, command, cloud export, test, or commit.

### Step 9: Preserve application source and infrastructure definitions

Create an independent source snapshot containing Git history, branches, tags, submodules, lockfiles, package manifests, Dockerfiles, build scripts, deployment scripts, CI/CD definitions, migrations, generators, and configuration templates.

Preserve actual infrastructure definitions, not screenshots. Include Terraform, CDK, CloudFormation, Lambda configuration, API Gateway definitions, ECS/ECR configuration, CloudFront, Route 53, IAM structure, EventBridge schedules, queues, storage, networking, security groups, and load balancers that are actually used.

## Phase 4 — Preserve state and cloud data

### Step 10: Export databases in two forms

For every persistent database, create:

1. A native provider recovery artifact where available.
2. A logical portable export.
3. Schema and migration files.
4. Metadata, version information, and restore instructions.
5. A small test restore or validation query.

Update `CE_RECOVERY/03_DATABASE_SCHEMA.md` and place exports under `CE_RECOVERY/database/` or `CE_RECOVERY/exports/`. Do not assume that a provider-native export is directly restorable as a complete service instance.

### Step 11: Preserve object-storage data

For every S3 or other object-storage location, capture:

- Bucket name and region.
- Object count and total size.
- Object keys, metadata, versions, and checksums where available.
- Lifecycle and retention rules.
- Encryption configuration.
- Criticality and regeneration status.

Place manifests under `CE_RECOVERY/manifests/` and irreplaceable data under the appropriate encrypted archive. Retrieve representative files after copying and verify that the contents and metadata are usable.

### Step 12: Create the redacted secrets and integration inventory

Update `CE_RECOVERY/18_ENVIRONMENT_VARIABLES.md` with each required variable’s name, provider, consumer, environment, rotation method, owner, recovery procedure, and whether replacement is required.

Also document external services such as email, payments, OAuth, AI providers, maps, analytics, webhooks, and domain services. Record how each integration is re-enabled without recording the secret value.

### Step 13: Preserve DNS and domain control

Record registrar ownership, nameservers, hosted zones, DNS records, certificate relationships, CloudFront or load-balancer bindings, renewal dates, and emergency status-page options. Confirm that access to the registrar and domain email does not depend exclusively on the AWS account being preserved.

## Phase 5 — Build the recovery archives

### Step 14: Assemble logical archives

Create separate archives rather than one opaque file:

```text
FF-RECOVERY-v1.0/
├── portable-core/
├── source-and-infrastructure/
├── databases/
├── object-storage/
├── synthetic-data/
├── dns-and-integrations/
├── manus/
├── manifests/
└── recovery-tests/
```

The Portable Core should remain small enough to move to another provider. Large databases and media may remain separate.

### Step 15: Generate manifest, checksums, and encryption

For every archive:

- Record file paths, sizes, timestamps, and source locations.
- Generate SHA-256 checksums.
- Encrypt the archive before uploading it.
- Store the encryption recovery procedure separately from the archive.
- Never commit raw secrets or encryption keys to Git.

Update the integrity table in `CE_RECOVERY/00_RECOVERY_INDEX.md` with archive names, hashes, locations, and verification status.

### Step 16: Create independent copies

The first copy must not remain only in AWS. Store an encrypted copy in Google Cloud Storage and a second copy outside both AWS and GCP where feasible. Verify the hash after each transfer. “Upload completed” is not sufficient evidence; matching checksums are required.

Use GCS as a recovery archive, not as the only backup. Keep its footprint minimal, configure cost controls, and document retrieval commands in `CE_RECOVERY/17_GCS_RECOVERY.md`.

## Phase 6 — Validate recovery

### Step 17: Define recovery objectives

Before testing, set:

| Objective | Definition |
|---|---|
| **RPO** | Maximum acceptable data loss for databases, uploaded assets, and synthetic/reference data. |
| **RTO** | Maximum time from retrieving the archive to a working MVP endpoint. |
| **MVP Recovery** | The smallest end-to-end path proving that Factory » Foundation survived. |

The initial MVP Recovery target should demonstrate the CE_Forge-to-domain-model-to-Analytics chain using a representative dataset and at least one functioning application route.

### Step 18: Perform the Cold Start Test

Pretend that Claude, ChatGPT, Manus, the current conversation, and AWS console access are unavailable. Use only:

```text
Git repository
CE_RECOVERY/
database backup
GCS recovery package
environment-variable inventory
deployment instructions
```

A technically competent person must be able to determine:

- How to install dependencies.
- How to generate representative data.
- How to run migrations and seed data.
- How to start, test, and deploy the application.
- Which variables and integrations are required.
- Which subsystem is the MVP Recovery target.
- What known failures remain.
- How to restore from GCS.

Every unanswered question becomes a defect in `19_KNOWN_ISSUES.md` and a concrete task in `20_NEXT_ACTIONS.md`.

### Step 19: Freeze the recovery baseline

After the Cold Start Test, create:

```text
FF-RECOVERY-v1.0
```

Record the source commit, recovery-package commit, archive hashes, GCS object locations, independent-copy location, test date, elapsed restoration time, known gaps, AWS state, GCS state, RPO, RTO, and MVP Recovery result.

## Immediate start checklist

Begin with these actions in order:

1. Pull the latest `main` branch of `ConstructionEnterprise/Factory_To_Foundation`.
2. Run the repository inspection and record the results in `CE_RECOVERY/01_CURRENT_STATE.md`.
3. Identify the real application roots, package managers, database files, deployment files, and test commands.
4. Freeze the active development scope and list implementations already in motion.
5. Ask Claude to produce the forensic implementation record from the repository.
6. Ask ChatGPT to review that record for unsupported claims, missing dependencies, and recovery gaps.
7. Populate the CE_Forge, synthetic-data, domain, API, frontend, deployment, and known-issues documents with evidence.
8. Generate a representative end-to-end dataset and record how to regenerate it.
9. Export databases and object-storage manifests before attempting broad cloud changes.
10. Create encrypted logical archives, SHA-256 manifests, an independent copy, and a GCS recovery copy.
11. Run the Cold Start Test without relying on the current AI or AWS console.
12. Fix missing instructions, commit the recovery baseline, and tag `FF-RECOVERY-v1.0`.

## Required response format from either AI

For every work session, report:

```text
Objective:
Files inspected:
Files changed:
Commands run:
Evidence obtained:
Tests performed:
Known limitations:
Secrets or external access required:
Recommended next action:
```

Do not report “done” without naming the changed files and evidence. If a task cannot be completed, describe the exact blocker and leave the repository in a recoverable state.

## Final definition of success

The effort succeeds when Factory » Foundation can continue evolving on AWS, while a technically competent person can reconstruct the minimum viable system without Claude Pro, ChatGPT, Manus, the current conversation, or AWS console access.

The target is not a perfect duplicate of AWS. The target is **survivable continuity**:

> **The architecture, data, source, implementation knowledge, and recovery path survive even if the current execution environment does not.**

### References

[1]: https://repost.aws/knowledge-center/reactivate-suspended-account "AWS: How do I reactivate my suspended AWS account?"

[2]: https://docs.aws.amazon.com/accounts/latest/reference/manage-acct-closing.html "AWS: Close an AWS account"

[3]: https://docs.cloud.google.com/billing/docs/how-to/restart-services "Google Cloud: Restarting Google Cloud Services"

[4]: https://docs.cloud.google.com/resource-manager/docs/delete-restore-projects "Google Cloud: Delete and restore projects"
