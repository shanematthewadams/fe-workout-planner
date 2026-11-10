# Reviewed Exicon planning integration · November 10, 2026

## Outcome and bounded scope

Continues `studio/ux-streamline` from verified remote `c463ffafc2b00089b48564c34755a220e709da50`; main remained `e254c11ec266e62586208cb1282f9eeb8e7b093a`. Existing local checkout was clean; refreshed both remote refs before editing. Shane authorized this continuation and additive catalog work in existing shared Supabase project `kitqovhdwzkhpxlepvfn`. His November 4 reuse decision remains the applicable internal publication basis; no upstream license/response is newly asserted and no upstream contact is required to resume.

The generation read now contains **50 published canonical movements**, with the current app instructions, counting guidance, running flags, equipment, facilities and alternatives preserved. Forty-two existing bundled records were added; the original eight database records and their source decisions remain unchanged. The fifty bundled objects remain byte-for-byte unchanged at runtime; `src/movements.ts` only gains an optional reference type field. The live catalog adds 89 aliases, for **104 total**, and 42 counting rows, for **50 total**. Unknown counting remains explicit; no default four-count completion is inferred from a familiar name. Existing two formats/twelve parameters remain unchanged.

`data/codex-planner-review.json` accounts for all fifty movements and both existing formats by stable app ID. Each decision pins a SHA-256 fingerprint of the app definition and the official source fingerprint. **36 links** are approved: **35 exercise links and one 11s format link**. **29 equivalent movements** supply official descriptions as separate structured references. Seven adaptations, including Peter Parker, Dying Cockroach, Rosalita, Plank-o-Rama, cone-based sprints, portable-weight Thrusters and 11s, supply citations/review notes only; source descriptions are null so the different source mechanics cannot replace local instructions. Sixteen targets (fifteen exercises and generic Ladder) remain explicitly unmapped, with reasons in the review file. No name-only match, automatic alias import, canonical merge or inference from source tags was used.

This is a bounded reviewed-vocabulary integration, not import/classification of all 977 references or an exercise engine rewrite. Explicit variation selection and a broader workout-format engine remain separate work. Provider routing, free-only policy, models and credentials remain unchanged.

## Database and migration

Local migration: `supabase/migrations/20261110192426_reviewed_codex_planner_links.sql`, created using pinned Supabase CLI 2.81.3. Remote applied migration: **`20261110193401 reviewed_codex_planner_links`**. Preserve local/remote history mappings; no blind db push/reset/repair. November 10 changelog and current invoker/RLS documentation were checked; no client/CLI upgrade was required.

Adds `ex_codex_planner_links`, with foreign keys to exact canonical exercise/format IDs and official reference IDs, exactly one target per row, unique target constraints, review metadata, enable/protect flags and both fingerprints. It has RLS, SELECT-only grants for anon/authenticated, and operator writes via existing service_role/database owner. No profile metadata authorizes writes.

`fe_exicon_review_fingerprint(exercise_id,format_id)` computes an MD5 change detector over the actual canonical row and ordered aliases/counting/equipment/facilities or format parameters. MD5 here is a deterministic invalidation checksum, not an authentication or tamper-resistance mechanism. Any local edit, including an unchanged revision number or a child-row requirement/count change, invalidates the old review. Official source changes use the existing SHA-256 source fingerprint. Removed/disabled references, revoked source decisions and disabled links are withheld through the complete public RLS chain.

`fe_exicon_planner_catalog()` returns one atomic catalog plus currently valid reviewed links. Both new functions are SQL/STABLE/SECURITY INVOKER with empty search_path, explicit execution grants and no PUBLIC execution. The earlier `fe_exicon_catalog()` and `fe_codex_reference()` remain compatible. Existing exposed tables retain their policies/grants.

One internal review provenance/source-authorization row is added, `f3-q-builder-reviewed-planner-v1`. Its authorization text explicitly cites Shane's product decision and unresolved upstream terms; it is not described as an F3 Nation license. Existing source decisions are insert-only. No workout/profile/auth/private-vault schema or row was written.

## Preparation and repeatability

`npm run catalog:planner-prepare -- /path/to/published-reference-export.json` reads the explicit source export and durable review manifest, verifies every target/app definition/source fingerprint and prepares ignored `qa/exicon-planning/import.sql` and report. Default local export path is `qa/codex/planning-review-source.json`. This command never connects to a database, contacts Nation, calls AI or executes SQL. The export must contain the existing public `ex_codex_entries` fields id/name/description/fingerprint; it can be obtained through approved read-only SQL or the public reference RPC. Source prose is not committed as another corpus.

The import reuses the transactional Exicon importer. It inserts missing records, retains source permissions/protected/older/conflicting rows, then checks **both expected records and unexpected extra mechanics/alias/requirement rows** before creating a review. Existing different local data aborts the transaction rather than silently rubber-stamping a review of unseen mechanics. It checks current source visibility/fingerprint again inside the transaction. Link insertion is insert-only; a disabled/stale/different review requires deliberate engineering review, not a rerun to re-enable it. There are no user-data deletes or automatic source refreshes.

