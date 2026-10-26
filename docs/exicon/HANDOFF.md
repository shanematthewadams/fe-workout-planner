# Exicon foundation handoff · October 26, 2026

## Verified starting point and scope

Repository `shanematthewadams/fe-workout-planner`, integration branch `studio/ux-streamline`, verified base `6bfbee4240e2251465f90385f9068a8b19c58743`. Production application/main remains `e254c11ec266e62586208cb1282f9eeb8e7b093a`. Shane authorized use of the existing shared Supabase database and routine staging deploys. No new environment, paid service, credentials or application was created.

This is the first bounded Exicon implementation milestone, following the AO sprint. It implements the normalized catalog, safe import preparation, publication/permission controls and deterministic identity resolution. It does not replace the working movement selector, import official Exicon text, or rewrite the exercise engine. The existing fifty movement objects are unchanged; their ordered JSON SHA-256 is `b687db245d5dce69512911cf7a777c29d9b010273b7ea8da714748727eca9ba2`, verified against the starting commit and guarded by a regression test.

## Schema and deployment

Local migration: `supabase/migrations/20261026015007_exicon_foundation.sql`, created with Supabase CLI 2.122.0. Applied successfully to the already-authorized shared project `kitqovhdwzkhpxlepvfn`, recorded remotely as **`20261026104239 exicon_foundation`**. The connector assigns the remote version; do not blindly push/reset/repair CLI migration history. Prior AO local/remote version mappings remain in the AO handoff.

Twelve additive public tables:

- `ex_source_licenses`: provenance via `ao_sources`; explicit redistribution decision and review date.
- `ex_exercises`: stable canonical IDs, app instructions, category, running flag and alternative.
- `ex_variations`: actual changes in mechanics, optional region and explicit inherit/replace modes for equipment/facilities.
- `ex_aliases`: scoped names, generated normalized lookup value and composite variation/exercise FK.
- `ex_counting_conventions`: scoped cycle descriptions and counting method; `unknown` is supported, cadence requires a completion count.
- `ex_equipment_types`, `ex_exercise_equipment`, `ex_exercise_facilities`, `ex_variation_equipment`, `ex_variation_facilities`: normalized requirements with AO amenity FKs.
- `ex_formats`, `ex_format_parameters`: app-written 11s/ladder definitions with typed parameters and bounds. These are vocabulary, not a workout execution engine.

All FKs have leading indexes. Name alone is not identity. Alias collisions across canonical exercises remain legal and resolve as ambiguity; duplicate aliases for the same target/scope are rejected. Variation aliases must point at the matching canonical exercise and published region. Optional region NULL means global. The empty identifier sentinel cannot be a real ID.

## Imported content and provenance

The eight descriptions explicitly added by the application in `f892bb3` were separated into `src/app-movements.ts` without editing their values/order. Only these app-written descriptions were imported. Their source points to the original file/commit; it is an internal project-authorship decision, **not a license claim about F3 Nation or the bundled reference**. Two new format descriptions were written in this implementation and have their own source/permission record pointing to `scripts/exicon-catalog.ts`; this handoff records the release commit for that branch URL.

Counts after import/reconciliation:

| Table | Rows |
| --- | ---: |
| ex_source_licenses | 2 |
| ex_exercises | 8 |
| ex_variations | 0 |
| ex_aliases | 15 |
| ex_counting_conventions | 8 |
| ex_equipment_types | 2 |
| ex_exercise_equipment | 3 |
| ex_exercise_facilities | 2 |
| ex_variation_equipment | 0 |
| ex_variation_facilities | 0 |
| ex_formats | 2 |
| ex_format_parameters | 12 |

Two `ao_sources` provenance records were added; original AO records were retained. No actual regional variations/counting overrides were invented. Four counting records are explicit `unknown`; the original explanatory prose remains available for Q confirmation. Source review and all **42 withheld bundled entries** are recorded in [source-review.json](source-review.json). Establish their provenance/redistribution permission before expanding the import; their continued presence in application fallback does not establish a database redistribution license.

The initial format seed shared the exercise provenance record. Final source reconciliation deliberately split the two newly authored format definitions into their own source. The importer reported both source conflicts and preserved them; an explicit operator correction changed only the two new format records, guarded by expected source, revision 1 and unprotected status. The subsequent import reported zero conflicts. This is recorded so source corrections are never disguised as silent import behavior.

