# Shared catalog adapter

Sprint 1 runs entirely from the versioned catalog in `src/catalog.ts`. No database, login, API key, or paid service is needed. Personal workouts and favorites stay in browser local storage. There is no cross-device sync.

`CatalogRepository` has one read-only operation, `list(signal)`. `BundledCatalog` returns a deep copy of the original starters. `SupabaseCatalog` reads published rows from a dedicated project's Data API and validates every workout with the same Zod structure used by local imports. Malformed, duplicate, or personal records reject the entire response. The app retains bundled starters on failure. A configured, empty shared catalog is intentionally displayed as empty. Loading is capped at 8 seconds and 500 rows.

To configure later:

1. Select the Supabase organization and confirm the cost/free-project eligibility. No project was created in Sprint 1. Never reuse With's project.
2. In that dedicated project, apply `catalog-schema.sql`, then `starter-seed.sql`. The seed uses `ON CONFLICT DO NOTHING`; it does not replace published records. Regenerate with `node scripts/export-seed.mjs` after changing starter content.
3. Enable Data API access to `public` if needed. The SQL enables RLS, revokes write access, and explicitly grants only SELECT for published rows. Test anonymous reads and denied writes against the real project before enabling the adapter.
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the Netlify development context and rebuild. These are public browser values. Never use a secret or service_role key. Copy `.env.example` to `.env.local` for local configuration.
5. Check published/unpublished reads, denied writes, timeout fallback, and schema validation in the actual preview. This live integration is not verified yet; only mocked adapter behavior is tested.

Current documentation consulted October 15, 2026: https://supabase.com/changelog.md and https://supabase.com/docs/guides/api/securing-your-api.md. The changelog index was retrieved; no Supabase SDK is installed. Grants and RLS are separate layers; both are included in the prepared SQL. No migrations, database queries, or account changes were performed.

All workout records use stable IDs and schemaVersion 1. Sections and blocks are ordered arrays; blocks can contain exercises and/or freeform instructions. Amount supports freeform progression such as “2, 4, 6…”, with unit and counting conventions separate. Sets are optional. Unknown block estimates are null; Mary can be omitted. Source provenance survives personal copies; `kind` and `originId` establish the copy boundary. Remote writes and regional import review belong to Sprint 2.
