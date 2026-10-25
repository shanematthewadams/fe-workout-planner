# The FE Workout Planner · Sprint 2 handoff

Latest database work: [AO Database Modernization Sprint 1](ao-intelligence/SPRINT_1_HANDOFF.md).
This is an additive, locally verified foundation with a staging read endpoint; production
schema/data and the existing planner source remain unchanged. Exicon proposal and
reconciliation/security evidence are linked from that handoff.

October 16, 2026 (UTC). Shane Adams owns product; engineering owns technical verification. This replaces the earlier access-blocked checkpoint; Git history retains it.

## Actual result and scope

**25 reviewed, distinct real FE workouts are published in the development catalog**, alongside the unchanged 10 illustrative starters. There are 16 official AO profiles / 17 weekly sessions and 9 source-linked exercise guide entries. The collection goal of 20–30 was reached without fabricating regional workouts. Several source narratives omit rep conventions, timing or sections; each card exposes its gaps. “Reviewed” means reviewed against available source instructions and for privacy, not that every card is fully specified or field-tested.

A 45-day live import produced 22 candidates, including name-only/sparse records. Engineering extended collection to 120 days (June 18–October 16), producing 59 distinct candidate section sets, with 277 excluded by conservative section/privacy checks. These counts are candidate processing results, not the number of all regional events or proof excluded sources are unusable. The selected cards cover June 30–October 14 across 9 AOs:

| AO | Cards |
|---|---:|
| Airfield | 1 |
| Blackops | 5 |
| Clocktower | 2 |
| Dysentery | 2 |
| Pretty Bird | 3 |
| SouthPark | 3 |
| Stagecoach | 4 |
| The Gathering | 4 |
| Yippee Ki-Yay | 1 |

Scope impact: independent import/publishing infrastructure is now exercised on real content; Q names remain unknown because the inspected detail shape does not support reliable Q attribution. No Q was inferred from attendance. Shane subsequently identified and authorized his existing dedicated Supabase project; the live setup is recorded in the follow-up below. No purchase, duplicate project, production promotion, DNS change or With/Elsewhere modification occurred.

## Exact repository and resources

- Repository: private `shanematthewadams/fe-workout-planner`, ID `1421135917`; integration branch `develop`.
- Application commit: `930ab666d17c78b1f70da5c36f3cc62c8c32f6e8`; tree `ff4b1502ab5fabdfce1c2ad9c3980c285e80a16d`, exactly matching tested local commit `b3605ea`. Local and remote ancestry differ because updates use Git Data; exact tree equality and expected-head lease were verified before every ref update.
- This document will be a later documentation-only `[skip netlify]` commit. Its containing commit is the documentation head; the application SHA above is authoritative for deployment.
- Production remains `main` at `f293071740044c1f9b700e5bc70d9ee6cf28ce2a` (README starter). Production was not promoted.
- Netlify project `fe-workout-planner`; site `1d2480e0-3891-41db-9574-61cb13b7ae0a`; team `6a8d98d0bae1a4d6a86f48de`.
- Existing development preview: https://develop--fe-workout-planner.netlify.app/.
- Deployment verification: ready deploy `6ad253dc94467b5388bbf82c`, build `6ad253dc94467b5388bbf82a`; branch-deploy/develop, exact application SHA confirmed through scoped API, no error. Immutable URL https://6ad253dc94467b5388bbf82c--fe-workout-planner.netlify.app/. JS `/assets/index-7cfiGaTv.js`, CSS `/assets/index-BeB5N7Fm.css`..
- GitHub Checks: https://github.com/shanematthewadams/fe-workout-planner/actions/runs/38934007510; 70 tests, lint and build passed (job `117084794645`)..
- Hosting retains existing Netlify team sign-in. App functionality requires no consumer account. No security controls were weakened.
- Netlify project-summary adapter has returned incorrect branch-deploy references. Read the real deploy ID from authenticated Deploys UI, then validate its state/SHA through scoped deploy API.

## Live source access and reuse

All 23 visible F3-Nation repositories were inspected beyond pinned projects. `f3-nation`, `Website-Widgets`, `the-codex`, and `pax-vault` were active/unarchived. Monorepo code is AGPL-3.0; no repository license was found for the other three. No upstream implementation or bulk national description corpus was copied. Public code does not grant reuse rights to underlying records. Full source links and findings: `docs/SOURCES.md`.

