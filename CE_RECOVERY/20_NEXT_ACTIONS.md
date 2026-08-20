# Next Actions

**Status:** Draft — real, evidence-based entries below.
**Package:** `CE_RECOVERY`
**Last reviewed:** 2026-08-19

## Purpose

Brutally concrete recovery and development actions with files, commands, owners, status, and acceptance criteria.

## Evidence standard

Record repository paths, commit IDs, commands, exports, screenshots, or test results for every material claim. Distinguish **implemented**, **partial**, **planned**, **broken**, and **unknown**. Do not put credentials, private keys, recovery codes, or other secrets in this package.

## Phase 1 — CLOSED (per explicit human-owner sign-off, 2026-08-18)

| Action | Status | Evidence |
|---|---|---|
| `Factory_To_Foundation` repository inspection | **Done** | `01_CURRENT_STATE.md`, `02_ARCHITECTURE.md` |
| `Construction_Enterprises` inspection + Python environment freeze + business-doc classification | **Done** | `Construction_Enterprises/CE_RECOVERY/` |
| `AI_Dispatch` inspection (n8n workflow inventory, credentials-by-name) | **Done** | `AI_Dispatch/CE_RECOVERY/01_CURRENT_STATE.md` |
| `CE_Forge` inspection | **Done** | `CE_Forge/CE_RECOVERY/01_CURRENT_STATE.md` — corrected the assumed `CE_Forge → Construction_Enterprises → FF` chain (no evidence found; real relationship is two independent inputs into FF) |
| Cross-repository dependency map | **Done** | `AI_Dispatch/CE_RECOVERY/CROSS_REPOSITORY_DEPENDENCY_MAP.md` |
| AWS resource inventory (read-only) + classification | **Done** | `16_AWS_INFRASTRUCTURE.md` — LIVE/REQUIRED/OPTIONAL/UNKNOWN table + real relationship map |
| GCS state check | **Done** | `17_GCS_RECOVERY.md` — confirmed nothing exists yet, proposed structure only |
| Known issues + next actions | **Done, this file + `19_KNOWN_ISSUES.md`** | — |
| Push merged `main` to `origin` (all 4 repos) | **Done** | All four repos pushed; see each repo's own latest commit |

## Phase 2 — PRESERVE (in progress)

| Action | Owner | Status | Evidence | Acceptance condition |
|---|---|---|---|---|
| 1. GitHub — all 4 repos committed/pushed | Claude | **Done** | Each repo's `CE_RECOVERY/` + latest commit hash | — |
| 2. Local immutable snapshot (git bundles, all 4 repos) | Claude | **Done** | `AI_Dispatch/backups/FF-RECOVERY-v1.0/source-and-infrastructure/` — 4 bundles, `git bundle verify` passed on all, SHA-256 recorded | — |
| 3/5. Database preservation (logical export) | Claude | **Done, restore-tested** | `AI_Dispatch/backups/FF-RECOVERY-v1.0/databases/` — `ff-postgres-dev-logical-export-20260818.tar.gz` + `RESTORE_TEST_RESULTS.md`. All 63 models reloaded into an isolated schema with exact row-count parity; 0 orphaned FK references across 106 real constraints. Found and fixed 4 real restore-tooling bugs along the way (Prisma adapter ignoring `?schema=`, cascading truncate order, enum-field exclusion, unstringified Json columns) — none affected the export data itself. | **Native RDS snapshot still outstanding** — see IAM gap below. |
| 5. S3 object export (2 real buckets) | — | **Not started** | — | Blocked on the same IAM gap that blocked bucket listing during recon — see below |
| 6. Business archive separation (8 real docs) | Claude | **Done — copied + verified, originals untouched** | `AI_Dispatch/backups/FF-RECOVERY-v1.0/business-archive/` + `BUSINESS_ARCHIVE_MANIFEST.json`, all 8 SHA-256-verified byte-for-byte | Whether to remove the originals from `Factory_Documentation/` is a separate, deliberately deferred decision |
| 7. GCS creation | — | **Explicitly not authorized yet** | `17_GCS_RECOVERY.md` | Requires the human owner's direct go-ahead (new Google account/project — an "explicit permission required" action) |
| 8. Full checksums/manifest for everything preserved so far | Claude | **Partial** | Per-artifact `CHECKSUMS.sha256` + `MANIFEST.md` exist for both the source bundles and the DB export; no single top-level manifest tying all of Phase 2's artifacts together yet | — |
| 9. `15_DEPLOYMENT.md` cold-start instructions | Claude | **Done** | `15_DEPLOYMENT.md` — real 21-step procedure, corrected against the 2026-08-19 Cold Start Test's own findings | — |
| 10. Recovery validation (Cold Start Test) | Claude | **Done, passed** | `19_KNOWN_ISSUES.md`'s "Cold Start Test — executed 2026-08-19" entry; `15_DEPLOYMENT.md` §21. Real GCS download, isolated environment, MVP Recovery target achieved, 5 defects found and fixed (incl. reconstructing the deleted restore-loader script as `backend/scripts/cold-start-restore.ts`) | **Met** |

