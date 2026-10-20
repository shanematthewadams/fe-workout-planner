# Reliability sprint — verified locally, staging release pending

Implementation commit: `ce80a93b9cd1f70331b8ffc3a660206e3de6e1bd` on `studio/ux-streamline`, based on `f7bfbbf`. The implementation and this report are local and unpushed. No new branch, application, infrastructure, database migration, remote build or deployment was created. Main and production were not changed.

## Changes

- `src/App.tsx`: bookmarked workouts retain a separate recovery message while cloud hydration runs. A catalog failure can no longer overwrite that message. The exact cloud workout opens when it arrives; tested identity/content survive without duplication.
- `src/Planner.tsx`: provider 504/408, unavailable services, client timeouts and network failures give safe recovery language. Backend diagnostics are not rendered as error text. Existing drafts survive failed refinements and server template fallback. The stalled-client test confirms one abort after 55 seconds and no automatic retry.
- `src/SessionTimer.tsx`: countdowns persist a paused elapsed value on exit/pagehide; live schedules retain their clock anchor. Visibility restoration catches up without replaying missed section sounds. Recovery stays same-day and revision-scoped. Session completion, reset and resumed timing are tested.
- `src/IntervalTimer.tsx` and `src/SessionTimer.tsx`: ignore a second double-click event on start/pause controls. Existing circuit/interval timing and presets remain intact.
- `src/useWakeLock.ts`: explains unsupported/denied screen wake while leaving the timer usable. Pending-request deduplication and late-grant cleanup remain covered.
- `scripts/ao-inventory.ts`, `scripts/compare-ao-inventory.ts`, `package.json`, `docs/AO_INVENTORY_COMPARISON.md`, `docs/examples/ao-inventory.json`: read-only inventory comparisons with baseline facts, citations, review dates, Q/co-Q lists, seasonal venue scopes and retained conflicting/unsupported reports. Distances retain certainty; nearby landmarks, weather cover, lightning shelter and indoor permissions remain separate. No report is applied or sent to the planner.
- `tests/ao-inventory.test.ts`, `tests/account-ui.test.tsx`, `tests/audit-regressions.test.tsx`, `tests/lead-timer.test.tsx`, `tests/planner-ui.test.tsx`, `tests/wake-lock.test.tsx`, `e2e/reliability.pw.ts`: new failure/recovery coverage, including delayed confirmation/code resends with guest-work preservation.
- `eslint.config.js`: excludes generated Playwright report assets so local browser QA does not break the next lint run.
- `docs/SMALL_GROUP_PREVIEW_2026-10-23.md`: updated with verified action labels, actual save acknowledgement, timer exit behavior and recovery choices.

## Fresh verification

| Check | Executed result |
|---|---|
| `npm ci --ignore-scripts` | Installed locked dependencies successfully |
| `npm test -- --maxWorkers=1` | **378 tests passed across 48 files** |
| `npm run lint` | Passed, including after browser report generation |
| `npm run typecheck` | Passed |
| Production build | Passed, including TypeScript and offline asset generation |
| Full Playwright suite | 91 passed, 1 desktop print failure, 4 optional historical comparisons skipped |
| Corrected print environment and targeted regression | **24 passed** across desktop Chromium, tablet Chromium, mobile Chromium and mobile WebKit |
| Inventory CLI | Generated JSON was parsed successfully; application inventory remained unchanged |
| `git diff --check` | Passed |

The initial print failure was environmental: the local browser selected Nimbus Sans instead of CI's Liberation Sans/Arial-compatible font. After registering the same Liberation fonts installed by the CI browser-dependency step, the desktop full-sheet/Thang-only PDF checks passed without weakening assertions or modifying print styles. The targeted regression reran print/edit/save/lead/reopen and all five new reliability journeys on all four projects. Together the runs cover all **92 distinct nonhistorical browser checks successfully**; the complete suite was not rerun after the font correction.

The final Lead recovery checks assert zero uncaught page errors, console errors and failed requests. Existing and new axe assertions and layout-overflow checks passed. Desktop and mobile WebKit session recovery screenshots were visually inspected, along with the failing print screenshot during diagnosis. Existing browser tests exercised isolated auth, guest import/account isolation, expired callbacks/codes, offline recovery, navigation, voice, circuit timers and AO handling. Tests used synthetic services; no real emails, user workouts or live AI calls were used.

Local Chromium and WebKit were made operational using official browser downloads and extracted Ubuntu dependency libraries. WebKit's host-wide package-presence preflight was skipped because its libraries were loaded from the browser's local library directory; WebKit itself launched and executed the tests. No permission escalation or remote CI was needed. There is **no new GitHub Actions run or CI result to cite**.

Logs and screenshots are in ignored local QA files (`qa/reliability-verification`, `qa/screenshots`); they are supplementary, not published CI artifacts.

## Prepared staging build

A final local build reused only the existing public Supabase URL/publishable-key settings from `netlify.toml`, with `VITE_APP_ENV=staging`. No credentials were printed or added to source.

- JavaScript: `dist/assets/index-BYhH8v0x.js`
- SHA-256: `ed480ab46c6b032b235abc8772d42f9fef1b67edec47d3a1aadf72eba014494d`

This is a local artifact fingerprint, **not a hosted deployment verification**. Test builds also exercised the same source with unconfigured cloud and an isolated fake backend. Netlify context overrides must be checked and the actual hosted bundle reproduced/compared before calling staging ready.

## Release gate and next executable action

`AGENTS.md` requires: “Netlify preview deploys and remote builds that consume credits also require approval.” The sprint prompt explicitly preserves that gate. No push was made because it can trigger a Netlify build.

After Shane approves credit-consuming staging verification/deployment:

1. Recheck the remote development head and preserve any concurrent Studio edits. Publish the tested source to the same branch. A later report-only commit must not accidentally suppress the intended staging build; use an explicit release commit with the same tested application files if needed.
2. Run the existing GitHub workflow for fresh remote evidence if required, without enabling optional live-cloud mutation checks. Inspect its reports, not historical results.
3. Release only the existing staging branch. Do not merge main, publish production or change the shared database.
4. Check deploy commit/tree, effective public build configuration, hosted HTML/asset name and bundle SHA-256 against a reproduced build. Record deploy/CI URLs and the successful comparison here.

## Remaining limitations

**Engineering/release:** no known failing automated application checks after the documented print-environment correction and targeted rerun. Staging publication, remote CI and hosted source verification remain pending approval. Real inbox delivery and current live-provider output were not newly tested. Timer recovery is device-local, same-day and tied to the workout revision; browser termination can interrupt recovery/audio.

**Physical device:** emulated mobile WebKit is not an iPhone hardware test. Locked-screen/background sound, actual voice output, long sessions, OS wake-lock behavior and physical touch/double-tap behavior still need device verification.

**Shane's post-summit inventory:** collect the remaining AO reports, convert source-backed updates into comparison input, review ambiguous/conflicting facts and approve supported proposals through the existing maintainer process. No actual inventory reconciliation has been performed.

The short participant walkthrough is `docs/SMALL_GROUP_PREVIEW_2026-10-23.md`. Do not present the old staging deployment as containing this sprint's changes.
