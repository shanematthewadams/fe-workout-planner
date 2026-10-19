# Small-group demo readiness — October 19, 2026

Target: a shareable small-group demo by Friday, October 23. Keep the demo focused on guest planning, personal libraries, F3 profiles, AO-aware planning, and leading a saved workout. Shared/public workout publishing is not included.

## Completed in this pass

- Clarified first-time signup confirmation links versus returning-user email codes on the sign-in screen.
- Profile editing now waits for the stored profile to load, shows a durable save confirmation, and returns readable validation/storage errors. A slow fetch cannot invite edits into an empty form that is about to be replaced.
- Fixed normal guest re-imports creating duplicate workouts after account metadata was attached. Regression coverage revisits settings and imports twice while preserving the original guest plan. Existing ID-conflict handling still keeps separate copies; this is not a universal cross-account deduplication service.
- Route sessions now use their actual saved timing in the preview timeline and copied Q sheet, without inventing a bootcamp warmup.
- Generated `docs/profile-release.sql` from the workout schema and profile installer. It updates the existing validator and creates profile storage in one transaction, without re-adding the existing vault constraint or rewriting workout rows. Apply once after approval using the existing F3 project; it is not an idempotent installer. Regenerate with `npm run sync:schema` after any contract change.
- Added HTTP-contract tests using the actual Supabase query builder and synthetic responses.
- Extended the existing browser account journey with profile creation, saved-name/AO reload and account isolation. Updated the venue journey for confirmed Brougham facilities and marina-only pull-up bars.
- Unit/component tests now reject outgoing requests by default. HTTP tests use fixtures; the shared API integration test has a guarded loopback-only fetch with redirects disabled. This removes an unintended placeholder-host request that automatic approval review correctly blocked.

## Read-only hosted checks

- Located the existing F3 Workout Planner Supabase project and existing Netlify project; no additional projects were created.
- Hosted security advisors returned no warnings.
- Confirmed pg_jsonschema is already installed. The profile table does not yet exist and the current validator does not yet accept attribution. The database upgrade must precede shipping the new frontend.
- Found the existing server-side Nation configuration through the Netlify connector. An authenticated directory read using that configured token returned HTTP 401. No Nation records or official identity links were imported. Credential values were not written to files or printed.
- This supersedes the earlier report's narrower observation that the local checkout lacked Nation credentials: saved server configuration was inspected, but it was not accepted by the API. Token permissions/validity still need resolution. Existing regional snapshots remain available for the demo.

## Verification

- All **334 unit/component/API/local-database tests across 42 files passed**. The full set ran in three bounded batches (100, 103 and 130 tests), plus the new upgrade-preservation test. After the final route timeline change, its affected 53 tests passed again.
- The local upgrade test executes the generated transaction against populated guest/account tables, confirms both stored payloads are unchanged, creates an owner profile, and verifies an attributed account save. PGlite lacks pg_jsonschema: a local shim stands in for that one extension call. The actual generated JSON Schema is checked separately for parity. Hosted extension behavior still needs the release-time checks.
- ESLint, TypeScript and the local production build passed.
- Browser test discovery lists 72 cases across desktop, tablet, mobile Chromium and mobile WebKit. **Discovery is not execution.** No browser journeys, axe checks or screenshots were run here because the supported browser-control skill is unavailable. The updated profile and venue journeys still need CI execution.
- No real sign-in email was sent and no live AI generation was claimed. Existing authentication tests pass using fixtures.

## Exact next release gate

Approval is required for this bounded sequence:

1. Push the tested work to the existing `studio/ux-streamline` branch and run GitHub CI/browser checks; fix observed failures before shipping.
2. Apply `docs/profile-release.sql` to the existing shared F3 Supabase project. Recheck the validator, owner-only profile permissions, advisor results and backward compatibility. The database is shared by staging and production, even when the frontend release is staging-only.
3. Build and deploy the existing staging site on Netlify and verify its runtime. Browser/CI and hosted checks remain engineering work; Shane is not being assigned a manual regression checklist.

No merge to main or production frontend publish is included in that approval request. Staging remains the first reviewable release. Stop if data-preservation, auth or mobile checks fail.

The repository's `AGENTS.md` says: “Explicit approval is required before any production publish, merge to main, or production database change.” It also requires approval for Netlify preview deploys and remote builds that consume credits. This pass remained local and read-only against hosted services; nothing was pushed or deployed and no hosted database writes occurred.
