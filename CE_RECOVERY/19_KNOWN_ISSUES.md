# Known Issues

**Status:** Draft — real, evidence-based entries below. Verify against the repository before relying on this document for anything beyond its own stated evidence.
**Package:** `CE_RECOVERY`
**Last reviewed:** 2026-08-19

## Purpose

Concrete defects, reproduction steps, impact, last-known-stable commit, workaround, and next action.

## Evidence standard

Record repository paths, commit IDs, commands, exports, screenshots, or test results for every material claim. Distinguish **implemented**, **partial**, **planned**, **broken**, and **unknown**. Do not put credentials, private keys, recovery codes, or other secrets in this package.

---

## Issue: Logistics Flow → Operations dispatch deep-link — status disputed

**Affected component and file path:**
`Factory_To_Foundation/frontend/src/pages/logistics/LogisticsPage.tsx`, `Factory_To_Foundation/frontend/src/features/logistics/LogisticsBrowse/LogisticsBrowse.tsx`, `Factory_To_Foundation/frontend/src/features/logistics/LogisticsFlow/LogisticsFlowInspector.tsx`.

**Reproduction steps:**
1. Navigate to `/logistics?capability=flow`.
2. Expand a real Logistics Flow, select a `transportation_handoff` FlowPoint that has a real linked `LogisticsDispatch` (`assetRef`).
3. Click the "Dispatch: `<truck>` → `<project>` ↗" link now rendered in the Asset Reference field.

**Observed result (conflicting, not yet reconciled):**
- The link correctly generates `/logistics?capability=operations&dispatch=<id>` in the browser URL bar in every case observed.
- **This session's own live browser testing** (commit `34a4b8d`, then re-verified after a follow-up fix): a fresh tab and 4 consecutive repro attempts, plus browser back/forward, plus a direct hard-loaded URL, all correctly switched to the Operations capability with the dispatch selected.
- **The human owner's own live testing, after that same fix, reports the page still stuck on the Logistics Flow capability** — URL updates, rendered view does not follow. Not yet independently reproduced by re-testing on the owner's side under observation.

**Expected result:** Clicking the link (or loading the URL directly) always renders the Operations capability with the exact dispatch selected in the detail panel, regardless of whether the click originated from a same-page client-side navigation or a fresh page load.

**Impact on recovery or income:** Low-to-moderate. Cosmetic/navigation-only — no data integrity risk, no cost, does not block any other capability. Real impact is trust: an intermittent bug that passes automated-style repro but fails for a live user is a signal the underlying mechanism (React Router `useSearchParams` + local `useState` capability sync in `LogisticsPage.tsx`) may have a genuine race condition, not just a one-time dev-server (Vite Fast Refresh) artifact as currently hypothesized.

**Last-known-stable commit:** No prior "stable" state — the dispatch link is new functionality added `34a4b8d`, same day as the sync fix. There is no earlier commit to roll back to that had this feature working correctly; rolling back means removing the feature, not fixing it.

**Likely investigation point:** `LogisticsPage.tsx`'s `useEffect(() => { if (...) setCapability(capabilityParam) }, [capabilityParam])`. Candidate causes not yet ruled out: (1) a genuine Vite Fast Refresh artifact from adding a new hook to an already-mounted component instance mid-session (this session's working hypothesis, not confirmed against the owner's exact repro conditions); (2) a real race between `LogisticsFlowInspector`'s `navigate()` call and some other effect in the Logistics Flow store (`logisticsFlowStore.ts`) that could re-navigate or reset state; (3) browser-extension-specific automation quirks in how this session tested it, versus a real user's mouse click, that happen to mask a genuine bug.

**Workaround, if any:** A hard page reload of the same URL (`F5` / re-navigate) reliably shows the correct Operations view with the dispatch selected, per this session's testing.

**Next action:** Do not mark this resolved. Get an exact, observed repro from the human owner (screen recording or step-by-step with browser console open) rather than relying on either AI's own synthetic browser-automation testing, which has already produced a false "confirmed fixed" conclusion once this session.

