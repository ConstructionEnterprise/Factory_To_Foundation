# Known Issues

**Status:** Draft — real, evidence-based entries below. Verify against the repository before relying on this document for anything beyond its own stated evidence.
**Package:** `CE_RECOVERY`
**Last reviewed:** 2026-08-18

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

## Recovery notes

- Define the minimum viable recovery target for this area. *(Deferred to `02_ARCHITECTURE.md`.)*
- Record dependencies on AWS, Google Cloud, Manus, AI providers, or third-party services. *(See `01_CURRENT_STATE.md`'s "Confirmed via direct check" section — no third-party SaaS found; AWS is the only real external dependency.)*
- Include a cold-start instruction that a technically competent person can follow without asking the original author. *(Not yet written — see `15_DEPLOYMENT.md`, still a template.)*
