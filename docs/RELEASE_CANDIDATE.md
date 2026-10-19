# F3 Q Builder — finishing pass

Scope: automatic cloud saving after one-time opt-in, source-backed AO review/venue handling, representative AI evaluation, navigation/release polish, and consistent icons. Playlist workouts are v2 ideas; existing circuit timers are preserved.

## Delivered in code

- The cloud controller stays mounted across normal navigation. Connected devices reconcile saved workouts automatically after an explicit save, on reconnect and on focus. Changes are debounced; failures stop automatic retry loops and keep the device copy. Existing private connection codes and v1 workout backups remain compatible. Reopening does not create a new collection automatically.
- Connection setup is under Saving & devices. A compact status reports actual cloud acknowledgement rather than claiming cloud success after a browser save. Copy/paste connects another device once. Recovery, code downloads, disconnect and legacy Studio import live in secondary disclosures. Favorites and unsaved editing sessions remain device-local; the UI says so.
- Cloud merges use existing optimistic versions and three-way conflict handling. In-flight device edits/storage warnings block a stale merge. Editing an older open version after a cloud update creates a conflict copy rather than replacing the newer saved record.
- Staging fails closed unless an isolated database or the explicit staging-only RPC is configured. Production always uses the existing production RPC. Production connection codes are not reused on staging.
- The AO inventory sheet was read on October 18, 2026. Site-Q reports from Prestige Worldwide, Dairy Queen, Morgan Freeman, Vana and Black Bird inform curated source-backed profiles. Pending inventory values are not bulk-promoted. Goose Poop Island remains reported/unverified. Nearby landmarks and gathering-only spaces are displayed but excluded from the planner's eligible workout landmarks.
- South Park asks for its seasonal venue. Annual changeover is Site-Q determined; no date is invented. Neither seasonal venue inherits the other venue's amenities or South Stride's. Existing unscoped South Park device notes are not injected into a venue.
- AO JSON proposals have bounded strict schemas, sources, real review dates, landmarks and venues. App review/export never publishes or silently applies them. `scripts/review-aos.ts` previews by default; a repository maintainer explicitly reviews and applies a proposal with `--apply`, then normal tested release controls govern publication. No pretend browser admin role or shared public-write endpoint was added.
- Browser Back/Forward, saved-workout hashes, reload and rejected dirty-editor navigation are supported. Route hashes contain IDs, never connection codes. Bookmarked cloud workouts can resolve after cloud loading.
- Lucide icons accompany text in navigation, planning details, weather, AO information, timers and saving. Decorative SVGs are hidden from assistive technology; existing control names remain stable.

## Verification and remaining gates

Engineering runs local tests, lint, typecheck/build, then GitHub browser QA for Chromium desktop/tablet/mobile and mobile WebKit. Browser cloud checks use a separate fixture build, intercepted fake backend and two isolated browser contexts; no real cloud plans are touched. Production publication is not authorized.

The repeatable `npm run eval:planner` runner covers coupon partners with a closed track; an unverified seasonal South Park venue; individual core work in rain with a closed field; and targeted equipment/running removal. It reuses real request/response schemas and the shared plan validator, restricts the host to staging, stops at authentication/rate limits, and never counts template fallback as live AI success. Report output goes to `qa/live-ai-evaluation.json`.

A real staging request on October 18 (America/Chicago) returned HTTP 401 from Netlify's team-login protection before reaching the planner. Live free-provider output quality therefore remains **not verified in this pass**. No authentication protection was weakened and no paid model was used.

### Prepared staging database activation — requires Shane's approval

`docs/staging-plan-sync.sql` adds only `fe_staging_private` and `public.fe_staging_sync_plans` in the existing FE project. It creates no paid branch/project, copies no production rows, and does not alter the production vault or legacy Studio table. It includes the existing model-generated payload validator. Local PGlite checks verify separate data, code scope, version conflicts and denied direct table access. PGlite stubs the unavailable pg_jsonschema extension; real extension validation is not claimed from that test.

After approval, apply this exact SQL as a named migration to the dedicated FE project, run schema/advisor checks and synthetic staging-only round trips, then set branch-deploy build variables:

- `VITE_STAGING_SUPABASE_URL`: existing FE project URL.
- `VITE_STAGING_SUPABASE_PUBLISHABLE_KEY`: that project's public publishable key.
- `VITE_STAGING_SYNC_RPC`: `fe_staging_sync_plans`.

Only then deploy staging and verify real cross-device cloud saving. Until activated, the staged UI truthfully saves on-device and explains the pending isolated store. This is a configuration/approval gate, not completed live cloud verification.

### Production release

Keep main and production unchanged until explicit approval. Before release: activate/verify staged cloud storage if approved, complete authenticated live AI evaluation, inspect browser screenshots, and review the tested branch diff. Release via the existing PR workflow only. Do not delete or migrate browser saves silently. Preserve reviewed FE originals and free-only provider routing.
