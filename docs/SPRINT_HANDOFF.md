# The FE Workout Planner · Sprint 2 handoff

October 16, 2026 (UTC). Product manager: Shane Adams. This document supersedes the Sprint 1 checkpoint; earlier evidence remains in Git history.

## Actual result and scope impact

**Sprint 2 infrastructure is implemented and development-deployed. The regional collection target is blocked, not complete.**

- Usable illustrative starters: **10**, all unchanged source IDs and still explicitly illustrative.
- Reviewed real FE backblast workouts: **0**. No regional workout was fabricated to reach 20–30.
- Official FE AO profiles: **16** unique AOs / **17** weekly sessions, from the public official schedule.
- Exercise guide: **9** names verified in visible Exicon CSV, with original concise instructions, aliases, equipment/counting guidance and source links. Bulk national descriptions were not imported.
- Published database records: none; there is **no FE Supabase project**. Repository-backed catalog remains fully functional.

The 20–30 real-workout goal needs authorized narrative access and reuse evidence. This is a content/access dependency, not an engineering estimate that the missing workouts are ready. Sprint 3 should finish the regional collection before dependent AI/library expansion work.

## Exact repository, branch and deployment

- Private repository: `shanematthewadams/fe-workout-planner`, ID `1421135917`.
- Integration branch: `develop`; application commit **`f15640bab9acbbae6f12efc76f9d963f2125b59c`**.
- Application tree: **`2d287907ea0c2ec6ab6e9916285564f2bc741dfe`**. It exactly matches locally tested commit `ecace45754bf1dee836f716627b5ee1b2dfcffa5`. As in Sprint 1, local and GitHub ancestry differ because upload uses Git Data; tree parity is verified before ref updates with an expected-head lease.
- Initial inspected remote head: `275c3477e1aaeb1527418c47d08cf4cfb6fdeb0e`, tree `8aa0b65c13e94dd16db7f1b25b776736a14d9b43`, exactly matching the initial clean local tree.
- This handoff is a later documentation-only commit; the exact application/deployment SHA above is authoritative. The documentation commit uses `[skip netlify]`; deployed app files are unchanged. The commit containing this file is the documentation head (a file cannot contain its own commit SHA).
- Netlify project: `fe-workout-planner`; site ID **`1d2480e0-3891-41db-9574-61cb13b7ae0a`**; team ID `6a8d98d0bae1a4d6a86f48de`.
- Development preview: **https://develop--fe-workout-planner.netlify.app/**.
- Verified ready deploy: **`6ad18daa1654730b8cb1fd5f`**; build **`6ad18daa1654730b8cb1fd5d`**, `branch-deploy`, branch `develop`, commit matches the application SHA, no error, no secret-scan matches.
- Immutable preview: https://6ad18daa1654730b8cb1fd5f--fe-workout-planner.netlify.app.
- Deploy record: https://app.netlify.com/projects/fe-workout-planner/deploys/6ad18daa1654730b8cb1fd5f.
- Deployed script **`/assets/index-DpxYatG7.js`** matches the locally built artifact; CSS `/assets/index-BeB5N7Fm.css`.
- Netlify's project-summary adapter returned an incorrect/incomplete branch deploy reference. The real deploy ID was read from the authenticated Deploys UI, then confirmed through the scoped deploy API with state `ready` and full SHA. Do not use the summary's synthetic-looking branch ID as evidence.
- GitHub Checks passed: https://github.com/shanematthewadams/fe-workout-planner/actions/runs/38841289604 (63 tests, lint and build in CI).
- Production branch remains `main` at `f293071740044c1f9b700e5bc70d9ee6cf28ce2a`, starter README only. No production promotion, DNS change, purchase, duplicate hosting/database project or With/Elsewhere modification occurred.
- Hosting retains Netlify team sign-in on all deploys. The app itself has no consumer sign-in. Engineering's browser session was restored through secure Google sign-in and the actual preview inspected. No access controls were weakened.

## Sprint 1 gaps addressed before publication work

The initial handoff accurately left mobile, native browser print and final editor inspection open. These were not assumed complete.

