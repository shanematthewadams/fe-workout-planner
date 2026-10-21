# F3 Q Builder pilot verification — October 21, 2026

## Decision

**CONDITIONAL — the small October 23 pilot can proceed.** The hosted guest flow, private save, recovery, print and Lead experience are verified. Free AI can time out and fall back to a clearly labeled template; physical-phone background behavior and fresh email delivery are not established. Staging only; production was not promoted.

## Implemented

- Fast-forwarded remote develop from ae3257e to main 07ff6315, then incorporated all 50 preserved staging commits plus this sprint. All four older feature branches are ancestors of the preserved staging work; no open PRs were found. No force-push, discarded work, new branch, replacement app, or repository was created.
- Canonical engineering branch is now develop, following Shane’s current instruction. The existing studio/ux-streamline branch remains a fast-forward-only Netlify staging mirror. CI covers both. Production remains main.
- Reproduced and fixed unrequested changes during explicit single-exercise replacements. For an unambiguous “Replace/Swap/Change X with/for/to Y” request, reject changes to other exercises, section/block order, timing, workout title, running or format. Original inputs remain intact. Broad or ambiguous natural-language revisions still require contextual interpretation and review; this is not a guarantee of semantic equivalence for every possible AI request.
- Reproduced and fixed Surprise Me dropping no-running/no-Mary restrictions from the original idea. It now resolves those preferences before replacing the idea, while preserving coupon availability and temporary AO closures.
- Read the current regional Google Sheet and integrated direct Site Q reports for Gold Rush, Stagecoach, Dysentery and Sunnyside Up. Stored source, read date and source-record references. Did not promote legacy blanket Yes/No flags, uncertain distances, nearby facilities, seasonal light displays, coupon storage or gathering-only indoor permissions. Existing Site Q identities were preserved.
- Added a public build commit stamp and hosted verification script. The staging CI path checks the exact deployed commit, runs desktop Chromium/mobile WebKit recovery smoke tests, and records real Nation/provider results separately from mocks and template success.

## Verification

- npm ci: passed.
- npm test -- --maxWorkers=1: 387 passed across 50 files.
- npm run lint, npm run typecheck and staging npm run build: passed.
- Full browser CI on develop: 104 passed across desktop, tablet, mobile Chromium and mobile WebKit; four optional historical comparisons skipped. No failing application checks.
- Development CI: https://github.com/shanematthewadams/fe-workout-planner/actions/runs/39584094316.
- Local browser exception: browser downloads returned a Site Unavailable HTML page; missing Chromium executable was confirmed. The attempted local run was stopped after infrastructure failures. No assertions were weakened; complete browser coverage ran on CI’s installed engines.
- Regression tests failed before both reliability fixes and passed afterward. Added AO-source/unknown/closure/session-override tests and a four-profile Surprise Me failure/save/refresh journey.
- Existing automated coverage exercises optional signup/F3 Name, returning sign-in, account isolation, guest import, natural-language/formal/offline generation, cancellation/provider errors, refinement, editing, saving/reopening, backups, offline recovery, cloud conflict/acknowledgement behavior, timers, browser interruption/recovery, Slack copy, print and accessibility. Mocked identity/provider/cloud fixtures do not prove live SMTP or provider availability.
- Inspected the actual rendered print PDFs: representative full Q sheet is two readable Letter pages; Thang-only is one. No clipped exercise/count text or site controls. OS mobile print dialogs were not tested on physical hardware.
- Hosted browser: exact build-info commit and staging environment verified; created only a clearly labeled synthetic guest workout, observed Saved to cloud, reopened it through My Workouts and refresh, then opened Lead. No existing private workout, account, production configuration or database schema was modified.

## Release

- Repository: shanematthewadams/fe-workout-planner.
- App commit: a01b9b169fcc3b1775b366e9df8a022dc8d16ed1.
- Source tree: 90eb37577e6c5a316bbb11db1c0ff69c7ae1247b.
- Development branch: develop. Existing staging mirror: studio/ux-streamline.
- Staging: https://studio-ux-streamline--fe-workout-planner.netlify.app/.
- Staging CI: https://github.com/shanematthewadams/fe-workout-planner/actions/runs/39585079202.
- Deployment status: serving the exact tested commit; build-info.json independently read in the hosted browser and by CI. Desktop Chromium and mobile WebKit hosted smoke passed: private-save identity, bookmark refresh, My Workouts reopen, Lead start, 43:45 paused timer recovery, reload and Resume; no uncaught errors or horizontal overflow. Hosted screenshots were inspected. Smoke blocks external cloud/auth/provider requests; its catalog-unavailable notice is deliberate isolation, not evidence of an upstream outage.
- Final staging CI repeated 387 unit/component tests and 104 browser checks successfully, with four optional historical comparisons skipped. Hosted smoke also passed. The separate all-AI evaluation failed its four-of-four goal and emitted a visible CI warning: three validated Gemini gemini-3.5-flash-lite responses (coupon partners, unknown seasonal venue, equipment-removal refinement), and one rainy individual/core request that timed out and returned a labeled template. No failed provider case is counted as AI success. Successful outputs were inspected; wording and exercise instructions still require normal Q review.
- Live Nation authenticated server read: HTTP 200, 21 AOs and 17 locations. App navigation uses the existing reviewed snapshot and official map links; this is not automatic live schedule/amenity/Site Q synchronization. The source Sheet supplies Site Q facts independently.
- Live private guest cloud save: the browser showed Saved to cloud for one new synthetic workout, followed by My Workouts reopen/refresh and Lead. Account ownership/OTP/conflict/offline paths have deterministic fixtures; this does not claim fresh real-email delivery.
- Final staging artifact: browser-qa, ID 12339665190, attached to the staging CI run above. It includes hosted-verification.json, live-ai.json, screenshots and browser reports.
- Production main remains 07ff6315a6c36f357eb8446e6fd30939948f773d; published Netlify deploy remains 6ad40f99b56825e4ed9504b4.

## Remaining risks

- Blocker: none identified in the verified guest pilot flow.
- Important: real email delivery was not newly exercised. Signup is optional; tested guest planning, device saving and private guest cloud saving remain available. Do not describe simulated email verification as inbox delivery.
- Important: physical iPhone lock-screen audio, installed voices, long background sessions and OS wake-lock remain unverified. Mobile Chromium/WebKit emulation is not hardware verification. Keep Lead visible for timer/audio use; saved plans and print remain available.
- Important: the real rainy-core request timed out. AI availability, output consistency and broad-refinement fidelity remain provider-dependent; templates are labeled, existing drafts survive refinement errors and manual editing remains available. This is the explicit limitation behind the CONDITIONAL decision.
- Later: remaining AO reports, uncertain distances, nearby access and seasonal changes remain explicit unknowns or review candidates. The app uses reviewed Nation/AO snapshots rather than scheduled live synchronization.
- Later: minor offline-template wording can be tightened; this does not prevent following the listed exercises or timing.

## Production recommendation

A candidate for eventual promotion after pilot feedback and completion of the outstanding service/device checks. No main merge, production publication, paid service, auth/access-control change or destructive database operation occurred. Production still requires Shane’s explicit approval.
