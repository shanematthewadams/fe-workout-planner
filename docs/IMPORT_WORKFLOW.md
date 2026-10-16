# Regional imports and review

This is an admin CLI, not a public import endpoint. No account is needed to browse or make private copies. All browser storage keys and backup version 1 are unchanged.

## Source access

Live OpenAPI inspected at https://api.f3nation.com/docs/openapi.json on October 16, 2026. Current list path `/v1/event-instance`: `pageIndex` starts at 0, `pageSize` maximum 100, `regionOrgId`, inclusive `startDate` / `startDateTo`. Response: `eventInstances`, `totalCount`. Detail path `/v1/event-instance/id/{id}`. Current upstream handler has `backblast`, `backblastRich` and privacy flags in detail; lists contain event metadata. Old widget `limit`, `hasBackblast`, `orderBy` examples do not match this live specification. Do not copy their pagination.

Unauthenticated event request returned 401. No authenticated FE response has been read. Detail compatibility is contract-tested with synthetic fixtures only. A schema mismatch aborts, without overwriting the review registry. The adapter verifies region membership, skips private/inactive events, deduplicates pages and fails on incomplete/repeated pages. An outage aborts the entire fetch before writing candidates. No source is archived just because it disappears or a request fails.

Current upstream API README points to `https://admin.f3nation.com/api-keys` (New API Key). API keys have explicit per-org roles; they do not inherit their owner's access. Widget README instead points to `map.f3nation.com/admin/regions` for org ID and Settings → API for a token. This older UI path is not live authenticated verification. Shane should use the current API Keys page and restrict any credential to The FE. We use GET only; do not grant Nation-wide access. Available roles may still include write capability; the connector itself exposes no write API.

Small secure setup: add `F3_NATION_TOKEN` and `F3_REGION_ID` to the existing FE Netlify project's environment variables as server-only values (never `VITE_*`), in the development branch context. Token should be marked secret, scoped to Functions, with no production value. Do not paste it in chat, commit it, or put it in a browser. Engineering can retrieve these into an ignored local environment through authenticated admin tooling for the CLI; setting them alone does not activate a live sync or publish any records. Until credential retrieval is available, an authorized workout-only export works through `merge` below. Importing a private Slack export requires separate permission to use that content; regional admin access alone is insufficient.

## Commands (engineering owns these)

Node 22.18+ (type stripping) or Node 24. `npm ci` first. Use a local ignored `.env.import` only if securely populated by admin tooling. The CLI reads process environment; Node can load that file without printing secrets:

```sh
node --env-file=.env.import --experimental-strip-types scripts/import-catalog.ts nation 2026-09-01 2026-10-15
npm run catalog:import -- merge /absolute/path/to/workout-only-reviewed-export.json
npm run catalog:import -- approve SOURCE_ID CURRENT_SHA256 'Reviewer name'
npm run catalog:import -- export
npm run catalog:export-sql
npm run catalog:sync-aos
```

`nation` writes candidates only to ignored `.imports/nation-candidates.json`. Recognized section headings keep exercise instructions in original order. Attendance, intro and named COT/prayer/announcement sections are not retained. **Heading extraction is not a privacy guarantee:** an admin must inspect every retained section for inline health, prayer, contact and unrelated personal material before merging. Neither raw narrative nor private review files belong in GitHub or AI context. No AI call is made. Unrecognized or rich-text-only narratives remain blocked for manual extraction; never guess.

The strict source format is defined in `scripts/catalog-import.ts`. Required: stable `sourceId`, HTTPS source `url`, `title`, ordered `sections` (`kind`, workout-only `text`), reuse basis/evidence. Optional metadata Q, AO, date is left absent when unknown. `privacyReviewed` must explicitly be true before approval. Reuse basis must be `permission` or `license`, with evidence; `unresolved` never publishes. Omitted duration is unknown; non-null duration requires source/inferred basis. Counts are retained verbatim instead of guessed into structured exercises. Document ambiguities in `issues`. No Warmup or Mary is generated. Freeform sections print/read correctly but counts are not individually editable fields until a personal adaptation is structured.

`merge` changes only `.imports/review.json`, keyed by stable source IDs. Repeating identical content leaves review intact. Changes to content, metadata, rights or archive state invalidate approval. Approve requires the exact fingerprint shown in the local registry and a reviewer; it attests to privacy, source fidelity, counts/order and reuse review. `export` writes only currently approved, non-archived originals to `data/regional-workouts.json`. The empty checked-in file reflects zero approved FE backblasts, not missing seed data. Existing starter IDs never change. Personal copies have independent IDs/content and are never part of import/export/publication.

Explicit `archived:true` withdraws a record on the next export. Missing records are retained for review, never silently deleted. Export the repository snapshot whenever publishing database updates so offline fallback has the same withdrawals. The bundled catalog is a versioned snapshot, not a promise of current upstream availability.

For Supabase later: fresh-install `docs/catalog-schema.sql` in a dedicated FE project, then seed starters if desired. `catalog:export-sql` generates a local transaction at `.imports/publish.sql`: withdraw previous managed regional rows, then upsert reviewed exports with the same IDs. Unmanaged rows are never overwritten. Review and apply through a privileged database admin; never expose a service key in the app. No FE project exists yet, so SQL is prepared and isolated-Postgres tested, not Supabase live-verified.

AO sync reads only the public official FE schedule, stores schedule facts with a freshness timestamp, and fails without replacing the snapshot if the expected structure is missing. Stable AO IDs are derived from names; an official name change requires an explicit ID migration. Local terrain/lighting/coupon/weather information lives separately in `data/ao-local.json` with its own source/date. Empty means unknown. No terrain has been inferred from AO names. The sync is an engineering command, not an automatic live schedule. Public site contradictions (e.g. The Gathering detail page says Thursday while the schedule says Saturday) are not silently reconciled; current snapshot follows the schedule page and links to it.

### Development-build connection check

`npm run build` now runs optional `postbuild` diagnostic `scripts/probe-nation.mjs`. It makes GET requests only when Netlify reports `CONTEXT=branch-deploy` and `BRANCH=develop`; production, other branches and local/CI builds skip it. The token is read inside the server build process and is never embedded in the application or returned by a public endpoint. This diagnostic requires the **Builds** variable scope in addition to Functions; it reports only `FE_SOURCE_PROBE` status codes/counts and whether up to three public event details have narratives/recognized workout headings. It never prints credentials, event identities, attendance, narrative text, errors containing source bodies or contact information. It does not import or publish records, and unavailable upstream access does not fail the independent application build.

The variables were confirmed saved on October 16 UTC. Netlify's variable-reading connector returns masked secret values. A direct request made with that masked representation is not evidence that the saved credential is invalid; only the development-build check can establish live credential validity without exposing it.