- Local **Chromium 153** at **390px and 1365px**: library, combined source filters, AO detail/link-to-workouts, exercise alias search, workout detail, Q view, editor, copy/save/view/reload and original-source isolation passed; no horizontal overflow or page errors.
- Screenshots of phone/desktop library, AO, Q and editor inspected. Source status and expanded filters wrap on phones. The Barlow Condensed / DM Sans styling remains.
- Chromium's native print engine generated the full representative workout in **3 US Letter pages** and The Thang-only in **1 page**. All pages rendered through Poppler and inspected; readable plain output with no clipping. Text assertions confirm Warmup/Mary/source notes are retained in full output and excluded in Thang-only output. This is actual Chromium print-to-PDF, not the earlier independent WeasyPrint approximation. Safari and physical-printer output remain unverified.
- Deployed browser verified zero reviewed regional workouts / ten starters, regional-status empty state, AO search and exact source AO filtering, and exercise alias/source-link behavior. No shared catalog write or existing personal draft mutation was needed for this deployed smoke test.

QA outputs are temporary ignored files under `qa/sprint2`, not deliverables or repository data. The browser dependency used for QA was installed in scratch only, not the application bundle. A direct Playwright browser download failed; npm-packaged Chromium enabled the completed local browser checks.

## Implemented boundaries and repeatable workflow

- `scripts/nation-adapter.ts`: admin-only GET adapter, fixed official HTTPS origin, Client + Bearer headers, 15-second per-request timeout, region/identity/privacy validation, documented 100-row zero-based pagination, duplicate prevention, incomplete/repeated/changed-page failure, 1,000-page safety cap. No browser import route or shared-write path exists.
- `scripts/catalog-import.ts`: strict workout-only export format; stable IDs; canonical SHA-256 fingerprints; idempotent merges; changed content invalidates review; explicit archival; current-hash approval requires reviewer, privacy attestation, reuse evidence and The Thang. Missing Q/AO/date/sections/time/equipment/running are recorded as source notes. Exercise order, reps and counting text remain verbatim, not guessed into structured counts.
- `scripts/import-catalog.ts`: candidates and review registry stay in ignored `.imports/`, mode 0600 files / 0700 directory, atomic writes. Extraction retains recognized workout sections only; privacy review is still mandatory because personal material may occur inline. No raw backblast, attendance, prayer request, health disclosure, contact list or AI submission is stored in GitHub.
- Only approved non-archived originals export to `data/regional-workouts.json`. Current checked-in export is `[]`. Source changes/reuse changes/archive changes require a new review. Missing records or outages do not delete existing records. A second identical import does not duplicate or invalidate review.
- Browser storage key `fe-planner:v1` and backup version 1 remain unchanged. Personal copies retain independent IDs/content and lineage. Import/refresh never reads or replaces personal storage.
- Public search now includes exercise names, Q and AO plus source-status and source-AO filters. Provenance distinguishes illustrative starters, reviewed originals and personal adaptations; missing imported Mary is reported as missing, not claimed omitted.
- `scripts/sync-aos.mjs`: repeatable public official-schedule snapshot, 16 stable name-derived AO IDs, timestamps and fail-without-replacement on malformed structure. `data/ao-local.json` is separate; all terrain, distances, lighting, coupons and weather alternatives are currently unknown. No inference from AO names. AO names changing upstream require explicit ID migration.
- Read-only Supabase adapter retains the bundled snapshot on upstream failure; no persistent personal data leaves the browser. The snapshot is dated, not a claim of live upstream freshness.

## Commands and schema / migration path

Node 22.18+ or 24; npm. Engineering owns these commands.

```sh
npm ci
npm test
npm run lint
npm run typecheck
npm run build
npm run catalog:sync-aos
node --env-file=.env.import --experimental-strip-types scripts/import-catalog.ts nation START_DATE END_DATE
npm run catalog:import -- merge /absolute/path/to/workout-only-export.json
npm run catalog:import -- approve SOURCE_ID CURRENT_SHA256 'Reviewer name'
npm run catalog:import -- export
npm run catalog:export-sql
node scripts/export-seed.mjs
```

See `docs/IMPORT_WORKFLOW.md` for exact format, review safeguards and secure configuration. `npm run dev -- --host 127.0.0.1` works around this environment's network-interface enumeration error with the default 0.0.0.0 host.

No database migration was applied to any connected project. A future dedicated FE project's fresh install uses `docs/catalog-schema.sql`, then optional `docs/starter-seed.sql`. SQL enables RLS, revokes browser/public writes, grants public SELECT only, requires approval before publication and limits published statuses. Service-role access is server/admin only. Regional publication SQL is generated into ignored `.imports/publish.sql`: withdraw managed regional rows, then upsert reviewed originals under unchanged IDs in a transaction. Unmanaged rows are not overwritten. Keep repository snapshot withdrawals synchronized with database publication.

