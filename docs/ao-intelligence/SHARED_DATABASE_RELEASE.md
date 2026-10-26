# Shared AO catalog release — October 25, 2026

## Authorization and scope

Shane explicitly approved using the existing production Supabase database:
“Just use the existing prod database.” This supersedes the earlier requirement to
provision an isolated hosted catalog. No new project or database branch was created.
Production application publication is still a separate approval: main and q.f3thefe.com
remain at `e254c11ec266e62586208cb1282f9eeb8e7b093a`.

Repository integration base: `92bd20f2fcbb607ae4b8c8f599b3fb1b79f2212c`, verified
against remote before changes. Branch: `studio/ux-streamline`.

## Applied database work

Project: `kitqovhdwzkhpxlepvfn` (F3 Workout Planner).
Existing tables/policies, private vaults and migration history were rechecked first.

1. Created an operator-only logical data/metadata snapshot in
   `fe_ao_preflight_backup`. Source SQL:
   `supabase/migrations/20261025233626_snapshot_before_ao_catalog.sql`.
   Remote migration: `20261025233847 snapshot_before_ao_catalog`.
2. Applied the unchanged, tested additive AO schema:
   `supabase/migrations/20261025175228_ao_intelligence_foundation.sql`.
   Remote migration: `20261025233852 ao_intelligence_foundation`.
3. Ran the prepared transactional insert-only inventory import twice. Both runs
   returned an empty conflict result set. No duplicates, blind updates or source
   downgrades were performed.

MCP assigns live migration timestamps, so local preparation filenames differ from
those two recorded remote versions. The repository's three historical migrations
also remain in docs rather than the CLI migrations directory. Do not blindly db push,
reset or repair migration history; inspect the recorded names/bodies before future work.

## Snapshot and existing-data preservation

Snapshot captured at `2026-10-25T23:38:47.290083Z`:

| Existing table | Rows | Post-import checksum comparison |
| --- | ---: | --- |
| public.workouts | 36 | Identical |
| public.beatdowns | 0 | Identical |
| public.fe_profiles | 1 | Identical |
| fe_private.fe_plan_vault | 19 | Identical |
| fe_private.fe_account_vault | 0 | Identical |

No existing plan/profile/account/vault contents were exported into tool output,
source control or a public artifact. Data copies stay inside the database under
`fe_ao_preflight_backup`; its manifest holds counts/checksums, and definitions retains
columns, constraints, policies, grants, indexes, function definitions and triggers.
All seven backup tables have RLS enabled. anon, authenticated and service_role have
no schema USAGE or table access. Only the database operator/owner can read the snapshot.

This is a logical application-data snapshot on the same database, not an independent
disaster-recovery backup or a copy of managed auth credentials. Auth users, passwords,
sessions and existing RPC/policy definitions were not changed. For this additive
rollout, rollback removes only the new catalog; source user tables remain untouched.
Do not restore the snapshot over legitimate later user edits automatically.

`supabase/verification/ao_existing_data.sql` reproduces the checksum/count comparison
without printing private data. `tests/ao-backup.test.ts` verifies copying, original
row/grant preservation, RLS and denied backup access for all client/service roles.

## Actual catalog contents

| Records | Count |
| --- | ---: |
| Sources | 2 |
| Regions | 1 |
| AOs | 16 |
| Physical venues | 13 |
| AO/venue assignments | 16 |
| Official locations / Nation default references | 15 / 15 |
| Amenity types | 31 |
| Venue amenities | 403 |
| Landmarks / AO landmark links | 59 / 59 |

Amenities: 67 present/reported, 1 restricted/reported, 335 unknown/unverified.
No legacy No was promoted into confirmed absence. Airfield and Baywatch share
Black Bob Park with different flags. South Park remains explicitly selected,
Vagabonds has zero permanent venue assignments, and nearby facilities stay separate.
The Sprint 1 reconciliation decisions and source snapshots are unchanged.

## Live security/API verification

- Anonymous PostgREST reads passed for all eleven catalog tables with exact counts.
- Duplicate INSERT, same-value PATCH and zero-match DELETE probes were denied for
  every table (401/403). They do not modify catalog facts even if protection fails.
- Nested PostgREST joins passed using the actual `createAOReader`, including source
  provenance, venue amenities and landmark links.
- Live planning adapter checks passed for shared venue/separate flags, explicit
  South Park choice including the old UI alias, Pretty Bird's nearby garage, and
  Vagabonds' mobile behavior.
- A read-only SQL transaction executed as the actual `authenticated` database role:
  AO/venue/landmark reads succeeded, INSERT/UPDATE/DELETE grants were false on every
  catalog table, and backup access was false. Reusable query:
  `supabase/verification/ao_authenticated_access.sql`.
- The initial zero-row SQL mutation probe hit the connector's expired requestState
  error. The successful read-only role/grant verification replaced that probe; no
  destructive operation was retried through another route.
- No real signed-in user's JWT was borrowed and no synthetic auth account was added
  to production. The hosted script correctly reports authenticated HTTP/JWT coverage
  as pending (exit 2); it does not claim that SQL-role verification is an HTTP login.
  This is a public, client-read-only catalog with no JWT/profile-based admin policy.