Live OpenAPI `https://api.f3nation.com/docs/openapi.json` specifies zero-based `pageIndex`, `pageSize` max 100, list `/v1/event-instance` with `regionOrgId`, `startDate`, `startDateTo`; result `{eventInstances,totalCount}`. Details are GET `/v1/event-instance/id/{id}`, direct objects with narrative and privacy/status fields. Required Client/Bearer headers stay server-side. Older widget limit/hasBackblast examples differ. List metadata alone is not a narrative integration.

`F3_NATION_TOKEN` is secret and `F3_REGION_ID` configured in the existing Netlify project. Builds scope is required for the current privileged development-build collector; configured scopes also include Functions/Runtime. Contexts include branch-deploy and others, but code runs only on `develop` / `branch-deploy`, skipping production/local/CI. Connector reads mask the token; never use the masked representation for a request or report it as invalid. No credentials are printed, bundled, committed or exposed by an endpoint. Current key creation is documented at https://admin.f3nation.com/api-keys → New API Key; this path was upstream-documentation verified, not a logged-in F3 admin walkthrough.

Live probe verified 143 recent event records and three public, active details with matching event/region fields and both plaintext/rich narratives. The complete 120-day paginated collection subsequently succeeded through the actual adapter. Collector commit `21146dfeb95231edb98ac896294012fa6b5e583c`, deploy `6ad249b5107e14587f922b11`, build `6ad249b5107e14587f922b0f`, produced `FE_PRIVATE_REVIEW_EXPORT {"candidates":59,"excluded":277,"published":0}`. The authenticated Blobs UI showed/downloaded the 84.3 KB candidate JSON in deploy-specific store `deploy:6ad249b5107e14587f922b11`, key `fe-review/candidates.json`, region `us-east-2`. The earlier 45-day deploy `6ad1f4511b8f857c06544d74` produced 22 candidates. Both were successful; file upload and retrieval are now live-verified. Candidate Blobs are outside `dist`, with no public serving endpoint. Browser download-event notification timed out, but the actual synchronized file was present, parsed and kept only in ignored `.imports/`.

Shane explicitly approved FE backblast reuse (“Fe backblasts approved”), recorded in `data/source-permissions.json` on October 16. Scope covers workout instructions and supported provenance, excluding unrelated personal material. Do not ask again. No Slack reads/posts occurred; this does not authorize unrelated private Slack data. Prayer/health/contact/attendance material is not in the published collection or AI context. The collector strips non-workout sections and rejects suspicious inline content; engineering then reviewed every selected section, removed unrelated asides and split inline Mary headings. No full raw backblast belongs in GitHub.

25/25 selected-source comparisons verified every retained numeric token unchanged and in source order; retained instruction text is a subsequence of the captured sections after documented omissions. Original workout intent/order remains. No total duration, missing warmup, Mary or Q was invented. `data/regional-fidelity.json` records captured-section hashes and per-card review notes; `data/regional-review.json` stores approved workout-only sources and exact reviewed fingerprints. The source API URLs may require F3 access. Regional adaptations of IronPAX remain explicit in notes.

Public FE schedule supplied AO facts; empty RSS / unavailable WordPress API and focused searches did not provide a complete narrative corpus. AO local terrain, distances, lighting, coupons and weather alternatives remain separate and unknown, with no inference from AO names. Nine exercise names were checked against visible Exicon CSV; original concise guide instructions and links avoid bulk reuse while national content terms remain unresolved.

## Implementation and repeatable commands

`nation-adapter.ts` validates official origin, identities, region/privacy/activity, response shapes and complete pagination, caps pages/timeouts, deduplicates IDs, fails repeated/incomplete/changing totals and retains catalog through upstream failure. Collector runs only during privileged develop builds, logs safe counts only and creates private, unreviewed candidates. It never auto-publishes.

`catalog-import.ts` uses stable source IDs and canonical SHA-256 fingerprints. Identical imports preserve approval; content/metadata/reuse/archive changes invalidate it. Approval requires current hash, reviewer, privacy attestation, reuse evidence and The Thang. Explicit archive withdraws on export; missing results/outages never delete records. `data/regional-review.json` initializes the ignored local registry on a fresh checkout and preserves approvals across workspaces. Only approved sources are committed; unreviewed candidates stay ignored. Compare source section hashes/metadata and perform documented curation before merging future automatic candidates over curated records.

Public search includes imported instruction text as well as structured exercise names, title, Q and AO. Unknown running/equipment cannot match “None” filters. Source-status/AO filters, provenance issues and AO-to-workout links work with the bundled catalog during outages. Unknown timing is labeled clearly. AO matching ignores spacing/punctuation, so official South Park and Yippee Ki Yay labels match backblast variants without changing original provenance. Browser storage `fe-planner:v1`, backup version 1, starter IDs and personal-copy independence remain unchanged; importer never reads personal storage.

