# F3 Q Builder pilot verification — October 21, 2026

October 22 update: the steel-blue palette sweep is implementation commit `19827fa011ed7534b14a3c0d1ecf9a9e3ebb72e9`, deployed and verified at `19d10a466e99a19bb11dd1f2228bceb4427d522c` after a CI-only installation-timeout guard. See [DESIGN_PALETTE.md](DESIGN_PALETTE.md) for current deployment and verification evidence. The reliability/flow history below is retained; the latest separate AI evaluation had three HTTP 504 creation failures and could not run refinement. The palette change does not resolve the recorded AI-provider consistency limitation.

## Decision

**CONDITIONAL — the small October 23 pilot can proceed.** The hosted guest flow, private save, recovery, print and Lead experience are verified. Shane separately confirmed real email delivery and completed the short phone acceptance test successfully. Free AI can time out and fall back to a clearly labeled template; continuous locked-screen/background behavior remains device-dependent. Staging only; production was not promoted.

## Latest release: first-visit flow follow-up

This section supersedes the original release identifiers and counts below. Verified on October 21 in America/Chicago (October 22 UTC).

- Deployed application commit: `5925045f9b79202f9f51635c12edff33fcd4fcc5`; source tree: `005c176c698734956df2aecd59504420befee603`. Canonical branch: `develop`; existing staging mirror: `studio/ux-streamline`. Production `main` remains `07ff6315a6c36f357eb8446e6fd30939948f773d`.
- Staging: https://studio-ux-streamline--fe-workout-planner.netlify.app/. `build-info.json` independently returned the exact application commit and `staging` environment. Deployment confirmed; no production promotion.
- The first screen now explains the product and optional account, provides a no-AI example starter, labels Surprise Me visibly, and shows Describe → Review → Save & lead. Formal Builder/import sit under Other ways to start. Main navigation prioritizes Build, Library and My Workouts, with the remaining destinations under Tools & resources.
- Save a private copy is now Save workout. Successful saving names My Workouts and highlights Lead. Empty first visits omit the idle saving bar; restoration hooks and error/recovery states remain active. Existing save formats, identity, authentication, AO validation and print behavior are preserved.
- `npm ci`, lint, 387 unit/component tests across 50 files, and build/typecheck passed in both final CI runs. Full browser suite: 108 passed across desktop, tablet, mobile Chromium and mobile WebKit; four pre-existing optional historical comparisons skipped. No remaining failed application assertions.
- Development CI: https://github.com/shanematthewadams/fe-workout-planner/actions/runs/39703756493. Staging CI: https://github.com/shanematthewadams/fe-workout-planner/actions/runs/39704415466. Staging artifact `browser-qa`, ID `12394850756`, includes screenshots, rendered print PDFs, hosted verification and live AI results.
- The first browser run had one failure: WebKit's offline worker bypassed the new test's provider mock, returning the static preview's 404. The trace established the cause. The mocked first-visit test now blocks service workers; the separate real offline-cache test still exercises them. The exact provider-call assertion remains and all four first-visit profiles pass.
- Inspected desktop and phone first-visit screenshots. Hosted desktop Chromium/mobile WebKit smoke passed saved ID, bookmark refresh, My Workouts reopening, Lead, paused 43:45 timer recovery after navigation/reload, Resume, no uncaught errors and no horizontal overflow. These hosted smoke tests isolate external services; they do not assert live cloud/provider success.
- Separately exercised the actual deployed UI with a new clearly labeled synthetic workout: example fill → real request timeout → labeled template → manual title edit → save → Saved to cloud → My Workouts → reopen/refresh → Lead. No existing workout was edited or deleted. Captured the actual staging screen.
- Live Nation read again returned HTTP 200, 21 AOs and 17 locations; the application still uses a reviewed snapshot rather than automatic live synchronization.
- **Important: live AI batch did not pass.** All three complex creation cases returned templates (one malformed/incomplete response and two timeouts); the AI refinement case was skipped because the batch had no validated AI draft. CI emits an explicit warning and retains `live-ai.json`; overall workflow success does not mean this separate evaluation passed. Netlify request logs showed invalid provider responses and timeouts. A separate explicit Gemini request, “A coupon workout for partners. No running.” at Gold Rush, returned a validated Gemini `gemini-3.5-flash-lite` workout with HTTP 200 in 8,167 ms. This proves a working connection, not reliable availability or success for the failed complex cases. No credentials, shared environment settings, billing or provider validation were changed.
- Blocker: none found in the verified template/manual/save/Lead journey. Important: AI output/latency consistency and device background behavior. Later: remaining AO reports and minor polish. The conditional pilot should retain the visible template option; this is not evidence for an AI-reliability claim.
- Production recommendation: retain staging for the pilot and collect first-use feedback; address provider consistency before a wider public rollout. Promotion still requires Shane's explicit approval.

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

## Original reliability sprint release

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
- Verified by Shane: real email delivery and the short phone acceptance test passed. Engineering's mocked authentication coverage remains separate evidence from that successful inbox test.
- Important: continuous iPhone lock-screen audio, installed voices, long background sessions and OS wake-lock behavior were not separately instrumented. Shane's successful phone test and mobile Chromium/WebKit automation do not establish every device power/background mode. Keep Lead visible for timer/audio use; saved plans and print remain available.
- Important: the real rainy-core request timed out. AI availability, output consistency and broad-refinement fidelity remain provider-dependent; templates are labeled, existing drafts survive refinement errors and manual editing remains available. This is the explicit limitation behind the CONDITIONAL decision.
- Later: remaining AO reports, uncertain distances, nearby access and seasonal changes remain explicit unknowns or review candidates. The app uses reviewed Nation/AO snapshots rather than scheduled live synchronization.
- Later: minor offline-template wording can be tightened; this does not prevent following the listed exercises or timing.

## Production recommendation

A candidate for eventual promotion after pilot feedback and completion of the outstanding service/device checks. No main merge, production publication, paid service, auth/access-control change or destructive database operation occurred. Production still requires Shane’s explicit approval.