## Real IAM gap blocking the native database/object-storage export forms

This session's own `codex-cli` IAM user was confirmed (via live `AccessDeniedException`, not inferred) to lack:
- `rds:CreateDBSnapshot` — blocks the native-provider-format database backup.
- `s3:ListBucket` / `s3:GetBucketLocation` / `s3:HeadBucket` on both real buckets — blocks systematic object enumeration for an S3 export.
- The EC2 instance's own role (`ff-instance-role`) has **no S3 write access at all** (confirmed via a real `AccessDenied` during this session's database-export retrieval attempt) — read-only, for pulling deploy artifacts down only.

**Recommended minimal policy addition** (for the human owner to apply — per this project's own standing rule, an AI session should never attempt to self-escalate its own IAM permissions):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["rds:CreateDBSnapshot", "rds:DescribeDBSnapshots"],
      "Resource": "arn:aws:rds:us-east-2:027958788731:db:ff-postgres-dev"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": [
        "arn:aws:s3:::construction-enterprise-project-files-027958788731-us-east-2-an",
        "arn:aws:s3:::ff-frontend-027958788731-us-east-2"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject"],
      "Resource": [
        "arn:aws:s3:::construction-enterprise-project-files-027958788731-us-east-2-an/*",
        "arn:aws:s3:::ff-frontend-027958788731-us-east-2/*"
      ]
    }
  ]
}
```

## Immediate, ungated next steps

1. ~~Restore-test the logical database export~~ — **Done**, see `RESTORE_TEST_RESULTS.md`.
2. ~~Private-copy + checksum the sensitive business documents~~ — **Done**, see `AI_Dispatch/backups/FF-RECOVERY-v1.0/business-archive/`.
3. **`15_DEPLOYMENT.md`** — write real cold-start steps now that `02_ARCHITECTURE.md` + the restore-tested database export exist to ground them.
4. **Resolve the Logistics Flow navigation discrepancy** per `19_KNOWN_ISSUES.md`'s acceptance condition — still needs the human owner's own direct repro.

## Answered since the last revision of this file

- ~~Decide the scope question (is `Construction_Enterprises` in scope?)~~ — **Answered: yes**, and `CE_Forge` was added as a fourth repo too.
- ~~AWS billing/credit real numbers~~ — human owner has explicitly reaffirmed doing this "at the end," twice now. No longer flagged as a tension to resolve; respecting the stated preference.

## Recovery notes

- Minimum viable recovery target: proposed in `01_CURRENT_STATE.md`/`02_ARCHITECTURE.md`, achieved and demonstrated live by the 2026-08-19 Cold Start Test.
- AWS/GCP/third-party dependencies: AWS only for this repo; `AI_Dispatch` has its own separate real SaaS profile (Manus/Slack/Google Docs).
- Cold-start instruction: written (`15_DEPLOYMENT.md`) and now validated end-to-end — see the Cold Start Test entry above.

## Remaining open items (as of 2026-08-19)

Only genuinely open items left in this package:
- Native RDS snapshot + S3 object-level export — IAM-gated, policy proposed above, needs the human owner to apply it.
- Client-side encryption on the GCS archive — not applied, disclosed (`17_GCS_RECOVERY.md`).
- `18_ENVIRONMENT_VARIABLES.md` — still a template; real variable names exist scattered in `01_CURRENT_STATE.md`/`15_DEPLOYMENT.md` but no single consolidated redacted inventory.
- Logistics Flow → Operations deep-link bug — disputed, needs the human owner's own repro (see `19_KNOWN_ISSUES.md`).
- Twin/`Construction_Enterprises` and `AI_Dispatch`/n8n reconstruction — real, valuable, but explicitly separable extensions beyond the MVP target; not exercised by the Cold Start Test.
