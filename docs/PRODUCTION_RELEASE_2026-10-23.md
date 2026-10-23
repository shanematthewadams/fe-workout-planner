# Production release — October 23, 2026

Shane Adams explicitly approved this production promotion. PR #7 was merged through the established release workflow after green develop/PR checks and Shane's screenshot confirmed the production Site URL plus production and staging redirect allowlists.

- Production: https://q.f3thefe.com/
- Repository: shanematthewadams/fe-workout-planner
- Branch: main
- Release commit: e254c11ec266e62586208cb1282f9eeb8e7b093a
- Netlify deploy: 6adb626c9db75fd5bd2ae9ac
- Netlify production deployment: ready; published 2026-10-23T13:35:04Z.
- Live build-info.json independently matched the release SHA and production environment.
- CI: https://github.com/shanematthewadams/fe-workout-planner/actions/runs/39962359097 — success.

## Verification

npm ci, lint, 416 tests in 54 files, and the production build passed. Browser suite: 124 passed, 8 existing conditional skips (four staging-label-only checks and four optional historical visual comparisons). No assertions were weakened or new skips introduced.

Hosted production checks passed on desktop Chromium and mobile WebKit: saved identity, inline edits/Undo, bookmark reload, My Workouts, timer pause/recovery at 43:45, structured Weinke recovery and counts, direct-card Lead, reload, and start-fresh preservation. No page errors or overflow. The smoke harness isolates Supabase/auth/provider calls with fixtures and does not mutate real records. This verifies the deployed application journey, not a new live account/cloud synchronization test.

The live welcome screen showed all three entry choices, clear purpose, no account requirement, and no staging label. The planner route returned the expected 405 for GET (it requires POST).

F3 Nation diagnostic returned 404 as designed: server/nation-directory-handler.ts restricts that diagnostic to branch-deploy context. Production uses bundled reviewed AO information; do not describe the production directory as live. Staging previously verified a real Nation read with 21 AOs and 17 locations.

## Boundaries and known limitations

No database migrations, user-data edits, authentication configuration changes, provider-key changes, or saved-workout resets were performed. Shared Supabase configuration was preserved. Shane had already verified email delivery; no new test emails were sent.

Production provider credentials were configured and matched the tested staging credentials during preflight. The latest staging real-AI evaluation had three successes and one HTTP 504. A production AI generation or live OpenRouter rescue was not newly verified during promotion. Offline recovery is verified. Physical-phone locked-screen/background behavior remains device-dependent and was not newly verified.

Decision: CONDITIONAL for a small pilot, with intermittent real-AI availability and physical-device limitations documented above. The promoted application is live; further production releases still require explicit approval.
