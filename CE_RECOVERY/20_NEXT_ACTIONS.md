# Next Actions

**Status:** Draft — real, evidence-based entries below.
**Package:** `CE_RECOVERY`
**Last reviewed:** 2026-08-18

## Purpose

Brutally concrete recovery and development actions with files, commands, owners, status, and acceptance criteria.

## Evidence standard

Record repository paths, commit IDs, commands, exports, screenshots, or test results for every material claim. Distinguish **implemented**, **partial**, **planned**, **broken**, and **unknown**. Do not put credentials, private keys, recovery codes, or other secrets in this package.

## Recovery-package build-out (this session's real progress against the plan's Phase 1/2)

| Action | Owner | Status | Evidence | Acceptance condition |
|---|---|---|---|---|
| Merge diverged `main` (local dispatch-link commit + remote plan doc) | Claude | **Done** | commit `2097017`, `git log --oneline -5` | Clean merge, no conflicts — confirmed |
| Push merged `main` to `origin` | Human owner (approval required) | **Blocked — awaiting go-ahead** | — | Explicit "yes, push" from Joshua |
| `01_CURRENT_STATE.md` — real repo inspection | Claude | **Done, first pass** | File itself; evidence commands listed inline | Reviewed by ChatGPT per the plan's dual-reviewer role |
| `19_KNOWN_ISSUES.md` — real entries | Claude | **Done, 2 entries** | File itself | Reviewed by ChatGPT; Logistics Flow entry updated once owner re-tests |
| `02_ARCHITECTURE.md` — CE_Forge → domain models → Analytics chain trace | Claude | **Not started** | — | Component boundaries, data flow, ports, DB/storage deps, MVP recovery path all evidenced |
| `16_AWS_INFRASTRUCTURE.md` / `17_GCS_RECOVERY.md` — real AWS resource inventory + billing state | Claude (needs AWS CLI access, already available this session) | **Not started** | — | Redacted inventory of every real running AWS resource (RDS, ASG/EC2, NLB, CloudFront, S3) with real billing/credit figures |
| `03_DATABASE_SCHEMA.md` + real DB export | Claude | **Not started** | — | Both a native RDS snapshot/export AND a logical (`pg_dump`-style) portable export, plus a real restore test |
| `18_ENVIRONMENT_VARIABLES.md` — redacted variable inventory | Claude | **Not started** | Partial evidence already gathered (`01_CURRENT_STATE.md`'s env-var-name lists) | Every real var has name/provider/consumer/owner/rotation method, zero actual secret values |
| Encrypted archive + checksums + GCS mirror | Human owner (credentials/GCS project required) | **Not started** | — | Matching SHA-256 after upload, not just "upload completed" |
| Cold-Start Test | Both AIs + human owner | **Not started, blocked on above** | — | A technically competent person reconstructs the MVP target using only the repo + `CE_RECOVERY/` + exports |

## Immediate, ungated next steps (can start now, no new credentials needed)

1. **Finish Phase 1 evidence-gathering** (`02_ARCHITECTURE.md`, Dockerfile contents, migration list) — no blockers, pure repository inspection.
2. **Resolve the Logistics Flow navigation discrepancy** per `19_KNOWN_ISSUES.md`'s acceptance condition — needs the human owner's own direct repro, not another AI-side test.
3. **Decide the scope question**: is `Construction_Enterprises`/`Chappell_Robotics` (the digital twin's separate real repo, referenced from `AI_Dispatch/CLAUDE.md`) in scope for this same recovery effort, or is this plan scoped to `Factory_To_Foundation` only? *(Asked, not yet answered — see the conversation this plan arrived in.)*
4. **AWS billing/credit real numbers** — the human owner has said this will happen as "a final health/spending check at the end," which conflicts with the plan's own Non-negotiable Rule 7 (do not assume credit exhaustion equals account closure — determine the actual state early, since it changes how urgently GCS mirroring needs to happen). Flagging the tension, not overriding the owner's stated preference.

## Recovery notes

- Minimum viable recovery target: proposed in `01_CURRENT_STATE.md`, not yet confirmed with the human owner.
- AWS/GCP/third-party dependencies: see `01_CURRENT_STATE.md` — AWS only, no third-party SaaS found.
- Cold-start instruction: not yet written.
