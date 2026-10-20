# Preview readiness follow-up — October 20, 2026

Status: focused fix deployed to staging; source, hosted runtime and fresh CI verified. This report records fresh work, separate from the inherited reliability release.

## Source and workspace

- Repository: `shanematthewadams/fe-workout-planner`; only working branch: `studio/ux-streamline`.
- GitHub branch head was checked twice and remained `fa0153856b4e540ce345584d1b0812e44a6cbb01`, tree `08fe448d7f4f803841714d7e0652da04b2b0e7fc`.
- The current workspace initially had no planner checkout. No Studio-only edits were present there. Existing archives elsewhere were left untouched.
- Terminal Git lacked repository credentials. The connected GitHub app supplied the exact current snapshot. All 217 blob hashes and the complete tree were validated; the exact original commit object was restored as a shallow local checkout with the existing GitHub origin. No replacement repository, remote branch, hosting project or database was created.
- Read all seven requested engineering records. The reliability verification report supersedes the older unfinished-work handoff. Reviewed package scripts, current application handlers, fixtures and recent release/documentation commit records.
- Local implementation commit: `9bb5953c9662526cb5bbe4174b1c81d5ebcf7624`; tree `c55ae510f7a245a3297b7dba7196fd21373877e6`. Subsequently published in the consolidated release recorded below.

## Reproduced defect and fix

After **Save a private copy**, the app persisted a new workout ID but kept the original unsaved draft ID in the planner. **Preview & print**, **Edit the details** and **Lead workout** could therefore use an unsaved identity. Reloading its bookmark could fail to find the saved workout; editing could create a second copy; timer recovery could be attached to the draft rather than the workout reopened from My Workouts.

The strengthened component assertion failed on the original source. Both new desktop browser regressions also failed against the original build at the exact saved-ID assertions, before rebuilding the fix.

`src/App.tsx` now returns the successfully persisted, privately attributed copy. `src/Planner.tsx` adopts that copy in its current result and existing session persistence. Failed saves still return false and leave the current result intact. Refinements remain new drafts; the existing storage, account, cloud and conflict controllers are reused.

Regression coverage:

- `tests/unified-ui.test.tsx`: Preview must route to the actual saved ID.
- `e2e/reliability.pw.ts`: Preview/reload and returning to Build/Edit preserve the saved ID; saving edits leaves one workout with the edited title. Lead uses the saved ID, then preserves **43:45** after leaving, reopening through My Workouts and reloading.
- Planner callback fixtures in `tests/planner-ui.test.tsx`, `tests/audit-regressions.test.tsx`, `tests/planning-details.test.tsx` and `tests/renaissance.test.tsx` now return the saved workout rather than a boolean success marker.

The participant guide's action labels and paths still match the interface; no new guide flow or labels were needed. No additional material defect was identified in the scoped review.

## Fresh verification executed

| Check | Result |
| --- | --- |
| Locked dependencies: `npm ci --ignore-scripts` | Passed |
| Full tests after the fix: `npm test -- --maxWorkers=1` | **378 passed in 48 files** |
| Focused component check | **8 passed in 2 files** |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `VITE_APP_ENV=staging npm run build` | Passed, including offline generation |
| Isolated cloud fixture Vite build | Passed, fake backend only |
| Complete final Playwright run | **100 passed; 4 optional historical comparisons skipped; zero failures** |
| `git diff --check` | Passed |

The final full browser command was `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 FE_CLOUD_TEST_DIR=qa/cloud-app FE_STAGING_TEST=true npm run test:browser`. It covered desktop Chromium, tablet Chromium, mobile Chromium and mobile WebKit, including the eight new checks (two per profile), existing account/import isolation, cloud acknowledgement/offline recovery, AI failure handling, print, voice fixtures, timers, accessibility and overflow assertions. Desktop recovery and mobile WebKit first-visit/recovery screenshots were visually inspected.

Browser setup used official downloads and extracted Ubuntu libraries in the local browser directory. WebKit's global package preflight was skipped because it cannot recognize locally extracted libraries; the actual WebKit engine launched and ran its tests. Preliminary setup runs encountered the already documented Nimbus-versus-Liberation print-font issue, plus a shared Playwright artifact-directory collision between overlapping diagnostic runs. Liberation fonts were registered and the final complete browser run was serialized. Assertions and print styling were not weakened.