The hosted probe now permits this exact shared target only when its operator sets
`AO_CATALOG_ALLOW_SHARED=true`, matching Shane's approval. Other URL/ref mismatches
still fail. Test tokens, if ever supplied, are never logged or saved.

Advisors found no new exposed-catalog RLS problem. Expected informational notices:
[backup tables have RLS with no client policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy),
[frozen snapshot copies have no PK](https://supabase.com/docs/guides/database/database-linter?lint=0004_no_primary_key),
and [new indexes have little usage history](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).
These snapshots intentionally have no client access/workload. The pre-existing
[leaked-password protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
remains; authentication settings were not changed for this catalog rollout.

## Staging connection and production boundary

`catalogEnvironment` now allows the explicitly approved shared database for branch
deploys and local dev when configured. Production app and deploy-preview contexts
remain disabled. The Netlify connector reported success for three branch-deploy
Functions variables, but subsequent readback contained none of the AO variables.
Do not treat those upsert acknowledgements as proof of persisted configuration.
Instead, `BRANCH_CATALOG` in server/ao-intelligence.ts versions the already-public
project URL and publishable key with a branch-deploy-only enable default. This is
the same public connection already shipped in netlify.toml, never a service/secret
key. Runtime AO_CATALOG_ENABLED / URL / PUBLISHABLE_KEY overrides remain supported.
Local dev defaults off; production and deploy-preview contexts stay hard-disabled.

The server still uses one context for prompt eligibility, validation, template
recovery and saved summaries. Database failure retains the JSON fallback. Browser
AO information panels still use bundled data; a dynamic panel adapter is a separate
bounded UI milestone. The backend now can consume structured catalog updates without
an app redeploy after the 60-second read cache expires.

## Tests and rollback

Local lint/build passed. Full suite: **433 tests in 57 files passed**, including
17 targeted catalog/adapter/snapshot tests. Hosted staging release/CI evidence follows
once this connection change is deployed.

To disable staging catalog reads, set BRANCH_CATALOG.enabled to "false" in the
versioned server configuration and deploy staging. A verified runtime
AO_CATALOG_ENABLED=false override also works once environment persistence is available. Keep the tables/data intact while investigating.
If schema removal is needed, first export any newer catalog edits, then use the
Sprint 1 rollback SQL without CASCADE. It does not drop user tables or the private
snapshot. If the snapshot itself is ever retired, obtain an operator-controlled
export/independent backup first and explicitly review its removal; do not auto-drop it.

The next database sprint can follow the Exicon proposal after the shared staging
read path is verified. Provider timeouts remain a separate reliability follow-up;
no provider policy or credential change is part of this database release.

## Verified deployed release

Application commit: `403e6142dc904a2299928e1f06c7c311cf3186f4` on studio/ux-streamline.
Tree: `f9b5f13ef5def84e7137a26a984984b0da7ce284`, identical to the tested local tree.
Hosted build-info confirms that exact commit and staging environment.
All **16 hosted AO reads returned source=database**, not JSON fallback.
Hosted checks passed for Airfield/Baywatch venue identity and separate meeting points;
South Park's unselected state and explicit Heritage choice using the legacy UI ID;
Vagabonds' rotating/no-venue state; Pretty Bird's restricted turf and off-site garage.

`/assets/index-CpEWZuhw.js` matches the local staging build byte-for-byte, SHA-256
`9f91bb7c786abeb36585874a7971b35e0b7c3b6358883d10ce7382155810ce39`.
Production app build-info remains `e254c11ec266e62586208cb1282f9eeb8e7b093a`.

A live POST to the staging planner returned HTTP 200 with
`X-F3-AO-Source=database`. Gemini generated a personal schema-version-1 workout in
approximately 8.9 seconds, with Baywatch's Southwest parking-lot meeting point in
the returned workout summary and exactly 43 physical minutes plus the reserved
2-minute welcome. It was an AI result, not template recovery. This API-only probe
created no account, saved-plan vault or published workout record.
An earlier direct probe received a non-JSON HTML response; GET/invalid POST route
checks then returned the expected JSON 405/400, and the subsequent live AI probe
passed. Do not turn that one successful probe into a claim of universal provider reliability.

Fresh CI: https://github.com/shanematthewadams/fe-workout-planner/actions/runs/40246436766 .
Dependency install, lint, build, **433 tests / 57 files**, **128 browser tests passed
with 4 skipped**, and hosted staging journey all passed.
The optional free-AI evaluation warned: coupon-partners and unknown-seasonal-venue
completed with AI; individual-core-rain used template recovery; targeted-refinement
returned HTTP 504. Keep that reliability follow-up separate from this catalog release.

The existing-data checksum verification was repeated after the staged planner tests:
all five source tables still matched their preflight snapshots exactly, with the
same counts. Backup access stayed denied to anon, authenticated and service_role.
Evidence-only follow-up commits skip CI/Netlify; deployed application commit remains
403e614 while branch HEAD may be newer.

This resolves the hosted provisioning blocker for the chosen shared-database approach.
The next bounded work can implement Exicon's licensed/approved exercise catalog and
regional vocabulary foundation, or update the remaining bundled AO information panel.
No further Supabase branch provisioning is required for this architecture.
