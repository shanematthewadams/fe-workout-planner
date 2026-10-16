# Unified FE planner · October 16, 2026

The AI Studio ZIP is an implementation reference. This repository now contains one React app and one Netlify backend, using the existing canonical Workout model. No second app or Express process is deployed.

## Integrated behavior

Builder has Surprise Me, Enter an Idea and Formal Builder. Formal fields cover Q/title, focus, gear, style, terrain and PAX count. Surprise randomizes style/theme and can roll from gear explicitly supplied by Q. All routes feed the existing free-only Gemini/OpenRouter service and the same personal editor/library.

New strict plans reserve 2 minutes for welcome/disclaimer, 8 for Warm-o-Rama, 29 for The Thang and 6 for Mary. Omit Mary to give The Thang 35 minutes. The model returns 43 minutes of physical sections because welcome/disclaimer occupies the other 2. COT is separate, after minute 45. Existing source workouts retain original timing; the field timer warns when a plan differs from the strict schedule. Legacy requests without strictSchedule retain the old contract.

Provider requests have a 20-second total deadline. New strict generation falls back to a deterministic labeled template on provider failure; refinement errors preserve the existing draft rather than replacing it with a template. Offline templates do not promise to fulfill every theme/focus/gear request. No paid-provider fallback was added. Server keys remain on Netlify, including production/preview contexts confirmed by masked metadata.

Field timer has elapsed/practice and live local 5:30 AM modes, the 6:15 hard stop, 5/10 minute fellowship, four-count cadence, whistle and optional screen wake lock. Wall-clock math catches up after backgrounding. Timer state is saved per workout. Live countdown cannot be paused. Audio in background/locked mobile browsers is not guaranteed; keep the screen visible. Real mobile-device audio has not been verified.

Studio reference descriptions and types were imported selectively. The exported sample workout, incorrect Santa Fe/Fort Marcy presets, Express server, hardcoded anonymous key and open table-write helper were not shipped. IPC is labeled inspired unless using an exact published benchmark. The nine source-checked exercise references remain distinct from the larger Studio field guide; imported guide prose is not claimed independently verified against official descriptions.

Plan has the timeline, disclaimer/COT, Slack Q-sheet copy and existing printing. Editor, independent source copies, backup validation, storage recovery, favorites and stale-tab protection remain. Studio JSON arrays can be imported through the existing backup review dialog; original JSON is retained within validated notes. A Saved-screen action imports old Studio cloud rows as copies. At inspection the live beatdowns table held zero rows. Local AI Studio browser data is on another origin and cannot be read automatically.

## Cloud sync

Saved > Enable cloud sync generates a random 256-bit private capability. Download the private sync code and enter it on another device. No signup or OAuth. Anyone with this code can read/change the associated cloud plans; it is a credential, not an encryption key. The server stores its SHA-256 hash, not the code. Exported FE backups do not include this credential; download it separately. Cloud sync is explicit via Sync now, and local saves remain available offline. Clearing storage without keeping the sync code loses access to that cloud collection.

The public RPC is SECURITY INVOKER and calls a capability-checking SECURITY DEFINER helper in non-exposed fe_private schema, with empty search_path. The private table has RLS, explicit deny policy, and no anon/authenticated table grants. Bounded personal-only payloads and unique IDs are checked server-side; full Workout validation is also performed in the app. The helper is intentionally executable by browser roles internally, but its schema is not exposed through the Data API. No service key is needed in a client. Three-way merging propagates nonconflicting edits and deletions; conflicts retain separate copies. Snapshot version compare-and-swap prevents concurrent cloud overwrites. Other-tab local changes block stale local writes. Sync retains the old baseline on failure so it can be retried.

`docs/plan-sync.sql` is the fresh-install reference, tested with PGlite. Supabase apply_migration returned Invalid or expired requestState twice without applying changes. The SQL connector then applied the transaction; a follow-up moved the helper/table into fe_private. No workout rows were deleted or rewritten. Legacy beatdowns browser mutations were revoked; public read remains for explicit import of original Studio records. The existing approved/published workouts catalog remains read-only and unchanged.

Security advisories were checked after applying the schema and the explicit deny policy. Live anonymous-role transactions checked private-code separation and stale-write rejection and rolled back all test data. Isolated Postgres additionally checks direct-table denial and invalid payloads. Official function guidance: https://supabase.com/docs/guides/database/functions .

## Offline and deployment

The build generates a revisioned service worker that precaches HTML, bundled JS/CSS/fonts. It ignores API and Netlify-function requests and does not cache Supabase traffic. Load once while online and allow installation before park use. Navigator online status does not imply AI/cloud availability. A blocked worker leaves the loaded app/local saves functional but cannot guarantee offline reload.

Public Supabase build variables now apply to preview and production. The Netlify function no longer rejects production and preview contexts. Team-only site protection remains unchanged. The original F3Nation import scripts, permissions, 25 reviewed backblasts, ten starters, source hashes and AO snapshots remain intact.

## Verification

112 automated tests passed before final release checks; full latest results are recorded in the release commit/CI. TypeScript, lint and production build pass. Chromium at 390 and 1365 pixels checks formal builder, offline template, plan and timer. Built-app service-worker reload with network disabled shows all 35 library cards with zero page errors and no horizontal overflow. This is real offline browser verification, not a fixture assertion. Device-specific iOS background audio remains unverified. Native clipboard and physical printer output depend on browser permissions/device support.