## Tooling and resolver

`npm run catalog:exicon-prepare` writes validated catalog JSON, transaction SQL and a source review to ignored `qa/exicon/`. It never connects to a database or calls AI. SQL imports use known table/column definitions, escaped values, bounded transaction timeouts and stable keys; they never delete. Revision increases can update only unprotected records from the same source. Older/equal conflicting revisions, protected edits and different sources are retained and reported. Source permissions and requirement/parameter junction decisions are insert-only; removals/changed requirements need explicit reconciliation. Duplicate keys/malformed input fail validation; FK/unique/permission failures roll back the transaction. A revoked license is never restored by import.

`src/exicon-catalog.ts` validates the relational contract and resolves exact identities/names and regional/global aliases without network or AI. Explicit variation selection is checked against the canonical parent and region. Alias selection alone does not change mechanics. Regional counting takes precedence, multiple/unknown rules require confirmation, and replace-mode variations can explicitly remove gear/facilities. The current planner still consumes `src/movements.ts`; activating this resolver in generation is the next milestone, not an implicit side effect of database availability.

`npm run catalog:exicon-hosted` verifies actual REST contents of all twelve tables with a publishable key and tests denied public POST/PATCH/DELETE. Shared project targeting requires `AO_CATALOG_ALLOW_SHARED=true`; pass the existing public URL/key through `AO_CATALOG_URL` and `AO_CATALOG_PUBLISHABLE_KEY`. It does not borrow a user's session. Mutation probes use duplicate inserts or empty bodies, and zero-match updates/deletes; a successful mutation is never accepted as a passing result.

## Security and compatibility evidence

Every exposed Exicon table has RLS plus explicit grants. Anonymous/authenticated users can read only published content whose source permission and entire parent chain are visible. A publication trigger runs as invoker with an empty search path and refuses unlicensed publications. It cannot be executed by browser roles. Permission revocation immediately hides dependent exercises, aliases, counts, requirements and formats through RLS. Catalog writes are operator/service-role only, with no authorization based on editable profiles or user metadata.

Live public REST checks matched every expected field in all twelve tables and denied all 36 anonymous mutation probes. Live `authenticated` SQL role reads returned 8 exercises, 15 aliases, 8 counting rows and 2 formats, with zero writable Exicon tables. A real authenticated HTTP JWT was not obtained; role-level policy verification is distinct from token/session transport coverage. Local PGlite tests exercise both roles, revoked/draft parent chains, cross-parent and cross-region variation errors, duplicate aliases, unknown counting, protected/stale/source conflicts, idempotence and rollback/reapply.

Before/after checksums matched for all original app stores: workouts 36, beatdowns 0, profiles 1, guest vaults 19 and account vaults 0. No auth accounts, profile values, existing workouts or saved-plan ownership were changed. AO catalog counts remain 16 AOs, 13 venues, 403 amenity facts and 59 landmarks. Existing operator-only `fe_ao_preflight_backup` remains inaccessible to anonymous/authenticated users; it is a logical same-project snapshot, not independent disaster recovery or an auth backup.

