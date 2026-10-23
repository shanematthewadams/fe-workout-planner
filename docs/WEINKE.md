# Direct Weinke authoring

Shane approved a third welcome choice, **Make a Weinke**, alongside the existing idea and inspiration paths. This is a focused addition to the existing application, not another generator.

- Enter The Thang; name, warmup, Mary and COT/reminders are optional.
- Plain instructions stay literal, including line order, counts and counting conventions. No AI calls, exercise parsing, invented timing, AO facts or equipment assumptions.
- Preview before saving. Save & open Weinke uses the existing private persistence and conflict handling, then opens the existing Lead view with **No timer** selected.
- Input recovery is account-scoped session storage. Explicit saving adds the sheet to My Workouts; cloud acknowledgement remains separate. Failed saves retain notes and never enter Lead.
- Returning to this form can update the same saved identity. Existing newer versions receive the established conflict-copy protection. **Start a new workout** returns to the three entry choices after confirmation, clearing the planning workspace while saved workouts stay intact. See the starting-fresh section of `ENJOYABLE_FLOW.md`.
- Existing workout/backup formats, print/Slack capabilities, advanced editor, timers, AI policies and authentication are unchanged. Equipment/running/timing are not inferred; the provenance warning records those unknowns. This first version is a readable crib sheet rather than automatic exercise extraction.

## Verification

- Verified staging release: `14aa00571dd90218ea30f04efb19dac9acac2172`, tree `ed2cf3fbcb23b9f9849e5c5574058cb77007f835`.
- Repository: `shanematthewadams/fe-workout-planner`; canonical `develop`, fast-forwarded staging mirror `studio/ux-streamline`. URL: https://studio-ux-streamline--fe-workout-planner.netlify.app/. Hosted `build-info.json` matched this exact commit and staging environment.
- Clean `npm ci`, 402 tests across 52 files, lint, TypeScript/production build, script syntax and diff checks passed locally. Five Weinke cases cover literal counts/ordering, failed saving and text recovery, no-AI save/reopen/Lead, stable identities/new sheets, prior generated-draft recovery and unknown metadata. No dependencies or backup schemas changed.
- Development CI https://github.com/shanematthewadams/fe-workout-planner/actions/runs/39880848179 completed successfully: 402 tests, lint/build and **116 browser checks** across desktop/tablet/mobile Chromium and mobile WebKit. Four existing optional historical comparisons were skipped; no new tests were skipped or assertions weakened. Browser matrix: 5.3 minutes.
- Staging CI https://github.com/shanematthewadams/fe-workout-planner/actions/runs/39880850232 completed successfully with the same 402/116 results and four historical skips. Browser matrix: 4.2 minutes. Hosted desktop and mobile WebKit confirmed the exact commit, private saved identity, refresh/reopen and 43:45 timer recovery, plus direct Weinke draft recovery/save/Lead reload with no provider calls, no page errors and no horizontal overflow. Artifact `browser-qa`, ID `12470173344`, retains screenshots, PDFs and reports.
- Inspected welcome and mobile Weinke screenshots. Existing full and Thang-only Q-sheet PDFs retain two pages and one page; extracted ordered text exactly matches the previous verified sheets.
- Local Playwright execution could not launch missing executables. An installation attempt received truncated/invalid browser ZIPs. These are local environment failures, not successful browser checks; actual full Chromium/WebKit execution passed remotely.
- Separate real AI evaluation: `coupon-partners` and `unknown-seasonal-venue` returned validated Gemini output (`gemini-3.5-flash-lite`), and `targeted-refinement` returned AI output. `individual-core-rain` failed with HTTP 504, so the overall live AI evaluation **did not pass**. The workflow emitted its warning and retained `qa/pilot/live-ai.json`. Green application CI is not a claim of uniformly reliable AI. No provider configuration changed.
- Nation's separate read returned HTTP 200, 21 AOs and 17 locations. Reviewed AO snapshots and integration boundaries remain unchanged. No authentication, shared schema, production data or production deployment changes.

## Pilot decision and remaining risks

**CONDITIONAL:** the direct Weinke experience is verified and the small pilot can proceed with the existing provider/device limitations. No blocker was found in this addition.

- **Blocker:** none identified in the delivered Weinke path.
- **Important:** one fresh AI creation probe timed out; automatic creative generation remains variable. Direct Weinke authoring uses no AI and remains available independently. Physical phone background/locked-screen timing remains device-dependent and was not newly claimed by browser tests.
- **Later:** collect pilot feedback on literal authoring and optional richer exercise formatting. This version deliberately preserves supplied text without automatic exercise extraction. The hosted offline-catalog fixture also shows that the dismissible catalog notice can cover lower phone notes; dismissing it is available, and notice placement deserves follow-up polish.

This staging build is a candidate for future production promotion after pilot feedback and provider reliability review. Production `main` remains `07ff6315a6c36f357eb8446e6fd30939948f773d`; production promotion still requires Shane's explicit approval.

## Live verification record

- Release application source was checked directly on staging using one clearly named **Weinke verification — synthetic workout**, ID `52489d55-65bd-4047-9862-d93f97335a6e`. Entered literal 11s instructions, `Hammers 2=1`, `Down and back x4` and synthetic COT notes; previewed, saved, entered Lead with No timer, refreshed and recovered the same saved ID. Saved again through the recovered form without creating another workout. Observed real **Saved to cloud** acknowledgements. Confirmed equipment and running remain **unknown**, rather than incorrectly claiming no equipment/no running. No existing user workouts were changed or deleted.
- The subsequent release commit changes only the hosted smoke script; application source is identical to that direct browser verification. No provider calls are needed by this path. The synthetic workload was retained, not deleted as cleanup.
- The first hosted mobile attempt reported a WebKit access-control pageerror from the intentionally blocked cloud RPC while the timer test advanced 75 seconds of virtual time. Returning an HTTP failure alone did not resolve it. The final harness uses isolated in-memory cloud snapshots and waits for synthetic acknowledgement before installing/advancing the clock. All no-page-error assertions remain, including an added assertion for the direct Weinke view. This fixture does not prove real cloud availability; the separate real browser acknowledgement above does.