Applied the reviewed seed twice to the approved live database; both completed with 50 exercises and 36 review rows. The full local replay additionally compares review rows for no changes. All current live local policies/counting and source reference fields match the reviewed data. No new upstream source read was needed; this effort reviewed the already imported, provenance-stamped catalog snapshot.

## Generation path and precedence

The cached server reader now calls `fe_exicon_planner_catalog()`: still one publishable-key RPC, two-second app budget, sixty-second success cache, bounded response/connection identities and concurrent coalescing. Failure preserves the bundled planning fallback. Existing production/deploy-preview database gates stay disabled. The browser offline template and saved workout version remain unchanged.

`adaptExicon` attaches references only to accepted canonical IDs; it never changes mechanical fields based on a source reference. Local adaptations are citation-only. Output eligibility, generated-plan validation and server-template validation all retain the same canonical requirements, live AO availability and today's closures. The existing context limit remains 24 selected movements. Only selected movements' reviewed reference descriptions enter the provider prompt; no 977-entry prompt dump or AI fact retrieval is added. The linked 11s format adds source/definition context without changing existing parameter selection/validation or forcing source example exercises/terrain.

The system brief makes app counting/equipment/alternatives and site facts authoritative over source examples. Source prose is untrusted task data. `/api/exicon` exposes source diagnostics for verification; generation responses add `X-F3-Codex-Links`. Attribution and original links use the fixed Codex origin and encoded IDs. Shared handler tests prove one provider call receives the prepared context, with no extra AI call for facts.

## Verification before release

- **479 tests / 64 files**, lint, typecheck and production build pass locally.
- Targeted tests verify complete review coverage, source/app fingerprint rejection, duplicate reviews and wire links, adaptations without foreign mechanics, all fifty local policies/counting preserved, unchanged original eight/source records, repeat import, real anon/authenticated SQL reads/write denials, stale source/canonical/count/facility/format withdrawal, override-safe import rejection, old snapshot compatibility, rollback, unknown-site/no-gear exclusions and shared-handler/provider-context parity.
- `catalog:planner-local` uses the **actual published reference export** to verify all 36 identities, descriptions/citation-only cases and all fifty canonical policies under anon and authenticated roles, repeat stability and rollback.
- `catalog:exicon-read`: live single-RPC/coalescing pass, 50 canonical/fifty merged, 104 aliases, 35 exercise links/one format link, zero blocked IDs/ambiguous aliases. Operator network budget is explicitly fifteen seconds, distinct from the deployed two-second budget.
- `catalog:exicon-hosted`: full content parity across twelve catalog tables and **36 anonymous REST write denials**. `AO_CATALOG_ALLOW_SHARED=true npm run catalog:planner-hosted`: all canonical policies/counting and all reviewed source fields match the real database, plus **three mapping-table REST write denials**. No test row was created.
- Live authenticated SQL role: 50 canonical/36 links, no INSERT/UPDATE/DELETE/TRUNCATE privileges on review links. No real user JWT was borrowed; authenticated HTTP transport remains unverified.
- Before/after counts and checksums match for workouts 36, beatdowns 0, profiles 1, guest vault 29 and account vault 0. The original eight canonical content/source rows also match expected data. No private row contents were exported.
- Security advisors remain the baseline seven intentional private-backup no-policy INFO findings and existing leaked-password protection WARN; no new planner-link findings. See [RLS guidance](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) and [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). The historical logical backup is not an independent auth/disaster-recovery backup.

Fresh staging/CI and bounded real generation evidence are recorded below after deployment. Tests with fixture providers prove integration/validation, not live provider availability.

## Rollback, next milestone and release boundary

App rollback: redeploy tested staging implementation `3dd3d9c6ec8ab4519a59f1bd723ddaf3b36a4a50`, which uses the compatible old snapshot. The additional canonical records can remain. Disable new reference attachment with `update ex_codex_planner_links set enabled=false;` as an operator, or use the existing branch Exicon read kill switch. Cached reads expire on subsequent requests within sixty seconds. Do not silently re-enable disabled rows.

`supabase/rollback/reviewed_codex_planner_links.sql` removes only the new snapshot/fingerprint functions and link table, without CASCADE; all existing canonical/catalog/user rows remain. To withdraw the added forty-two canonical rows separately, revoke the internal source's `redistribution_allowed` flag; the original eight and bundled legacy fallback remain. No restoration/deletion of real saved plans is appropriate. Retain review metadata/provenance for future reconciliation.

The exact next user-facing milestone is **generation reliability**: investigate the known provider invalid-JSON/template fallback behavior in a separate bounded effort, using these verified structured facts and one or a few explicitly bounded free-provider checks. Do not mistake successful catalog integration or mock responses for dependable live AI generation. Expand canonical variation/format coverage only after the current planning flow is reliable. Production app deployment/main merge still requires Shane's explicit approval.

## Deployed evidence

Pending the fresh tested staging deployment and final CI identity/results.