Security advisors before/after show the same existing findings: seven deliberately policy-free private backup tables (RLS denies all and schema access is revoked), and disabled leaked-password protection in existing Auth configuration. No new exposed-table/RLS issue was reported. References: [RLS policy advisory](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [password protection advisory](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Auth configuration was not changed in this milestone. Current Supabase RLS docs and changelog were checked; the announced old TLS cipher retirement affects legacy clients, not this schema design.

## Rollback and production boundary

The migration is transactional. Before any future destructive rollback, export all Exicon rows and the two source records and inspect dependencies. `supabase/rollback/exicon_foundation.sql` drops only the twelve Exicon tables and invoker trigger function, in FK-safe order, without CASCADE. It was applied/reapplied in isolated PGlite and preserved existing workouts/profiles/AO sentinels. It deliberately retains the two AO provenance records; do not delete shared source records automatically. Never restore the old app snapshot over legitimate later user saves.

No production application deployment or main merge is authorized by this work. The new catalog is publicly read-only database infrastructure; the application selector and planner remain unchanged. An app rollback can redeploy the prior staging application independently of these additive tables. Do not run a database rollback just to reverse a frontend deploy. The prior live AI HTTP 504 remains a separately recorded provider-reliability issue; a template is never proof of provider success.

## Historical next milestone (now implemented)

The [read-path continuation](READ_PATH_HANDOFF.md) now implements the following original milestone. Implement a bounded, cached, validated staging read adapter that turns the published Exicon subset into the existing `Movement` contract while retaining all fifty current movements as fallback. Add parity tests for equipment/facility filtering, regional alias ambiguity, counting confirmation, explicit variation requirements and outage behavior before activating it. Establish source permissions for the 42 withheld records separately; do not bulk import them. No extra AI call should retrieve known exercise facts.

Final local/CI/deployed release evidence is recorded below.


## Local verification and AI-call boundary

Final local lint, build and TypeScript checks pass, including strict compilation of the operator scripts. All **454 tests in 59 files pass**, with eleven targeted Exicon tests. All fifty existing movement objects match the original parity hash above. Final hosted REST verification matches all fields in all twelve tables after source reconciliation; all 36 anonymous mutation probes are denied. The checked-in [live-verification.json](live-verification.json) contains only public catalog counts/results, never credentials or user data. [exicon_access.sql](../../supabase/verification/exicon_access.sql) repeats the authenticated SQL role/grant check. Anonymous/authenticated roles cannot execute the publication trigger function; operator execution is allowed.

Live provider CI evaluation is now **opt-in**, using workflow dispatch `live_ai=true` on staging or a `[verify ai]` commit marker. Database-only and documentation changes no longer spend provider requests on every push. Unit/provider fixtures, the four-browser suite and the AI-free hosted staging journey still run normally. Request a real provider evaluation for changes to provider routing, generation or prompts; skipping it is not evidence of provider health. No provider logic, credentials or free-only policy changed.


## Staging release identity

Implementation commit `d65cb4b1e3513ec608ebead30ef668aac2a2bc95`, tree `139ae97ccc783d3a3350dc4bd88bba938c8c540e`. Hosted staging `build-info.json` reports this exact commit and `staging`. Hosted `/assets/index-DIrvt0O-.js` matches the configured local staging build byte-for-byte; SHA-256 `8cef5e4b79a805e2ba83ce52d92786568ab4e3f56d5a4d1211bf0c96b56ea381`.

The exact format source version is [exicon-catalog.ts at the implementation commit](https://github.com/shanematthewadams/fe-workout-planner/blob/d65cb4b1e3513ec608ebead30ef668aac2a2bc95/scripts/exicon-catalog.ts). The prior staging application at `c08d09121c7bd514744140e49aaf9b1544d6cd64` can be redeployed independently of the new additive tables. Keep the Exicon data during an app-only rollback; the existing planner does not depend on these tables yet.

[Checks run 40310517702](https://github.com/shanematthewadams/fe-workout-planner/actions/runs/40310517702) passed lint, all 454 tests and build. The browser/hosted results below complete the release verification.


## Final release evidence and stopping point

The completed Checks run above passes **454 tests / 59 files**, lint, build, and **132 browser tests** across desktop, tablet, Chromium mobile and Safari mobile in 6.2 minutes. Four pre-existing optional historical-before comparisons are skipped. The live-provider step is skipped as intended; this milestone spent no provider requests through CI. This is not a new provider-health claim.

Hosted desktop Chromium and mobile WebKit verify the exact deployed commit, live AO read, saved identity, edit/undo, print/reopen/Lead, My Workouts, COT and 43:45 timer recovery, with no page errors or horizontal overflow. Hosted structured Weinke recovery and start-fresh preservation also pass without AI. Cloud/auth/provider writes in these journeys remain intercepted synthetic fixtures; real user records were not used for testing. The `browser-qa` artifact is `12645311084` on the linked run, retained by GitHub for fourteen days; durable test totals and operational context remain in this repository after artifact expiry.

Completed: additive live schema, repeatable guarded imports, the app-owned seed and source reconciliation, deterministic resolver, SQL/REST security verification, existing movement/workout/profile compatibility, verified staging deployment, rollback procedure and durable next milestone. Pending: cached staging Exicon reader/adapter and explicit integration with generation, permission decisions for the 42 withheld descriptions, and authenticated HTTP transport coverage if a dedicated synthetic account/session is later supplied. No need to borrow a real user's token or create an account for this milestone. Production application release remains a separate approval; the production app/main was not changed.

The final evidence commit edits documentation only and skips another identical deploy/check run. Next engineering work should start at the read-adapter milestone above and inspect the latest remote branch before editing.
