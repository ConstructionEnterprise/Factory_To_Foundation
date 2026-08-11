# TWIN BRIDGE — DO NOT USE

**STATUS: DEPRECATED / SUPERSEDED (cutover completed 2026-08-11).**

This implementation was the Twin's authoritative owner until Factory Runtime
migration §7 step 4 cutover, executed on the date above. It has been stopped
and is no longer the Twin owner.

## DO NOT

- Add new functionality here.
- Restore Twin authority here.
- Spawn another Twin driver from this directory.
- Modify lifecycle/authority behavior without explicit migration approval.

## Current owner

`factory-runtime/` (sibling directory) — see
`ADR-001-factory-runtime-twin-lifecycle.md` and
`FACTORY-RUNTIME-MIGRATION-PLAN.md`, both in
`Factory_To_Foundation/frontend/`.

## Why this still exists

Kept intact, not deleted, as the rollback path (migration plan §8): if
Factory Runtime has a real problem post-cutover, consumers can be repointed
back to this service and it restarted from here — same accepted
frame-reset discontinuity as forward cutover, not a free undo button.

See the migration plan's own status line for the exact current state of
the migration.

**Update (2026-08-11, later same day):** migration verification is now
complete — Factory Runtime passed deliberate process-kill/recovery testing
(Test A) and 30-minute FF-idle observation including natural auth-token
expiry/recovery (Test B), both documented in the migration plan. This
directory is not an active runtime and should not be treated as one; it
remains rollback material only, per the "Why this still exists" section
above.

**Update (2026-08-11, later still):** deployed to production the same day.
On `ff-app-host`, the real, live `twin-bridge` container (`ff-app-twin-bridge-1`)
was stopped and left in place — same "kept, not deleted" rollback discipline
as this local directory, just enacted on the real host too. Both the local
copy (here) and the production container now serve the same purpose: real
rollback material, not an active runtime, not to be restarted except as a
deliberate rollback per the migration plan's own §8.
