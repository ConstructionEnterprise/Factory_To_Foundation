# AWS Infrastructure

**Status:** Draft — real, read-only reconnaissance pass. **No AWS resource was modified, restarted, resized, deleted, deployed, or rotated during this inventory** — every command used was `describe-*`/`list-*`/`get-*`/`head-*`.
**Package:** `CE_RECOVERY`
**Last reviewed:** 2026-08-18
**IAM identity used for this inventory:** `arn:aws:iam::027958788731:user/codex-cli` — a deliberately narrow-scoped user. Billing/Cost Explorer, Budgets, Route53, CloudWatch alarms, and IAM list operations are all denied to it (confirmed via live `AccessDeniedException` responses, not inferred) — this is a real, disclosed **evidence gap**, not a claim that these things don't exist. A full inventory needs either a broader-scoped credential or the human owner checking the AWS Console directly for those specific areas.

## Purpose

AWS resources, regions, dependencies, infrastructure-as-code, exports, IAM, networking, and recovery assumptions.

## Account identity

- **Account ID:** `027958788731`
- **Default region:** `us-east-2` (all resources found below are in this region; other regions not checked in this pass — real gap, not confirmed empty).
- **VPC:** single default VPC (`vpc-0cc919f9a838cb48e`, `172.31.0.0/16`) — no custom VPC, simple network topology.

## Billing / cost state — NOT AVAILABLE to this inventory

`aws ce get-cost-and-usage` and `aws budgets describe-budgets` both returned real `AccessDeniedException` for this IAM user. **No real dollar figures are recorded in this document** — do not treat the human owner's own earlier "$122 left" figure (verbal, this session, not independently confirmed here) as verified by this inventory. Per the plan's own Non-negotiable Rule 7, the actual credit/billing state should be confirmed directly in the AWS Console (Billing Dashboard) by the human owner when a real spending check happens — this document cannot substitute for that.

## Resource inventory with recovery classification

