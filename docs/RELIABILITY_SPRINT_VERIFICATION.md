# Reliability sprint — staging release verified

Local implementation commit: `ce80a93b9cd1f70331b8ffc3a660206e3de6e1bd`, based on `f7bfbbf`. Shane subsequently approved the staging build/deployment. Published release: `dbfac72375f574bcfb7ffbb243c9945db228ced1` on `studio/ux-streamline`, tree `9050f432188a5f14a4509ae7b831e998d5ac5516`. The connected GitHub app published a consolidated commit after the terminal lacked write credentials; its complete source tree matched the local release tree exactly. No application or test code changed after local verification. Main and production were not changed.

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

Local Chromium and WebKit were made operational using official browser downloads and extracted Ubuntu dependency libraries. WebKit's host-wide package-presence preflight was skipped because its libraries were loaded from the browser's local library directory; WebKit itself launched and executed the tests. No permission escalation was needed for local verification. Fresh remote evidence for the approved release is recorded below.

Local logs, hosted hash evidence and screenshots are in ignored QA files (`qa/reliability-verification`, `qa/screenshots`). CI uploaded the fresh `browser-qa` artifact (ID `12235859479`) for release commit `dbfac72`; its screenshots/reports are separate from local evidence.

## Prepared staging build

A final local build reused only the existing public Supabase URL/publishable-key settings from `netlify.toml`, with `VITE_APP_ENV=staging`. No credentials were printed or added to source.

- JavaScript: `dist/assets/index-BYhH8v0x.js`
- SHA-256: `ed480ab46c6b032b235abc8772d42f9fef1b67edec47d3a1aadf72eba014494d`

The actual staging HTML references this exact asset. All 20 current HTML, service-worker, referenced JavaScript/CSS/font and bundled-license files match their local counterparts byte-for-byte. Unreferenced older local build assets are excluded from this comparison. The downloaded hosted JavaScript matches the prepared local build **byte-for-byte**, including the SHA-256 above. The deploy is a `branch-deploy` for the exact release commit, not a production publish. Isolated browser tests additionally exercised the same source with unconfigured cloud and a fake backend.

## Authorized staging release

- Staging: https://studio-ux-streamline--fe-workout-planner.netlify.app/
- Netlify deploy: `6ad6d1934a3a28c0c24412f9`, **ready**, exact commit `dbfac72375f574bcfb7ffbb243c9945db228ced1`, `studio/ux-streamline`, `branch-deploy` context.
- Deploy details: https://app.netlify.com/projects/fe-workout-planner/deploys/6ad6d1934a3a28c0c24412f9
- Immutable preview: https://6ad6d1934a3a28c0c24412f9--fe-workout-planner.netlify.app/
- GitHub Actions: https://github.com/shanematthewadams/fe-workout-planner/actions/runs/39359011599 — **success: 378 tests across 48 files; lint, TypeScript and build; 92 browser checks passed, 4 optional historical comparisons skipped**
- Hosted smoke checks passed on desktop Chromium and mobile WebKit: explicit offline template, Lead mode, timer start, pause-on-exit, reopen, unchanged elapsed time and Resume. No uncaught page errors or horizontal overflow. No live AI request, email or saved-workout mutation was performed. Mobile WebKit canceled one read-only catalog request after its loader timed out; the bundled catalog fallback remained usable. Both hosted screenshots were inspected.
- Browser smoke used the managed network proxy; its certificate was ignored in the browser context only. The independent HTTPS asset download used the environment's normal certificate verification.
- Production remains at Netlify deploy `6ad40f99b56825e4ed9504b4`; main remains `07ff6315a6c36f357eb8446e6fd30939948f773d`.

The approval gate in `AGENTS.md` was satisfied by Shane's explicit “approve the staging build deployment.” No main merge, production deployment or shared database change was performed. The source tree, Netlify commit metadata and hosted bundle comparison agree. Future production publication still requires separate approval.

## Remaining limitations

**Engineering/release:** no known failing automated application checks after the documented print-environment correction and targeted rerun. Staging publication and hosted source verification are complete. The complete CI browser run passed after publication. Real inbox delivery and current live-provider output were not newly tested. Timer recovery is device-local, same-day and tied to the workout revision; browser termination can interrupt recovery/audio.

**Physical device:** emulated mobile WebKit is not an iPhone hardware test. Locked-screen/background sound, actual voice output, long sessions, OS wake-lock behavior and physical touch/double-tap behavior still need device verification.

**Shane's post-summit inventory:** collect the remaining AO reports, convert source-backed updates into comparison input, review ambiguous/conflicting facts and approve supported proposals through the existing maintainer process. No actual inventory reconciliation has been performed.

The short participant walkthrough is `docs/SMALL_GROUP_PREVIEW_2026-10-23.md`. The staging URL now serves this sprint's verified source.
