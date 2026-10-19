# Profiles, attribution and AO planning — October 19, 2026

> Historical checkpoint. Release gates were subsequently completed; see [the staging release record](STAGING_RELEASE_2026-10-19.md) and [the verified Nation directory hookup](NATION_DIRECTORY_2026-10-19.md) for current status.

## State

Implemented and verified locally on `studio/ux-streamline`, starting at `7539ba0`. Remote refs were fetched before editing; this was the current development head. Production main was `07ff631`. No branch was created, no changes were pushed, no Netlify build/deploy was triggered, and no production database was changed. The older develop checkout has unrelated uncommitted work and was left untouched.

## Implemented

- Preserved the existing Supabase PKCE/persistent-session setup, signup confirmation links, returning-user email OTP, sign-out and guest/account workspace isolation.
- Added an owner-only `fe_profiles` table installer, F3 Display Name onboarding prompt, account profile editor, optional home region/AO and retry behavior. Profile failures never block the planner. Email and account creation remain maintained by Supabase Auth rather than copied into a public profile. Profile creation/update timestamps are set by a database trigger; account ID cannot be reassigned.
- Added optional version 1 workout attribution: workspace owner ID, original creator ID/name snapshot, creation timestamp, private visibility and adaptation origin. Kept the existing updatedAt field and immutable account-vault authorization. Saves/imports take ownership from the active account, never from names or email. Copies preserve existing creator and adaptation metadata. Guest originals and original regional source workouts remain intact. Older backups remain readable; old workouts receive metadata on their next successful persistence, rather than bulk rewriting storage.
- Creator snapshots are historical metadata, not server-attested publication claims. A future sharing service must validate ownership and provenance server-side before publishing. No sharing UI or public account/profile directory was added.
- Introduced shared physical venues. Confirmed South Park marina sessions inherit the marina facts reported for Southstride; unconfirmed sessions and Brougham do not inherit marina facts. Brougham includes Shane's reported shelter and picnic benches across the street. No fixed seasonal dates or invented coordinates. Stagecoach/The Gathering reference the same broader venue while retaining distinct AO-specific observations; their exact flag positions remain unconfirmed.
- Added Bootcamp/Run/Ruck choices, with defaults from AO format and an unrestricted override. Run/ruck planning supplies route, target distance, pace/regrouping, optional Mary and COT guidance. Route plans omit warmup and default to skipping Mary when selected. The shared provider contract and local template both support one-section timed route sessions; strict timing remains 2 minutes welcome plus 43 route minutes, or 37 route plus 6 Mary. Target distances remain Q supplied and unmeasured. Additional template exercise stops still require edits; the template explicitly says so.
- Added `npm run catalog:nation-directory`, using the live official OpenAPI contract at https://api.f3nation.com/docs/openapi.json. It reads regional AO hierarchy and referenced location details, validates IDs/region/activity/coordinate ranges, strips contact and leadership fields, and stages exact-name candidates for review. It never automatically renames/creates local AOs or overwrites verified local inventory. No runtime official links were claimed or fabricated.
- Schedule refreshes now retain prior identity links and AOs absent from a refresh, without modifying local facts. Retained absent AOs need review; absence is not proof of closure.

## Verified

- Full automated suite: **327 tests passed across 40 files**.
- ESLint: passed.
- TypeScript and local production build: passed; offline asset generation passed.
- Git whitespace/diff check: passed.
- New coverage includes profile onboarding/editing/retry/guest behavior, actual local PostgreSQL profile RLS and immutable timestamps/IDs, private creator/adaptation preservation and backup round trips, marina inheritance/closure precedence, route template timing, mocked shared-provider route output, Nation privacy/region validation, and non-destructive schedule merges.
- Existing auth/account suites remain passing, including OTP errors, returning sessions, logout, guest import/isolation, stale account writes and private-vault access rules.

## Limits and blockers

- No browser journeys, mobile screenshots or visual checks were run: the supported browser-control skill is unavailable in this environment. Component/accessibility-label tests are not mobile visual verification.
- No live email was sent and no real user session was used. Production/development Supabase redirect settings were not changed or live rechecked. Existing redirect/session regression tests passed.
- No live AI provider call was made. Provider behavior is tested using HTTP fixtures, not claimed as live output quality verification.
- The unauthenticated F3 Nation org-chart request returned HTTP 401. This checkout has no F3_NATION_TOKEN or F3_REGION_ID. The new adapter is fixture-tested, but authenticated live schemas, location-to-AO reconciliation and official runtime directory application remain pending existing server credential access.
- The current Google Sheet was not refreshed during this sprint; existing repository snapshots and Shane's supplied venue clarifications were used. Nothing was written to the Sheet.
- Local PostgreSQL tests cover profile RLS and existing account RPC authorization. They do not execute Supabase's pg_jsonschema extension or hosted project advisors. No hosted migration has been applied.
- The existing large-bundle build warning remains; it does not fail the build.

## Release order / next work

1. Run supported desktop/mobile browser QA; verify profile/network failure behavior and representative free-provider route output.
2. After explicit approval, install `docs/user-profiles.sql` and update the `fe_private.valid_plan_payload` function from the regenerated `docs/plan-sync-hardening.sql`. **On an existing installation apply the function/revoke section only; do not re-add its already-existing `valid_workout_payload` constraint.** The new optional attribution property requires the validator upgrade before deploying the frontend. Existing rows need no rewrite. New profile install and validator replacement should be executed as one reviewed migration transaction in the release environment; then run hosted access/advisor checks.
3. Push/release the tested development branch only after approval for the resulting Netlify build/deploy. No routine PR review or manual regression work is assigned to Shane.
4. Use existing server-side Nation credentials to run the staging command, inspect exact matches and shared/seasonal venue IDs, then add reviewed official references. Keep unknown flags unknown and preserve all local inventory.

`AGENTS.md` explicitly requires approval before production publish, merging main, production database changes, or remote builds/deploys consuming credits. This sprint is locally complete within those boundaries; it is not a deployed or fully browser-verified release.
