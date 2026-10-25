# AO planning integration — October 25, 2026

Integration branch: `studio/ux-streamline`, continuing the explicit sprint instruction.
Verified clean remote base before implementation:
`f6e539322092df57ed2e51a6dfa2a8f93bd78cd3`.
Main/production remain `e254c11ec266e62586208cb1282f9eeb8e7b093a`.

## Implemented

The server now resolves a trusted AO catalog baseline once per planner request.
The same resolved context feeds exercise eligibility, the AI prompt, generated-plan
facility validation and the saved plan's site summary. Template recovery reuses that
context; it cannot fall back to different bundled facts after a provider failure.
Client request JSON cannot supply the trusted baseline. Existing request/workout/
backup/auth/profile formats remain unchanged.

`siteContext` accepts an optional trusted server baseline while retaining its existing
Q override and text-closure logic. Successful database reads replace bundled facts;
unknown or absent database fields do not inherit old JSON confirmations. Database
outage, malformed data, missing configuration and a disabled switch preserve the
original JSON baseline. Successful reads retain the 60-second bounded/coalesced cache.

The adapter maps canonical amenity types to the existing planner feature contract.
Restricted is not usable. Aggregate absence requires every facility alternative to
be absent/restricted; otherwise incomplete alternatives remain unknown. Lighting and
surface prose do not invent normalized lighting/surface facts. Nearby garage/track/
playground landmarks do not become on-site amenities. Gathering-only indoor landmarks
do not grant workout access. Only reported/reviewed on-site workout landmarks for
the selected venue enter the planner context.

South Park accepts the existing UI's `heritage-marina` ID as an explicit choice of
catalog `heritage-park-marina`; dates never choose a venue. Its unselected venue
has no baseline facilities or venue-specific landmarks. Vagabonds remains mobile
with no permanent facility baseline. Shared venues keep separate AO flag descriptions.
AO activity/planning conventions enter verified context as defaults; explicit Q
activity/route/pace settings remain authoritative and are not silently rewritten.

The browser AO panels still use bundled data. This bounded change integrates the
server generation/safety/saved-summary path; it is not a complete dynamic AO UI rollout.
No Exicon import, provider-policy change or exercise-engine rewrite was added.

## Environment and safety

Both deployed functions share `catalogEnvironment`:

- Production deploy context always disables AO catalog use.
- The production Supabase host `kitqovhdwzkhpxlepvfn.supabase.co` is rejected as a
  catalog target even from staging/dev.
- Only an isolated `AO_CATALOG_URL` and `sb_publishable_` key may enable this path;
  no service/secret credential is accepted or exposed in a client bundle.
- Required runtime variables: `AO_CATALOG_ENABLED=true`, `AO_CATALOG_URL`, and
  `AO_CATALOG_PUBLISHABLE_KEY`. Scope to isolated branch-deploy Functions runtime.
- Vite uses the same environment gate and planner handler, not a second generator.
- `X-F3-AO-Source` on successful planner responses identifies database vs JSON without
  changing the persisted workout contract. No extra AI calls retrieve stored facts.

Live production schema/policies/migration history were reinspected read-only and
remain the three public tables, private vaults and three recorded migrations from
Sprint 1. No production database writes, migrations, account creation or app publish.
No new migration was necessary for this adapter.

## Hosted setup blocker — do not misreport completion

No isolated F3 project or development branch exists. Supabase `create_branch` for
`ao-staging` on project `kitqovhdwzkhpxlepvfn` was attempted twice through its built-in
cost/approval flow. Both attempts failed with:
`McpServerError: Invalid or expired requestState` / `invalid_request_state`.
A subsequent list_branches read still returned an empty list. No branch creation,
cost approval, billable resource or migration is claimed. Do not retry indefinitely
or substitute production for the missing isolated environment.

All preparation that can proceed without infrastructure is complete. Hosted database
activation remains pending the working Supabase branch setup/cost approval flow or
an explicitly supplied isolated environment. Local PostgreSQL verification is not
proof of hosted PostgREST or real JWT access behavior.

## Verification

- Lint, TypeScript and production build passed.
- Full suite: **432 tests passed in 56 files**.
- Ten new adapter/planner integration tests verify database-vs-JSON precedence,
  prompt eligibility, server validation, persisted summaries and v1 backup compatibility;
  Q edits/closures; aggregate unknown/restricted facilities; shared flags; explicit
  seasonal choices and legacy UI venue alias; mobile AO; route/Q conventions;
  request coalescing/outage fallback; AI prompt context parity; template recovery
  using one catalog read; rejected client baseline injection; and production guards.
- Existing relational database tests now include source provenance in their actual
  SQL relation projection, matching the extended REST selection.
- `catalog:ao-verify` still confirms 16 AOs, 13 venues, 59 landmarks, 403 amenity
  records, zero repeat-import conflicts and the existing RLS/relationship checks.