Node 22.18+ or 24 / npm:

```sh
npm ci
npm test -- --maxWorkers=1
npm run lint
npm run typecheck
npm run build
npm run catalog:sync-aos
node --env-file=.env.import --experimental-strip-types scripts/import-catalog.ts nation START_DATE END_DATE
npm run catalog:import -- merge /absolute/path/to/reviewed-workout-only-export.json
npm run catalog:import -- approve SOURCE_ID CURRENT_SHA256 'Reviewer name'
npm run catalog:import -- export
npm run catalog:export-sql
```

Do not paste secrets into chat or add VITE_* secrets. Local source credentials must be loaded privately server-side; Netlify's saved token is not readable as plaintext through the connector. Engineering can retrieve build candidates via authenticated Data & storage → Blobs instead. `.imports/` files use 0600 and directory 0700, atomic registry writes. Workflow details, source schema and captured-hash serialization: `docs/IMPORT_WORKFLOW.md`. Vite can use `--host 127.0.0.1` in this environment.

Supabase was subsequently connected in the authorized project below. Dedicated FE Supabase fresh-install reference: `docs/catalog-schema.sql`, optional `docs/starter-seed.sql`; generated `.imports/publish.sql` transaction withdraws managed regional records then upserts 25 approved records using stable IDs, preserving unmanaged rows. Schema enables RLS, public SELECT for approved/published only, anonymous/authenticated write denial and privileged server/admin imports. No consumer accounts are required. A refreshed inventory after Shane’s correction found his new dedicated F3 Workout Planner project, now configured as recorded below. With remains untouched.

## Verification and limits

- 70 automated tests pass: model/UI/import/discovery/repository, malformed/sparse sources, duplicate/paginated/repeated/incomplete pages, changed-source invalidation, archive/outage retention, personal independence and isolated database policies. Two old hardcoded ten-card assertions were updated to catalog size while retaining explicit ten-starter validation.
- Lint, TypeScript/Vite build, diff check and 25-record publication SQL generation pass. Local/remote tree parity checked before push.
- Real 25-source identical reimport preserved registry exactly; changed-source test invalidated only that approval. Fresh-checkout durable registry reproduces published cards byte-for-byte as objects, including provenance. A real CLI check with the ignored registry absent also initialized all 25 approvals and preserved them on a no-op merge.
- Chromium 153 at 390px and 1365px: 35-card catalog, 25 regional filter, Clocktower AO→2 real cards, guide, real regional detail/Q, copy/edit/save/reload and original isolation pass; no overflow/page errors. Existing personal drafts were not touched (QA uses isolated fresh browser contexts).
- Representative real workout native Chromium print: full 3 Letter pages and Thang-only 1 page. Poppler rendered inspection found readable complete counts/order, no clipping. Safari/physical-printer behavior is not verified. Earlier Sprint 1 gaps in responsive/editor/native print QA were completed before this publishing work.
- Isolated PGlite/Postgres verifies public approved/published-only reads, anonymous/authenticated write denial and invalid/unapproved publish rejection. Live Supabase REST/RLS checks have now also passed; see the follow-up below.
- Deployed browser: 35 total cards / 25 regional; instruction search found the expected single card; checked exact round counts and counting rules in REHOPE; official South Park AO link returns 3 source cards. Deployed JS asset matches the local build. Actual Netlify deploy and GitHub Checks SHAs above were verified; production main SHA was read again and remains unchanged.
- Live verified: server-side auth, actual narrative fields, complete paginated adapter run, private candidate upload/download, reviewed source content, official AO snapshot, GitHub/Netlify deployment. Rich-only extraction and failure/archival variants are tested with fixtures; not all such cases have occurred live.
- Remaining limits: Q metadata unresolved; several source rep/timing/section gaps explicit; 8/16 scheduled AO names represented, plus Blackops (not listed on the public schedule snapshot); no complete regional history or full national description license; dedicated FE Supabase is now connected as detailed below. Library is a versioned snapshot, not an automatic live-publishing promise.

## Sprint 3 priorities and product review

1. Improve source completeness/Q metadata through supported upstream fields or an authorized workout-only export; expand underrepresented AOs and resolve source ambiguities with author-provided details, preserving original IDs and distinguishing adaptations.
2. Add practical local AO attributes only with verified local evidence/date; maintain separate official/local freshness and outage fallback. Revisit national content licensing before bulk Exicon ingestion.
3. Maintain synchronized database/repository publication and monitor the live read-only catalog. Keep production promotion/DNS and dependent AI work out of scope until separately authorized.