**Acceptance condition:** The human owner personally reproduces success (not just an AI session) by clicking the link from a real, freshly-loaded Logistics Flow page and landing on Operations with the dispatch selected, on at least 3 separate attempts including one after a full browser restart.

---

## Issue: No automated test suite exists

**Affected component and file path:** Entire repository — confirmed via `find . -iname "*.test.ts*" -o -iname "*.spec.ts*"` (excluding `node_modules`) returning zero results, and no `"test"` script in any of the 5 subproject `package.json` files (`backend`, `Factory_To_Foundation/frontend`, `factory-runtime`, `blender-bridge`, `twin-bridge--DO-NOT-USE`).

**Reproduction steps:** N/A — absence, not a failure to reproduce.

**Observed result:** Every correctness check this project has ever relied on is manual: `tsc`/`tsc -b` typechecking (catches type errors, not logic errors), and live `curl`/browser verification against a running instance.

**Expected result:** N/A — no prior expectation was set; documenting as a real gap, not a regression.

**Impact on recovery or income:** High for the Cold-Start Test specifically (Phase 6 of the recovery plan). A person reconstructing this system from the recovery package alone has no automated way to confirm a clean checkout actually works — every verification step in this project's real history has depended on either a live browser session or an AI assistant manually running `curl` commands, neither of which survives the "AWS console + current AI conversation unavailable" premise the Cold Start Test requires.

**Last-known-stable commit:** N/A.

**Likely investigation point:** N/A — this is a build-out task, not a bug hunt.

**Workaround, if any:** None currently. `npm run typecheck` (backend) / `tsc -b` (frontend) catch a real, meaningful subset of regressions and should be treated as the minimum bar for "did I break the build" until real tests exist.

