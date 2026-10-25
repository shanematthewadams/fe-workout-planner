# AO database modernization — Sprint 1 handoff

## Scope and verified base

Repository: `shanematthewadams/fe-workout-planner`. Integration branch for this
assignment: `studio/ux-streamline`, per Shane's explicit sprint instruction, overriding
the older develop/mirror guidance in AGENTS.md for this effort. No new branch or repo.
Initial remote and clean checkout: `919d6410b087e117d1b056e7b0487d5c8235fd9d`.
Initial main: `e254c11ec266e62586208cb1282f9eeb8e7b093a`. Re-read every branch before future work.


This sprint creates and executes an additive relational foundation locally. It does
not activate database planning or apply any production database migration. There are
no Supabase development branches on the connected project; no paid project was created.

## Live inspection, read-only

Project `kitqovhdwzkhpxlepvfn`: public `workouts` (36 rows), `beatdowns` (0),
`fe_profiles` (1); RLS enabled on all three. Recorded migrations:
`20261016162220 create_read_only_published_catalog`,
`20261017235300 harden_plan_sync_payload_validation`,
`20261019164426 f3_profiles_and_private_attribution`.

`workouts`: anon/authenticated SELECT only for approved AND published records.
`beatdowns`: existing public SELECT policy; no anonymous writes. Profiles: authenticated
owner SELECT/INSERT/UPDATE using auth.uid(), including WITH CHECK on UPDATE. Preserve
these existing policies. Private `fe_private.fe_plan_vault` and `fe_account_vault`
have RLS; `fe_sync_plans` and `fe_account_plans` public invoker wrappers depend on
private definer implementations. Those RPCs, payload validators, account ownership,
and profile timestamp trigger are untouched. No public view dependencies were found.
No user manuscripts, workout payloads, profile values or auth credentials were read.
Security advisor: pre-existing leaked-password-protection warning only; no catalog
change was run against the live project. This is not a new password-auth project.

Current Supabase RLS/security documentation was checked via search_docs. Changelog
was fetched on October 25, 2026: the relevant upcoming TLS cipher removal on November
10 does not change this additive PostgreSQL/RLS design. Modern HTTPS fetch is used.

## Schema and environment

CLI-created migration: `supabase/migrations/20261025175228_ao_intelligence_foundation.sql`.
Rollback: `supabase/rollback/ao_intelligence_foundation.sql`.

Eleven new public tables: `ao_sources`, `ao_regions`, `ao_sites`, `ao_venues`,
`ao_official_locations`, `ao_venue_assignments`, `ao_nation_defaults`,
`ao_amenity_types`, `ao_venue_amenities`, `ao_landmarks`, `ao_landmark_links`.
All have primary keys, RLS and explicit grants. Relational foreign keys, natural
uniqueness and reverse/source indexes protect relationships. Addresses are source
reports; coordinates remain upstream location pins, never invented venue centroids.
Meeting-point precision is retained without converting descriptions into exact pins.

Migrations and imported data were applied to isolated PGlite PostgreSQL instances,
including actual SQL constraints/RLS/role testing and relational query readback.
This is not hosted Supabase/PostgREST or real Supabase JWT authentication. No live
schema, data, keys or auth settings were changed. Nothing here claims hosted database
integration success. `npm run catalog:ao-verify` rebuilds this isolated environment
and commits reproducible counts/security evidence to `verification.json`.

## Import and reconciliation

Read the actual current Google Sheet using connector metadata and bounded reads of
AO Directory, Amenities and Landmarks. Source snapshots are in `data/ao-intelligence/`;
row 4 was observed as the header, but the importer searches for the AO header instead
of assuming its position. Source capture date is not a site verification date.

`npm run catalog:ao-prepare` writes ignored `qa/ao-intelligence/import.sql` and
`reconciliation.json`; it does not connect to a database. SQL is transactional and
insert-only. Repeats do not duplicate records or overwrite verified local overrides.
Differing existing primary/natural-key records are returned as an explicit conflict
result set; preserve that result when applying. New source rows may be inserted, but
existing facts are never silently replaced. Changed facts require a separately
reviewed reconciliation, not a blind upsert. Conflicting duplicate source records
block CLI preparation. Earlier snapshots and lower-trust defaults cannot overwrite
existing records. Foreign-key errors roll back the whole import.

Source precedence: Nation org/location IDs from the existing Nation snapshot;
regional schedule references and local venue/flag details from the current sheet.
No new upstream geography was guessed. Prose-supported on-site amenities have an
explicit reviewed mapping in the importer, with original row/caveat evidence.
Legacy cells alone never confirm present or absent. The map establishes *reported*
features, not a new on-site inspection. A new feature needs reviewed evidence before
import; after activation an operator may update structured facts without an app build.

Readback counts: 1 region; 16 AOs; 13 physical venues; 16 AO/venue assignments;
15 upstream official locations/default references; 31 amenity types; 403 venue-amenity
rows; 59 landmarks and links. Of amenities, 67 present/reported, 1 restricted/reported,
335 unknown/unverified. No absent value was inferred. Tests separately verify an
explicit reviewed absent record stays distinct from unknown.

`reconciliation.json`: 160 legacy Yes/No defaults downgraded to unknown, 2 differing
shared-venue observation sets retained on their AO assignments, 1 Vagabonds upstream
pin excluded, 1 mobile amenity inventory excluded. No unresolved AO-name mappings,
duplicate record conflicts or address conflicts in this snapshot. Shared venue-level
summary text remains subject to reconciliation; original lighting/access/route/terrain
and local notes are preserved per assignment.

Critical modeling outcomes:

- Airfield and Baywatch share Black Bob Park, keeping northernmost vs southwest flags.
- South Park and South Stride share Heritage Park Marina. South Park has a second
  Brougham assignment; neither season labels nor Nation default pin select a venue.
  Effective dates remain null; Site Q selection is required.