The SQL is executed in an isolated PGlite/Postgres test with separate anon/authenticated roles: unpublished/unapproved rows hidden, anonymous/authenticated INSERT/UPDATE/DELETE denied, invalid JSON/publish-without-approval rejected. This is **not** a live Supabase Data API or credential test.

## Source findings and remaining access

Full findings: `docs/SOURCES.md`. All 23 visible F3-Nation org repositories were inspected beyond pinned projects. f3-nation, Website-Widgets, the-codex and pax-vault are unarchived and recently pushed. The monorepo is AGPL-3.0; no repository license was detected for the other three. No upstream code or bulk description content was copied. Software licensing does not establish rights to underlying backblasts.

Live `https://api.f3nation.com/docs/openapi.json` confirms `pageIndex` / `pageSize` maximum 100 and detail `/v1/event-instance/id/{id}`; older widget `limit`/`hasBackblast` examples differ. Upstream handler includes narrative fields in details, while lists are metadata. Unauthenticated requests return 401. The development-build probe now authenticates successfully: 143 regional event records in the last 45 days; three sampled public, active event details all match event/region/privacy fields and include nonempty plaintext and rich narratives plus recognized workout headings. Only counts/status were logged, never narrative text. This verifies access and sampled detail shape, not narrative completeness, exact counts/order, Q mapping, or the complete paginated importer. Q remains unknown, not inferred from attendance.

Current upstream API README identifies **https://admin.f3nation.com/api-keys** → **New API Key**. Older widget documentation points to map admin region ID and Settings → API. Current credential UI instructions are code/documentation-verified, not a logged-in F3 admin walkthrough. API keys have per-org Editor/Admin assignments; do not request Nation-wide access. This connector performs GET requests only.

Smallest secure action: Shane can put `F3_NATION_TOKEN` (secret) and `F3_REGION_ID` into the **existing FE Netlify project**, development-branch context, server-only Functions scope, never `VITE_*` and never chat. This does not automatically activate sync or publication; engineering must securely load those values into the admin process, inspect an actual FE detail response, obtain content reuse authorization and review sanitized workout sections. An authorized workout-only export can use the same merge/review path if live narratives are absent. Private Slack content needs separate reuse permission; no Slack reads/posts were made.

Public FE schedule/AO pages were available. The RSS feed contained no items, the WordPress posts endpoint returned 404, and focused public searches found no complete reusable regional narratives. IronPAX and national descriptions were not substitutes for regional source material.

Connected Supabase inventory has only With Application; it was not reused or queried. If persistent publishing is desired, Shane must select/authorize a dedicated FE project and its organization/cost; none is assumed or purchased. Until then, the repository catalog is the supported fallback, not a simulated live database.

## Verification summary and Sprint 3 priorities

- **63 automated tests pass** across model, UI, source import, pagination, discovery, repository adapter and isolated database policy checks.
- Lint, TypeScript/Vite build, `git diff --check`, reviewed-source empty export and SQL generation pass.
- Real local mobile/desktop Chromium and print verification pass as detailed above; deployed build identity and representative interactions live-verified.
- **Implemented with synthetic fixtures:** full paginated F3 Nation importer, narrative extraction/review lifecycle and changed-source/archive cases. Authenticated access and three real list/detail reads are now live-verified through the private development build.
- **Live verified:** public source/API documentation, AO source retrieval/snapshot, GitHub CI, Netlify develop deploy/commit/artifact and browser smoke checks.
- **Still blocked:** real FE backblast collection and fidelity comparisons, narrative completeness, content reuse permission, dedicated Supabase project and live REST/RLS checks. Zero real extracted cards means no original-versus-card comparison can yet be claimed.

Sprint 3: (1) unlock authorized narrative access and establish reuse evidence, then curate 20–30 distinct usable cards where sources permit; (2) verify live response schema, Q/AO/date mapping, counts/order and updates/archival with actual sources; (3) optionally provision dedicated Supabase only after project/cost authorization, apply schema and live-test public reads/denied writes; (4) retain personal draft/backup compatibility and independent copies while expanding the library. Defer production promotion, DNS and dependent live AI work until these foundations are trustworthy.

## Credential configuration follow-up · October 16 UTC