- Initial test development exposed an incomplete backup fixture (missing exportedAt
  and favorites); fixture corrected, complete suite rerun and passed. No product
  backup format change was made.

## Concrete hosted probe and continuation

`npm run catalog:ao-hosted` builds/runs `scripts/verify-ao-hosted.ts`. It refuses the
production project and mismatched project URL/ref. Supply only the approved isolated
`AO_CATALOG_REF`, URL and publishable key. An optional `AO_TEST_ACCESS_TOKEN` must
belong to a disposable user in that isolated project. It is never printed or saved.
Without that token the script records authenticated coverage as pending and exits 2;
it cannot claim full success from anonymous checks alone.

The probe verifies catalog row counts for all eleven tables; denied duplicate INSERT,
same-value PATCH and zero-match DELETE for each role; nested PostgREST relationships;
shared flags, seasonal choice/legacy alias, nearby facilities and mobile AO. Mutations
are shaped to avoid altering real facts even if write protection is misconfigured.
Read failure, wrong counts or unexpected write acceptance fail the probe. Result goes
to ignored `qa/ao-hosted/verification.json` without credentials. The hosted probe is
prepared and built, but has **not** run successfully against a hosted catalog.

Next steps, in order:

1. Repair/complete the Supabase branch provisioning/cost confirmation. Verify its ref
   belongs to this parent and is not production. Do not copy production user data.
2. Inspect the branch's inherited schema/history, apply only the tested additive
   migration from Sprint 1, prepare/import its locked inventory and capture conflicts.
3. Run `catalog:ao-hosted` with anon and a genuine isolated synthetic-user token.
   Run branch advisors and inspect exact rows/relationships after import.
4. Configure the three catalog variables for staging Functions only and deploy.
   Verify the deployed SHA and `X-F3-AO-Source=database`; test database-driven absence
   plus closures, seasonal choice, offline recovery and save/lead with synthetic plans.
5. Until those checks pass, keep the switch off. The staging release verifies the
   integrated application with JSON fallback, not hosted database-backed planning.
6. Preserve the existing UI/JSON venue behavior until a bounded live AO panel adapter
   is tested. Then proceed to the Exicon proposal from Sprint 1.

Rollback: turn off AO_CATALOG_ENABLED and redeploy staging; JSON remains supported.
Revert this adapter commit if necessary. There is no new database schema to roll back.
Any production activation/migration/publish still requires Shane's explicit approval;
retain Sprint 1 backup/rollback procedures for that future release.

## Staging release evidence

Implementation: `7d7de646e01d56b5d2ae84b760813a066da35f6f`; tree
`9ce517babba9ed5695835c6d492f0f940351729f` matches the tested local implementation.
Pushed with an expected-head lease; no force push or new repository/branch.

Hosted build-info confirms that exact SHA and staging environment. All 16 AO GET
requests returned HTTP 200 and source=json, as expected with the catalog switch off.
The deployed `/assets/index-CpEWZuhw.js` matches a local build with the same public
staging configuration byte-for-byte: SHA-256
`9f91bb7c786abeb36585874a7971b35e0b7c3b6358883d10ce7382155810ce39`.
Production build-info still reported `e254c11ec266e62586208cb1282f9eeb8e7b093a`.

Fresh CI run https://github.com/shanematthewadams/fe-workout-planner/actions/runs/40243991678
passed dependency installation, lint, the full unit/integration suite, build,
the desktop/tablet/mobile browser matrix and the hosted staging journey.
The existing free-provider evaluation is separate evidence; none of these database
integration checks adds AI calls for fact retrieval. Its outcome is recorded below
when the run completes. The browser checks use synthetic service fixtures, not
production account/plan writes.

The hosted probe also compiled successfully for Node 22 and rejected a production
URL/ref fixture before any network access. That guard test is not hosted RLS coverage.
Final evidence-only commits skip CI/Netlify to keep this verified application release
in place; the staging branch HEAD may therefore be newer than build-info.

Final run outcome: **success**. Unit/integration: **432 passed / 56 files**.
Browser matrix: **128 passed, 4 skipped**. Hosted journey: passed.
The optional free-AI probe warned: coupon-partners, unknown-seasonal-venue and
individual-core-rain each timed out and returned the explicit Template fallback;
targeted-refinement was skipped because there was no validated AI draft to refine.
The downloaded CI report confirms timeout reasons (approximately 15–19 seconds),
not a successful live AI run. No new provider call was made to retry this warning.
Keep provider timeout reliability as a separate follow-up; don't mislabel template
recovery as provider success or expand this bounded database integration into a
provider rewrite.

Remaining release gate: **no hosted catalog migration/import, authenticated REST
verification or catalog activation has occurred**, because isolated branch
provisioning failed before completion. This sprint delivered tested integration
code, a verified staging fallback release and a concrete hosted verification tool.
The database-backed staging milestone is still pending the infrastructure gate.