- Stagecoach and The Gathering share a venue with separate flags and landmark links.
- YBF and Overdraft use run defaults, ruck option and nearby-track landmarks; YBF's
  headlamp note is retained. Their unverified bootcamp flags remain unknown.
- Vagabonds has zero venue assignments and no imported permanent amenities.
- Pretty Bird turf is restricted. Garmin garage and Arrowhead Park are nearby
  landmarks; the garage is not a school facility.
- Yippee's elementary playground and Lowe's hill are nearby destinations. Its school
  track/grass/bleachers/lot are reported on-site. No route measurements were invented.
- Goose Poop Island remains unverified despite older local descriptions. Ambiguous
  'at or near' placement is unknown, not forced on-site.

## Read path, application boundary and security

`server/ao-intelligence.ts` provides a validated relational reader and explicit venue
selection. It caches successful reads for 60 seconds, coalesces in-flight reads and
bounds the cache to 128 records; failures are not cached. It uses only an explicitly
configured publishable key, never service_role, secret keys or profile metadata.

New Netlify GET `/api/ao-intelligence?ao=fe-ao-pretty-bird` (optional `venue`)
returns a `source` marker and structured context. `source=database` uses the new
catalog; `source=json` explicitly identifies fallback. The two context shapes are
intentionally not a drop-in planner input yet: no UI/generator consumes the new
endpoint this sprint. Existing generation and Q controls continue using the tested
JSON contract, including closure and temporary override precedence.

Runtime settings: `AO_CATALOG_ENABLED=true`, `AO_CATALOG_URL`,
`AO_CATALOG_PUBLISHABLE_KEY`, scoped to an authorized isolated staging environment.
These are not configured in this sprint because none exists. Production context is
hard-disabled in the function. No shared production migration is necessary to deploy
the endpoint. Database outage, schema mismatch and disabled mode preserve JSON fallback.
Public requests have a 60/minute/IP Netlify limit. Response bodies use no-store.

All new tables: public catalog SELECT for anon/authenticated, no client mutation
grants or write policies. Database operators/service_role only write; service_role
has an explicit policy for tests without assuming BYPASSRLS. No admin grant comes
from fe_profiles or user_metadata. No privileged functions or views were introduced.
RLS tests run both client roles and verify mutation denial for every new table,
operator writes, FK rejection and invalid availability rejection.

## Verification and next milestone

See release evidence appended after integration. Tests cover schema/import readback,
repeat safety, preservation/conflict reporting, shared flags, manual seasonal choice,
mobile AO, nearby facilities, restricted turf, cache/coalescing, malformed/network
fallback, invalid inventory, RLS and rollback/reapply. Existing profile upgrade test
now applies this migration before testing saved vault contents, attribution and
owner-only RPC behavior. PGlite's existing pg_jsonschema shim is unchanged; generated
payload-schema parity tests continue to run separately.

Next milestone: validate this exact migration/seed and nested REST relation read on
an authorized isolated hosted Supabase project, reconcile the two shared summaries,
then adapter-test planner context parity (including Q overrides and closures) before
switching any generation source. Exicon implementation proposal:
`EXICON_SPRINT_PROPOSAL.md`. Do not import the official Exicon before rights review.

## Production release and rollback procedure — requires Shane's approval

1. Refresh remote state and live schema/migration list; do not use this snapshot as
   proof nothing changed. Re-run lint/build/tests and offline preparation/verification.
2. Validate in isolated hosted Supabase first, including actual anon/authenticated
   REST read/write denial and nested relationships. Do not point staging writes at prod.
3. Before approved production writes, take and verify a restorable Supabase backup
   or operator-controlled pg_dump covering public, fe_private, auth and migration
   history. Record backup ID/time and row counts without publishing personal data.
   Preserve the current git SHA and existing app settings. No backup was taken this
   sprint because no production mutation was attempted.
4. The repository does not contain the three historical migration SQL files in the
   CLI migrations folder. Reconcile migration history with the server first; **do not
   blindly run db push/reset or repair migration history**. Apply only the reviewed
   additive migration through the authorized operator workflow and record its version.
5. Apply prepared import SQL once as an operator; capture its conflict result set,
   compare all counts, inspect unresolved rows and test RLS/read access again. Do not
   treat a successful DDL transaction alone as application verification.
6. App activation is a separate approved release after parity testing; never enable
   database context in production just by promoting this branch.
7. To disable the new read path, turn off AO_CATALOG_ENABLED (production already
   forced off). Existing JSON behavior continues. For a bad app release, revert its
   commit and deploy the fix forward after required production approval.
8. If schema removal is needed, export all catalog edits first, then run the reviewed
   rollback SQL transaction. No CASCADE: new downstream dependencies must block removal.
   Existing user/source workout/profile/private vault tables are not dropped. Remove
   the migration history entry only through the approved operator's migration repair
   process after verifying rollback. Keep the export and previous backup restorable.

## Local release checks

- Full suite: **422 tests passed in 55 files**. After the final uniqueness constraint,
  the affected database/profile tests were rerun: **7 passed**.
- `npm run lint`, TypeScript and `npm run build`: passed. Existing large-chunk warning
  remains; no frontend feature or navigation change was made.
- `npm run catalog:ao-prepare` and `npm run catalog:ao-verify`: passed. The latter
  executed the exact migration, all imported rows, relational count/security queries
  and a second zero-conflict import in PostgreSQL.
- This migration was applied inside the real existing profile/vault upgrade test;
  saved workouts, private account ownership and profile attribution remained valid.
- Hosted release evidence will be recorded after the code push; no hosted database
  claim is implied by these local checks.