Final logs, the original failing reproductions, prepared-build fingerprint and isolated tested build are under ignored `qa/preview-readiness-2026-10-20/`; screenshots are under `qa/screenshots/`. These are local evidence, not a new CI run.

## Prepared build and authorized staging release

Before publication, a fresh read-only download confirmed that staging HTML referenced `/assets/index-BYhH8v0x.js`. Its downloaded SHA-256 is `ed480ab46c6b032b235abc8772d42f9fef1b67edec47d3a1aadf72eba014494d`, matching the inherited reliability release. That was the prior reliability release; current deployment metadata is recorded below.

A second local production build reused only the existing public Supabase settings in `netlify.toml`, with `VITE_APP_ENV=staging`, and passed. Prepared candidate:

- Asset: `/assets/index-DAPcL_9C.js`
- SHA-256: `3ccbc04393b20d9aab32b4038e81edf9ac65adcae478fbf029f42eea5683d01a`

The full local browser suite used the same source with isolated configuration and a fake cloud build. The public-configured candidate was then built locally, deployed, compared against hosted files, and exercised through the hosted smoke checks recorded below.

During the initial local-verification phase, no push or remote build/deployment occurred. The authorized staging release followed afterward. No main merge, shared database mutation, email or live AI call occurred. Production was untouched.

Shane subsequently gave standing authorization: “You can push to staging without my approval from this point forward.” `AGENTS.md` now records routine development-branch pushes, remote verification builds and staging/preview deployments as authorized without another approval request. Relevant local checks and hosted verification remain required. Production, main merges, shared database changes, paid services and new infrastructure remain outside this authorization.


### Published release evidence

- Release commit: `d86d64d322e7d5f9bb103384120aeeb81a85f735`; full source tree `2da51549bbb8dbda1af52c2c1e6b1c79f26e3217`, identical to the prepared local checkout, including the updated staging authorization. The GitHub app consolidated the local commits because terminal Git has no write credentials. The local branch was aligned to this exact published commit without changing application/test files.
- Netlify deploy: `6ad7e92247e9c9a828342d8f`, **ready**, `branch-deploy`, `studio/ux-streamline`, exact release commit above. Confirmed through Netlify's deployment record.
- Staging: https://studio-ux-streamline--fe-workout-planner.netlify.app/
- Immutable deploy: https://6ad7e92247e9c9a828342d8f--fe-workout-planner.netlify.app/
- Deploy details: https://app.netlify.com/projects/fe-workout-planner/deploys/6ad7e92247e9c9a828342d8f
- Fresh CI: https://github.com/shanematthewadams/fe-workout-planner/actions/runs/39507362872 — **success: 378 tests in 48 files; lint and production build; 100 browser checks passed, 4 optional historical comparisons skipped**. Fresh CI logs were read; artifact `browser-qa` was uploaded with ID `12303963106`.
- All **20** hosted HTML, service-worker, referenced JavaScript/CSS/font and bundled-license files match their prepared local files **byte-for-byte**. Hosted JavaScript has the candidate SHA-256 above. Hash evidence is in `qa/preview-readiness-2026-10-20/hosted-files.json`.
- Hosted desktop Chromium and mobile WebKit both passed: offline-template creation, private save, exact saved-ID Preview and bookmark reload, Lead start, **43:45** paused timer recovery after reopening through My Workouts, reload and Resume availability. No uncaught page errors or horizontal overflow. Both hosted screenshots were inspected.
- Hosted smoke blocked all external cloud/auth/provider requests before transmission and blocked planner API calls. It used fresh synthetic browser storage; no real workout collection, account, email or AI service was mutated. The catalog fallback notice in the screenshots is expected from this deliberate isolation. An initial smoke assertion checked before React rendered the new timer state; the final smoke uses Playwright's rendered-state assertions and passed on both engines.
- Main was freshly checked and remains `07ff6315a6c36f357eb8446e6fd30939948f773d`; Netlify's current production deploy remains `6ad40f99b56825e4ed9504b4`.

A later documentation-only commit records these release results with `[skip ci] [skip netlify]`; it does not represent another application deployment.

## Remaining limits

- No physical iPhone capability is available here. Locked-screen/background audio, actual installed voices, long sessions, OS wake-lock and physical touch behavior remain unverified.
- Real inbox delivery and current live AI output were not newly exercised. Synthetic fixtures do not prove either service's current availability.
- AO inventory reconciliation remains deferred while Shane collects reports. No Sheet changes, report promotion, seasonal merging or inventory publishing occurred.