Shane confirmed both Netlify variables are saved. Connector metadata confirms the token is secret, available in branch-deploy context, and scoped to Builds/Functions/Runtime; the numeric region ID is configured. The token also has other deploy-context values; no production code uses it, and the new diagnostic explicitly skips production and other branches. Metadata reads conceal the actual credential, so a request made with the masked representation is inconclusive and must not be reported as an invalid key.

Added `scripts/nation-probe.mjs` and a development-only postbuild entry point to check API access from Netlify's server build environment. It prints only status/counts/narrative-availability flags. No raw backblast or credential is logged or saved, no public API endpoint is added, and no record is published. The build check needs Builds scope (present in current configuration), in addition to the previously described Functions scope. Source collection and reuse approval remain separate. Live result: `FE_SOURCE_PROBE {"status":"ok","totalEvents":143,"sampledPublicEvents":3,"detailReads":3,"plaintextNarratives":3,"richNarratives":3,"recognizedWorkoutSections":3,"detailFailures":[]}`. Netlify deploy `6ad18daa1654730b8cb1fd5f`, build `6ad18daa1654730b8cb1fd5d`, commit `f15640bab9acbbae6f12efc76f9d963f2125b59c` is ready; 48 files scanned, no secret matches. GitHub CI passed with 63 tests. Frontend artifacts are byte-identical to the prior verified build; no UI/personal-storage changes were made. Remaining material decision: which backblast instructions the content owners authorize for publication. Credential entry alone does not authorize reuse. Full privileged import/review retrieval still needs a secure server/admin path; do not attempt to use a masked token in the local CLI.

## Approved FE collection follow-up · October 16, 2026

Shane explicitly approved FE backblast reuse: “Fe backblasts approved.” Approval is recorded in `data/source-permissions.json` and covers workout instructions and supported Q/AO/date provenance; unrelated personal content remains excluded. Reuse permission is no longer a blocker and must not be requested again.

- Latest collector application commit on GitHub `develop`: `42c6a8604da0761f4ef34180424cf5f93f62f564`; tree `31f01bc05b0dff3e1059a0aebfda2ca48d064540`, exactly matching local commit `03f93c1`.
- GitHub CI passed: https://github.com/shanematthewadams/fe-workout-planner/actions/runs/38883657031.
- Local checks: 63 tests pass when run serially, lint passes, TypeScript/Vite build passes, diff check passes. First parallel test attempt had one existing UI test timeout on the slow local host; serial rerun passed without changing assertions or timeout limits. Frontend JS/CSS artifacts are unchanged.
- `scripts/collect-nation.ts` runs only in the existing FE develop branch build, uses the paginated read-only adapter and produces an unreviewed workout-section export under ignored `.netlify/blobs/deploy/fe-review/candidates.json`. Netlify file-based uploads target a private deploy-specific store, not `dist` or GitHub. Whole narratives are not saved; candidates with detected personal/ambiguous section content are conservatively excluded. Exact section order/count text is preserved for review; normalized section hashes suppress exact-content duplicate events. No card is automatically approved/published.
- Collection deployment status, private export count and stored bytes are **not yet verified**. Netlify's summary connector again supplies an unusable deploy reference; do not infer ready state or a candidate count from it. The authenticated dashboard is needed to inspect the true deployment ID and retrieve the private file.
- The engineering browser's Netlify session expired. The secure browser-auth request timed out, and a fresh canonical dashboard navigation still showed Log in. No credential failure or API-token problem was established. No password/token should be pasted into chat, and access protections must remain in place.
- Published real FE cards remain **0**; illustrative starters remain **10**. Personal drafts and source IDs remain untouched. No Supabase/With/Elsewhere resources or production/DNS settings were changed.

Next exact steps: restore the engineering cloud browser's Netlify session through secure/manual sign-in; inspect develop deployment for `42c6a86`, read the `FE_PRIVATE_REVIEW_EXPORT` summary and verify the private store upload; retrieve the candidate JSON through **Data & storage → Blobs**, keeping it in ignored `.imports`; inspect workout-only sections for fidelity/privacy and curate 20–30 distinct usable originals if the sources permit. Then merge, approve exact hashes, export to the repository catalog, verify representative cards against retained source sections, run catalog regressions/mobile/print checks, push/deploy develop and update this handoff. If private export fails, read the actual build logs before changing the adapter. Do not claim this collector is live-verified until those steps succeed.