Shane product review only: browse the regional library for FE usefulness; try one favorite card's wording/Q view; identify any material source correction through product feedback. Engineering retains technical testing. No new credential entry is required for the completed repository-backed preview.

## Dedicated Supabase follow-up · October 16, 2026

Shane clarified that he had created **F3 Workout Planner** and authorized its use. Refreshed connected inventory found it healthy and empty (no public tables/migrations), project ref **`kitqovhdwzkhpxlepvfn`**, organization `pebsssisweilmbqwgjpu`, region `us-east-1`, Postgres `17.11.0.003`. No new project/branch/purchase was needed. API URL `https://kitqovhdwzkhpxlepvfn.supabase.co`. With/Elsewhere were not queried or modified.

Applied remote migration **`20261016162220_create_read_only_published_catalog`** using existing `docs/catalog-schema.sql`, then seeded 10 illustrative starters and published 25 reviewed regional originals using the generated privileged SQL. RLS is enabled; anon/authenticated SELECT requires published AND approved. All browser writes are revoked. Public REST GET returns 35 cards; all 25 regional payloads exactly equal the repository records. The known unpublished fixture is invisible even when requested by ID without a client publication filter. Anonymous POST/PATCH/DELETE return HTTP 401 / `42501`. Live SQL under authenticated role also hides unpublished data and rejects all three writes. Security advisor reports no notices. A single reserved unpublished engineering fixture remains for repeatable verification; its attempted cleanup returned connector `Invalid or expired requestState` twice, and no destructive workaround was attempted. It contains workout-only test data, not a personal draft.

Configured `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in **`netlify.toml` under `[context.develop.environment]`**, for develop builds only, as intentionally public values. Netlify connector upserts reported success but refreshed metadata and the authenticated dashboard did not show the values; the versioned configuration avoids depending on that write. No secret is in this config. The key is a modern publishable key, never a server/service-role key. Production variables, consumer accounts and personal storage are unchanged. `scripts/verify-live-catalog.mjs` repeats REST parity/unpublished/write-denial checks with only those public values; see `docs/DATABASE_ADAPTER.md`. Local ignored verification configuration is `.imports/supabase-public.env`, never committed. Privileged publishing continues through the admin connector and `.imports/publish.sql`, not a browser endpoint.

Application commit `930ab666d17c78b1f70da5c36f3cc62c8c32f6e8`, tree `ff4b1502ab5fabdfce1c2ad9c3980c285e80a16d`, matching local `b3605ea`. Netlify develop deploy `6ad253dc94467b5388bbf82c`, build `6ad253dc94467b5388bbf82a` is ready with that exact SHA. Preview https://develop--fe-workout-planner.netlify.app/; JS `/assets/index-7cfiGaTv.js` matches the configured local artifact. GitHub Checks passed with **70 tests**, lint and build: https://github.com/shanematthewadams/fe-workout-planner/actions/runs/38934007510 (job `117084794645`). Type/lint/build/diff checks passed locally too. No frontend server-credential markers (`F3_NATION_TOKEN`, `service_role`, `sb_secret_`) are present in the compiled artifact.

The authenticated deployed browser displays **“Latest published library loaded”**, which is set only after a successful validated Supabase response. It shows 35 total / 25 regional cards, instruction search returns the expected single card and the real card retains exact round-10 counting text. This is an actual live frontend/database verification, not a fixture-only claim. The local headless Chromium network could not reach Supabase (`ERR_EMPTY_RESPONSE`), so it verified configured outage fallback at 390px and 1365px: all 35 bundled cards, Q/editor/copy/save/reload and the private personal copy survived. Network failure was not reported as a successful local live database read. The real public REST checks were run independently through Node; live database reads were verified in the deployed cloud browser. New UI regression tests verify successful remote status and private draft preservation on failure.

Repeat privileged regional publication kept exactly 25 managed regional / 35 published rows; the one hidden engineering fixture makes 36 total database rows. Real REST parity and denied-write checks were rerun successfully after publication. No consumer accounts, service keys in the browser, purchases, production promotion, DNS changes or With/Elsewhere modifications occurred. No outstanding access or configuration action is needed from Shane for this development connection. Repository snapshots remain the outage fallback, and publication commands must keep database/repository withdrawals synchronized.
