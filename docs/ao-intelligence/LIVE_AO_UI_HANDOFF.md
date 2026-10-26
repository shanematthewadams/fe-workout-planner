# Live AO interface continuation · October 26, 2026

## Scope and branch

Continues `studio/ux-streamline` from verified remote `04077273a4cd468a9a5cc013bef698390129ffe1`. The existing approved Supabase project is `kitqovhdwzkhpxlepvfn`; no database changes, imports, account writes or new environments were needed for this UI continuation. Production application `main` remains `e254c11ec266e62586208cb1282f9eeb8e7b093a` and requires separate promotion approval.

## Implementation

The planner AO panel and sixteen-card AO directory now read the same normalized catalog as server workout generation. `src/ao-catalog.ts` holds the shared validated schema and conservative adapter; server credentials/configuration remain in `server/ao-intelligence.ts`. The existing endpoint's default response is unchanged; `GET /api/ao-intelligence?ao=<id>&view=catalog` exposes version 1 of the already-public catalog without credentials. Joined amenity names replace internal codes in the UI.

`src/use-ao-catalog.ts` validates responses, deduplicates concurrent reads, caches successful records for sixty seconds (maximum 128), rechecks on focus/visibility and while visible, and times out after six seconds. Failed/invalid/fallback responses use the bundled AO behavior and are not cached as live. AO changes cannot display a late response for another AO. No AI call retrieves these stored facts.

The UI distinguishes reported present, reported absent, unknown and restricted facilities, with nearby destinations separate from on-site amenities. Restricted coupons remain unknown rather than confirmed absent. Shared venue amenities retain separate Baywatch/Airfield flag points. South Park requires explicit venue selection; legacy `heritage-marina` draft IDs normalize to `heritage-park-marina`. Device notes follow the selected venue, including newly seasonal live assignments. Vagabonds has no fixed map pin. Running/rucking conventions are visible. Official schedules and dated Site Q roster remain their existing source snapshots; this sprint does not turn them into live database data. The AO selector and endpoint allowlist still use the sixteen-AO official snapshot, so adding an entirely new AO/region still requires updating that snapshot. Existing AO facilities, landmarks, assignments and conventions refresh from the database without an app redeploy.

Client offline templates consume the current cached catalog context, explicit venue and today's closures, matching the panel and server adapter. Saved workouts retain their captured context on reopen/print/lead; catalog refresh does not rewrite existing plans. Existing authentication, profiles, workout ownership and cloud/offline storage contracts are unchanged.

## Verification before deployment

Local lint, TypeScript/Vite build and diff checks pass. Full automated suite: **443 tests / 58 files pass**. Nine targeted catalog/UI tests cover shared flags, manual seasonal/mobile locations, nearby/restricted/unknown/absent semantics, browser TTL/coalescing/failure/races, venue-scoped drafts and offline context. Endpoint tests cover the versioned response, JSON fallback and absence of credential fields. Prior idempotent import, SQL/RLS and workout/profile compatibility coverage remains in the full suite.

A new Playwright scenario exercises actual rendered components with a catalog fixture across desktop, tablet, Chromium mobile and WebKit mobile: Pretty Bird restricted turf/nearby garage, both South Park venues, a stairs closure, zero-AI offline generation, save/reopen/print/lead, accessibility and horizontal overflow. Hosted verification permits read-only real AO GETs while blocking provider/auth/cloud writes, waits for the live Gold Rush meeting point, and checks the saved workout retains it. CI/deployed results will be recorded below after execution; fixture tests alone do not prove hosted reads.

## Deployment, rollback and next milestone

Branch deploys alone default to the shared public read catalog. Production/deploy-preview catalog reads stay hard-disabled; dev requires configuration. Do not introduce a service-role key into browser configuration. No database rollback is needed for this continuation. To roll back the app on staging, revert the continuation commit or deploy the prior application commit `403e6142dc904a2299928e1f06c7c311cf3186f4`; schema/data remain untouched. Preserve later independent branch changes when reverting.

Production app release requires Shane's explicit approval, a deliberate review of production catalog gating, and fresh deployed/auth/storage verification. Do not merge main or enable the production read path implicitly. Existing database release/backup/rollback instructions remain authoritative in `SHARED_DATABASE_RELEASE.md`; migration filename/history reconciliation is still required before any CLI schema push.

Next implementation milestone remains the bounded Exicon schema/permission review in `EXICON_SPRINT_PROPOSAL.md`: canonical exercises, regional aliases, genuine variations, counting conventions and reusable workout formats. Check upstream licensing before national content import. Reconcile unverified AO inventory defaults through evidence rather than treating them as confirmed facts.

## Deployed catalog evidence

Staging application commit: `f26313b467be470a46ef564c6c5b64002651e5fb`, tree `e514a47edfa77b115207a6ae9d97ae1452a5ff78`. Hosted `build-info.json` reports that exact commit and `staging`. Hosted `/assets/index-DZ2_T7-2.js` matches the configured local staging artifact byte-for-byte, SHA-256 `068d8859ac027ccabcc27bb29581796f642feb9619015b47472c751acb67c6bd`.

All **16/16** hosted `view=catalog` reads returned HTTP 200, version 1, `source=database`, and canonical amenity names. South Park has two assignments; Vagabonds has zero. An initial sixteen-way probe encountered eight transient upstream/proxy response failures from this runtime; sequential retries passed all eight. The client retains its timeout/validated JSON fallback for outages; this is not a claim that the hosting network never fails. Earlier independent five-AO probes also passed. No application or database writes were used for these catalog reads.


Initial CI run `40249397381` passed 443 unit/integration tests and 131 browser cases, with four intentional historical-comparison skips. The new Safari fixture journey failed because its API request bypassed the page route after service-worker activation and received preview HTML instead of the fixture. Its trace shows HTTP 200 `text/html`, not a rejected database fact. The catalog schema correctly rejected that response and displayed saved fallback. The fixture scenario now blocks service workers explicitly; existing dedicated offline-cache tests continue exercising the real worker, and hosted verification reads the actual API with worker isolation. Fresh verification follows below.
