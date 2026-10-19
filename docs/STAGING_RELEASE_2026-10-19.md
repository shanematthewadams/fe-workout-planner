# F3 Q Builder staging release — October 19, 2026

Staging: https://studio-ux-streamline--fe-workout-planner.netlify.app

Shane approved CI/browser verification, the shared database upgrade and staging deployment with “yes run all that.” No production frontend publish or merge to main was authorized or performed.

## Released

F3 Display Name profiles; account settings and first-login prompt; private workout ownership and creator/adaptation metadata; confirmed shared-venue amenities; AO-aware bootcamp/run/ruck planning; route session timing; clearer signup-link versus returning-user code instructions; profile save/loading feedback; and normal guest-import deduplication.

The active branch remains `studio/ux-streamline`. The Git command line lacked write credentials, so the connected GitHub app published the tested source. Uploaded tree hashes were checked against the local tree before moving the branch. Local contents were synchronized only after confirming identical source trees; no work was discarded and no replacement branch was created.

## Source and CI evidence

- Tested application commit: `23a5e6678858fe6ecdd508762360d24b102ed78a`.
- Passed CI: https://github.com/shanematthewadams/fe-workout-planner/actions/runs/39287929432
- Unit/component/API/local database tests: **335 passed across 42 files** in CI.
- Browser tests: **68 passed; 4 optional historical comparisons skipped**, covering desktop, tablet, mobile Chromium and mobile WebKit. Includes profile creation/reload, OTP fixtures, guest import and account isolation, offline recovery, AO venues, keyboard navigation, print/lead flows and axe assertions.
- Lint, TypeScript and production build passed.
- Staging release commit: `0eee6f0ce12b8bc7825e5ff0501e1cf79fd7b8c0`, pointing to the identical tested tree `dd6b72a172836571a113d1e3ad792bfa8b2accc8`.
- The release-only commit skipped duplicate GitHub Actions using `[skip actions]` and triggered Netlify continuous deployment. No tests were bypassed for changed application code.
- This documentation-only follow-up does not trigger another build.

## Hosted database verification

Applied migration `20261019164426_f3_profiles_and_private_attribution` to the existing F3 Supabase project. It created owner-only profile storage and upgraded the existing private-workout validator. Existing vault constraints, guest access model and auth implementation were preserved.

A preflight test against hosted pg_jsonschema showed `format: uuid` was advisory. Explicit UUID patterns were added to all attribution account/creator fields, regenerated, locally tested and checked against the hosted extension before installation. Valid legacy and attributed payloads pass; malformed account/creator IDs and shared visibility fail.

Ran `docs/profile-verification.sql` against the hosted project. It creates synthetic users only inside a transaction and rolls everything back. Verified:

- Owners can create, read and edit their own profile.
- Profile creation timestamps cannot be supplied or changed by the client.
- Cross-account profile reads/updates are denied; cross-account insertion is denied.
- Attributed account workouts can be saved through the real authenticated RPC with the real JSON Schema validator.
- Another account cannot read those workouts.
- Guest profile/table and account RPC access are denied.
- No synthetic account, profile or workout remained after verification.

Pre/post guest and account vault counts and content digests matched. Security advisors returned no warnings. An anonymous REST request for profile names returned HTTP 401.

## Hosted runtime verification

- Staging loads without a Netlify login wall and serves the new profile and route fields.
- A staging build reproduced with the same public configuration produced `/assets/index-DV-lhSXd.js`. Downloaded deployed JavaScript matched the local build byte-for-byte: SHA-256 `1973c94ae7ebb2ec2410d5a1d821f3e1d07858f86e3cc17dc48e869c69e8ea55`.
- Hosted planner request for a no-equipment/no-running Gold Rush partner bootcamp: HTTP 200, **Gemini**, `gemini-3.5-flash-lite`, no template fallback, warmup plus The Thang, 43 physical minutes plus the 2-minute welcome reservation.
- Hosted planner request for a conversational Southstride ruck: HTTP 200, **Gemini**, same model, no template fallback, one 43-minute route section with no mandatory warmup/Mary.
- Hosted auth settings show email signup enabled, confirmation required, and signup not disabled. No real sign-in email was sent during this release.
- Production frontend remained at its existing Netlify published deployment; only staging frontend was released. The approved schema update is shared by both environments.

## Remaining limits

- Real inbox delivery and confirmation redirects were not newly exercised. OTP/session/UI behavior passed synthetic browser tests; that is not a claim of fresh end-to-end email delivery verification.
- F3 Nation directory access still returns HTTP 401 using the existing configured credential. No official AO links/coordinates were invented or imported. The demo uses the existing regional snapshots and verified venue reports.
- Shared/public workout publishing is not implemented.
- Browser phone tests are emulated Chromium/WebKit. Physical-device background audio, wake locks and long-running sessions were not retested on hardware.

The staging link can now be used for the small-group demo. Guest planning works without signup; account/profile use follows the confirmation-link and email-code flow.