| Resource | Identifier | Status | Classification | Notes |
|---|---|---|---|---|
| RDS — production | `ff-postgres-dev` | available, Multi-AZ | **LIVE / REQUIRED** | `db.t4g.micro`, 20 GB, `ff-postgres-dev.cbma02c2av04.us-east-2.rds.amazonaws.com`. Real, despite the misleading "-dev" name — this is confirmed production per this whole project's own history. |
| RDS — sandbox | `ff-postgres-sandbox` | available, single-AZ | **LIVE / OPTIONAL** | Dev/CE_Forge target, isolated from prod by design. Losing it is real but non-catastrophic — it can be re-forked from a prod snapshot. |
| EC2 — app host | `i-01b7eb2e4bdfa70ca` (`ff-app-host`) | running | **LIVE / REQUIRED** | `t3.small`. Runs `blender-bridge` + `factory-runtime` per this project's own real deploy history (`backend` stopped here since the ASG cutover). |
| EC2 — ASG instance 1 | `i-0abc1ce2da7bac55c` | running | **LIVE / REQUIRED** | `t3.small`, part of `ff-backend-asg`. |
| EC2 — ASG instance 2 | `i-06423e2d1823f0e74` | running | **LIVE / REQUIRED** | `t3.small`, part of `ff-backend-asg`. |
| Auto Scaling Group | `ff-backend-asg` | min 2 / max 4 / desired 2 | **LIVE / REQUIRED** | Launch template `ff-backend-lt` (`$Latest`), single AZ `us-east-2b`, `subnet-002c09ba33b94584a`. Real single-AZ risk: no cross-AZ redundancy for the backend tier despite Multi-AZ RDS underneath it. |
| NLB — backend | `ff-backend-nlb` | active | **LIVE / REQUIRED** | Internet-facing, fronts `ff-backend-asg` via 2 target groups (`ff-backend-tg-443`, `ff-backend-tg-80`). |
| NLB — twin-bridge | `ff-twinbridge-nlb` | active | **LIVE / UNKNOWN** | Internet-facing, target group `ff-twinbridge-tg` reports a real, healthy target (`i-01b7eb2e4bdfa70ca`, the app-host instance) on port 443. This is genuinely live and healthy — but the FF repo names the corresponding service directory `twin-bridge--DO-NOT-USE`, having been superseded by `factory-runtime`. Not determined in this pass whether this NLB is still real production traffic (e.g. serving `blender-bridge`'s own real API through the same host) or a stale-but-still-billing leftover. **Needs a direct check of what's actually listening on that port on `ff-app-host`, not just target-health.** |
| CloudFront | `E3V59CPAVEU5Y9` (`dgzxyhsayte98.cloudfront.net`) | Deployed, enabled | **LIVE / REQUIRED** | Origin `52-14-82-76.sslip.io` (the app-host's public IP via sslip.io wildcard DNS — confirms no Route53/custom domain is in real use, consistent with this whole project's history). Serves the real production frontend. |
| S3 — frontend | `ff-frontend-027958788731-us-east-2` | confirmed exists (`HeadBucket` succeeded) | **LIVE / REQUIRED** | us-east-2. |
| S3 — deploy artifacts | `construction-enterprise-project-files-027958788731-us-east-2-an` | **existence not directly confirmed by this IAM user** | **LIVE (high confidence) / REQUIRED** | `HeadBucket`/`ListBucket`/`GetBucketLocation` all denied to this IAM user — a real, narrow permission gap, not evidence of non-existence. This session independently confirmed real `PutObject`/write access against this exact bucket earlier the same day (deploy-artifact pushes succeeded). Treat as real and load-bearing; the access gap is worth fixing before a recovery archival pass needs to read from it. |
| ECS | — | **confirmed empty** (`list-clusters` → `[]`) | **N/A** | No ECS in use anywhere — real, definitive negative result, not a permission gap. |
| Route53 | — | **not checked** (AccessDenied) | **UNKNOWN** | Given CloudFront's origin uses `sslip.io` (a free wildcard-DNS-to-IP service) rather than a custom domain, this project likely has no real Route53 hosted zone at all — but this is an inference from the CloudFront origin, not a direct check. |
| CloudWatch alarms | — | **not checked** (AccessDenied) | **UNKNOWN** | This project's own Analytics domain has real "CloudWatch-style observability" *inside the app*, per `01_CURRENT_STATE.md` — that is application-level, not real AWS CloudWatch alarms, and is a separate concern from this row. |
| IAM users/roles | — | **not checked** (AccessDenied) | **UNKNOWN** | The `codex-cli` user itself is real and deliberately narrow-scoped (a real, disclosed security-positive finding — it cannot list other IAM identities, cannot see billing, cannot touch Route53/CloudWatch). Full IAM inventory needs a broader-scoped credential or Console access. |

## Security groups (real, evidence: `describe-security-groups`)

| Group | Purpose (from its own description) |
|---|---|
| `ff-rds-sg` | Prod RDS — "temporary public access, dev IP only" (real, disclosed temporary posture, not a permanent design) |
| `ff-postgres-sandbox-access` | Sandbox RDS — current-IP-only, separate from prod's SG by design |
| `ff-instance-sg` | `ff-app-host` — backend/blender-bridge/twin-bridge, dev-IP-only |
| `ff-backend-asg-sg` | ASG instances — public 443/80, SSM-only otherwise |
| `launch-wizard-1` | Unlabeled/default-named, created 2026-07-30 — **not traced to a specific resource in this pass, worth a follow-up check** |
| `default` | Default VPC security group |

## Real relationship map (not just a resource list)

```text
CloudFront (E3V59CPAVEU5Y9)
    │  origin
    ▼
52-14-82-76.sslip.io  ──────────────────────►  EC2 ff-app-host (i-01b7eb2e4bdfa70ca)
                                                    │  runs: blender-bridge, factory-runtime
                                                    │  (backend stopped here since ASG cutover)
                                                    │
                                              ff-twinbridge-nlb → ff-twinbridge-tg
                                                    (healthy target = same instance;
                                                     real purpose not fully confirmed)

ff-backend-nlb (internet-facing)
    │
    ├── ff-backend-tg-443 ──┐
    └── ff-backend-tg-80  ──┴──►  ff-backend-asg (min2/max4/desired2, single AZ us-east-2b)
                                       │
                                       ├── EC2 i-0abc1ce2da7bac55c
                                       └── EC2 i-06423e2d1823f0e74
                                              │
                                              ▼
                                       RDS ff-postgres-dev (Multi-AZ, REAL PRODUCTION)

S3 ff-frontend-027958788731-us-east-2  ──►  served via CloudFront (frontend static build)
S3 construction-enterprise-project-files-...  ──►  deploy-artifact tarball pulled by ASG instances at boot/redeploy

RDS ff-postgres-sandbox (single-AZ)  ──►  CE_Forge / local dev target, isolated from prod by design
```

## Real, disclosed asymmetries worth recovery attention

1. **Single-AZ ASG despite Multi-AZ RDS** — the database can survive an AZ failure; the backend compute tier currently cannot. Not a recovery-package defect to fix now, but worth carrying into `02_ARCHITECTURE.md`.
2. **`ff-twinbridge-nlb`'s real current purpose is unconfirmed** — genuinely healthy and live, but its name references a service (`twin-bridge`) this project's own repo has since marked `--DO-NOT-USE`. Needs a direct on-instance check (e.g., `netstat`/`docker compose ps` on `ff-app-host` via SSM) before deciding whether it's REQUIRED or safe-to-decommission-later. **Not touched in this pass** — read-only rule respected.
3. **`launch-wizard-1` security group** has a default, unedited name — usually a sign of a manually-created resource outside the normal `deploy/` configs. Not traced to a specific attached resource in this pass.
4. **S3 bucket access asymmetry**: this IAM user can write to `construction-enterprise-project-files-...` but cannot list/head/locate it — works for day-to-day deploys (which use known exact keys) but would block a systematic "export everything in this bucket" recovery step. Worth a real IAM policy fix before the actual archival phase, not during this read-only inventory.

## What this inventory deliberately did NOT do

- Did not check regions other than `us-east-2`.
- Did not attempt to read Route53, CloudWatch alarms, IAM users/roles, or Cost Explorer/Budgets data — all genuinely inaccessible to the credential used, not silently skipped.
- Did not open an SSM session or run any command against any EC2 instance.
- Did not enumerate S3 object contents/sizes for either bucket (needs the IAM gap above resolved first, or Console access).