**Next action:** Not in scope for the recovery sprint itself (the plan's Non-negotiable Rule 2 prohibits broad new work during recovery) — but the *absence* should be explicitly written into `15_DEPLOYMENT.md`'s Cold-Start instructions so a recovering engineer knows to fall back to manual `curl`/browser verification, not assume `npm test` exists.

**Acceptance condition:** N/A for this recovery sprint — acceptance is simply that this gap is disclosed, not silently discovered during a cold start.

---

## Issue: Cold Start Test — executed 2026-08-19 (RECOVERY VERIFIED, 5 defects found and fixed)

**Affected component and file path:** The recovery package as a whole — `15_DEPLOYMENT.md`, `backend/scripts/` (new file: `cold-start-restore.ts`), `backend/.env.example`-adjacent claims.

**Reproduction steps:** Downloaded the real GCS archive (`gs://ai-dispatch-504810-ff-recovery/CE_RECOVERY/`) into an isolated directory (`C:\ColdStartTest-FF-RECOVERY-v1.0`) with no access to any existing local checkout of any of the four repos. Verified all 97 files against `FULL_ARCHIVE_CHECKSUMS.sha256` and all 4 bundles against `01_SOURCE/CHECKSUMS.sha256`. Cloned all four repos from bundle alone; confirmed HEAD commits matched `01_SOURCE/MANIFEST.md` exactly. Installed PostgreSQL 18 binaries (no installer, no admin rights required) fresh on this machine — the "no local Postgres/Docker" gap from `RESTORE_TEST_RESULTS.md` was real and reproduced independently before being worked around this way, at the human owner's explicit direction. Ran `prisma migrate deploy` (38/38 migrations) against a genuinely fresh database, then restored the logical export, then started `backend` and `frontend`, created a real test user, logged in through the actual UI, and confirmed real restored data rendering (Construction Sites: Stonepine Residences, Cedarwood Flats, Garden Lofts, Skyline Towers; Analytics dashboard; Logistics dispatches).

**Observed result:** **MVP Recovery target achieved** — Postgres → backend → frontend, serving real Construction/Logistics/Analytics data, confirmed both via direct API calls (`/construction-sites`, `/analytics/dashboards`, `/logistics-dispatches`) and visually in a real logged-in browser session. `/health` returned `{"status":"ok"}`; `/system/ready` correctly reported `ready: false` / `"twin bridge unreachable"` — accurate, since twin reconstruction was correctly not attempted (out of MVP scope per step 3).

Five real defects were found in the process, all fixed in this same pass (not deferred):

1. **`15_DEPLOYMENT.md`'s service table listed the backend port as 4310.** Real value, confirmed from `backend/src/server.ts` and every consumer's `.env.example`: **4300**. Fixed.
2. **`15_DEPLOYMENT.md` claimed `Factory_To_Foundation/frontend` has no `.env.example` at all.** False — it exists, with real `VITE_BACKEND_URL`/`VITE_TWIN_BRIDGE_URL`/`VITE_BLENDER_BRIDGE_URL` values; a separate `.env.production` also exists. The original claim was never actually checked. Fixed.
3. **The backend hard-crashes at startup without `S3_BUCKET_NAME`/`AWS_REGION`** (`backend/src/lib/s3.ts`'s `requireEnv()`, called at module-load time) — not previously disclosed as a boot-blocking requirement, only implied to matter for upload features. A local/demo recovery needs placeholder values even if S3 itself is never used. Fixed (documented in `15_DEPLOYMENT.md` step 7).
4. **The actual restore-test loader script no longer existed anywhere** — `RESTORE_TEST_RESULTS.md` (2026-08-18) documented four real bugs it had to work around, but the script itself was a "temporary script" deleted after that one run, and was never committed or archived. A person following this package alone could not have executed step 6 of `15_DEPLOYMENT.md` — the prose described what to do, but there was nothing to run. **Fixed**: rewritten from the prose description and committed as `backend/scripts/cold-start-restore.ts`, a real, reusable, checked-in artifact.
5. **A fifth restore-tooling bug, not present in the original four**, found while rewriting the loader: **self-referencing foreign keys break table-level insert ordering.** `ConstructionTreeNode.parentId` and `NetworkDevice.uplinkDeviceId` each reference their own table; a row can reference a sibling row from the same table's own insert batch, in whatever order the export lists them, regardless of whether the overall table-to-table order is otherwise correct. Table-level topological sort (used for the other 61 models) cannot resolve this. **Fixed** in `cold-start-restore.ts`: self-referencing FK columns (detected from Postgres's own `information_schema`, not the Prisma schema) are loaded NULL first, then patched via a second UPDATE pass once every row in that table exists. Verified against real data: 66 patched rows in `ConstructionTreeNode`, 28 in `NetworkDevice`, zero FK violations after.

**Expected result:** A technically competent person, given only the recovery package, can determine how to install dependencies, restore the database, start the application, and reach a working MVP — per Step 18's acceptance criteria in `21_FORWARDABLE_AI_EXECUTION_PLAN.md`.

**Impact on recovery or income:** This closes the last major open item from `20_NEXT_ACTIONS.md` (item 10) and the last item in `00_RECOVERY_INDEX.md`'s "not yet done" list. The recovery package's core promise — reconstructability from the archive alone — is now demonstrated, not just asserted.

**Last-known-stable commit:** N/A — this is a validation pass, not a regression.

**Workaround, if any:** N/A — all five defects found were fixed directly rather than worked around.

**Next action:** None required for the MVP target. Optional, explicitly separable extensions not exercised by this test: twin/`Construction_Enterprises` reconstruction, `AI_Dispatch`/n8n reconstruction, native RDS snapshot / S3 object export (still IAM-gated), client-side GCS encryption.

**Acceptance condition:** Met — see Observed result above. Test artifacts (isolated Postgres instance, cloned repos, running dev servers) were torn down after validation; the durable output is the fixed documentation plus the newly-preserved `cold-start-restore.ts`.

---

## Recovery notes

- Define the minimum viable recovery target for this area. *(Deferred to `02_ARCHITECTURE.md`.)*
- Record dependencies on AWS, Google Cloud, Manus, AI providers, or third-party services. *(See `01_CURRENT_STATE.md`'s "Confirmed via direct check" section — no third-party SaaS found; AWS is the only real external dependency.)*
- Include a cold-start instruction that a technically competent person can follow without asking the original author. *(Not yet written — see `15_DEPLOYMENT.md`, still a template.)*
