# Shared catalog adapter

The development preview now reads the published catalog from the dedicated **F3 Workout Planner** Supabase project, ref `kitqovhdwzkhpxlepvfn`, region `us-east-1`, API URL `https://kitqovhdwzkhpxlepvfn.supabase.co`. Shane explicitly authorized this existing project on October 16, 2026. It was inspected empty (no public tables/migrations) before setup. With and Elsewhere remain untouched; no project/branch was created or purchased.

Migration `20261016162220_create_read_only_published_catalog` applied the existing `docs/catalog-schema.sql`. The database contains 35 approved/published cards: 25 reviewed regional originals plus the 10 illustrative starters. A reserved unpublished engineering fixture (`fe-verification-unpublished-20261016`) remains hidden to support repeatable access checks. It contains only an existing approved workout copy with an engineering title; no personal data. Two cleanup attempts returned the connector error `Invalid or expired requestState`; the fixture is intentionally retained unpublished rather than pursuing destructive alternatives.

## Access boundaries

- RLS enabled on `public.workouts`; SELECT policy requires both `approved=true` and `published=true` for `anon` and `authenticated`.
- Anonymous/authenticated roles have SELECT only. No browser INSERT/UPDATE/DELETE grants or policies. Only privileged server/admin processes publish.
- Browser uses the modern **publishable** API key (`sb_publishable_…`), never a service-role or secret key. `netlify.toml` supplies `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as intentionally public values under `[context.develop.environment]`, only for develop builds. Production configuration was not changed. Netlify connector upserts reported success but neither refreshed connector metadata nor the dashboard showed the new variables; versioned branch configuration avoids depending on that unverified write. The public key grants no browser writes and is designed to be visible in the shipped bundle.
- No consumer accounts/login were added. Personal drafts/favorites remain exclusively in browser local storage (`fe-planner:v1`), with unchanged backups and independent copy IDs.

`CatalogRepository.list(signal)` is read-only. `SupabaseCatalog` validates rows through the existing Zod workout model, rejects malformed/personal/duplicate records and reads at most 500 records. The app aborts slow reads after 8 seconds and retains the complete bundled catalog on failure. A successful empty database response intentionally displays an empty library; it does not restore withdrawn cards. A failed read uses the versioned snapshot, so repository withdrawals must be synchronized with database publication.

## Repeatable engineering commands

```sh
npm run catalog:import -- merge /absolute/path/to/reviewed-workout-only-export.json
npm run catalog:import -- approve SOURCE_ID CURRENT_SHA256 'Reviewer name'
npm run catalog:import -- export
npm run catalog:export-sql
node --env-file=.env.local scripts/verify-live-catalog.mjs
```

Load only the URL and public publishable key into the ignored `.env.local` for the verification command. It performs public REST reads and attempts writes that **must** be denied, targeting only the reserved engineering fixture. It compares all regional payloads exactly with the repository export. It never uses privileged credentials or modifies real cards. A failed assertion means stop publication and investigate.

Apply generated `.imports/publish.sql` using the authorized Supabase connector/privileged admin process, project **`kitqovhdwzkhpxlepvfn` only**. The transaction withdraws previous `regional-import-v1` rows and upserts approved originals with stable IDs; unmanaged records are preserved. Repeating publication leaves 25 managed originals. `docs/starter-seed.sql` uses conflict-do-nothing to preserve existing starters. Never send personal drafts to this process. `docs/catalog-schema.sql` is a fresh-install reference, not a command to rerun against the existing table.

## Live verification · October 16, 2026

- Public REST GET without app sign-in returns exactly 35 approved/published rows; all 25 regional payloads exactly match repository originals, including IDs, instructions and provenance.
- Querying the known unpublished fixture directly returns `[]`, including without a `published` URL filter. This verifies actual RLS filtering rather than only client filtering.
- Anonymous REST POST/PATCH/DELETE all return HTTP 401 with Postgres code `42501` (permission denied).
- Live SQL under `SET LOCAL ROLE authenticated` sees only 35 published rows, hides the fixture and rejects INSERT/UPDATE/DELETE. No consumer account was created for testing.
- Supabase security advisor returns no notices. Project starts on Postgres 17.11; changelog/database upgrade and TLS deprecation notices were reviewed, with no incompatible feature used here.
- Prepared schema policy tests also run in isolated PGlite; those remain useful regressions, alongside the real Data API checks above.

Upstream docs checked October 16: https://supabase.com/changelog.md and https://supabase.com/docs/guides/api/securing-your-api. Grants and RLS are separate layers; both are explicitly configured. No Supabase SDK is installed; the adapter uses the supported REST API with the publishable key in the `apikey` header.
