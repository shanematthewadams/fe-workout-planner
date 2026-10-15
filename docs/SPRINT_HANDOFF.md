# Sprint 1 handoff · The FE Workout Planner

October 15, 2026. Product manager: Shane Adams. This is the current handoff and supersedes the earlier local-only delivery notes.

## Repository and hosting

- Private repository: https://github.com/shanematthewadams/fe-workout-planner
- Repository ID: `1421135917`; integration branch: `develop`.
- Original application upload: `5ce28ad5ae479395e240577e274906468f9fb1ad`. Its tree `3ff7bc7420aac1bc179fd011eb18574858e10474` exactly matches the tested local snapshot at `e82086a446e4b7f7f10bdcee3ecfa83bb71ef9aa`. Different commit IDs reflect the new repository's initialized main parent, not different app files. Earlier local history is preserved in the delivered Git bundle.
- Verified deployed commit: `9a514045d293743a44c45f90a2287d5cab5946b3` (application unchanged; later changes are handoff/README only). A tracked handoff cannot include its own final commit SHA; obtain the latest documentation SHA from develop's head.
- Netlify project: `fe-workout-planner`; site ID: `1d2480e0-3891-41db-9574-61cb13b7ae0a`.
- Netlify team ID: `6a8d98d0bae1a4d6a86f48de` (shanematthewadams).
- Dashboard: https://app.netlify.com/projects/fe-workout-planner
- Verified working branch preview: https://develop--fe-workout-planner.netlify.app/
- Verified ready deploy: `6ad119747eabb5506a39a5c8`; build ID: `6ad119747eabb5506a39a5c6`; context: `branch-deploy`; framework: Vite; no deploy error; secret scan found no matches.
- Immutable preview: https://6ad119747eabb5506a39a5c8--fe-workout-planner.netlify.app
- Production branch remains `main` at `f293071740044c1f9b700e5bc70d9ee6cf28ce2a` (starter README only). Additional branch deploys: `develop` only. No app promotion, custom domain, purchase, or upgrade occurred. Existing Elsewhere and With resources were untouched.
- Both preview and production visibility remain private to the Netlify team. Opening the preview may require Netlify sign-in. This is a hosting gate; the app itself has no consumer login or OAuth. Do not weaken access controls without approval.
- No FE Supabase project was provisioned; no FE project ID exists. The original connected inventory contained only With Application, which was not reused. Organization/cost approval is needed before provisioning a dedicated FE project.

## Run and validate

Requires Node.js 22 and npm. No credential or database is needed for the bundled catalog.

```sh
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm run preview
```

Netlify build: `npm run build`; publish: `dist`; Node 22. The repository includes netlify.toml, headers, SPA fallback, .env.example, and a GitHub check workflow. `.netlify` and local environment files are ignored.

| Verification                                      | Result                                                                                    |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| ESLint and TypeScript                             | Pass                                                                                      |
| Automated tests                                   | 31 pass across model, UI, and adapter tests                                               |
| Vite build                                        | Pass                                                                                      |
| Dependency audit after pinned tool updates        | Zero vulnerabilities                                                                      |
| GitHub Checks on application upload               | Pass: https://github.com/shanematthewadams/fe-workout-planner/actions/runs/38781816991    |
| Netlify develop deployment                        | Ready; commit and deploy IDs above                                                        |
| Real deployed desktop library/detail/Q inspection | Pass at the available approximately 1363 CSS-pixel viewport                               |
| Deployed interaction checks                       | Pass as described below                                                                   |
| Narrow mobile viewport inspection                 | Not verified; available browser controls did not expose reliable resizing                 |
| Rendered print/PDF inspection                     | Not verified; print action and checkbox were exercised but no rendered PDF was obtainable |
| Live Supabase query and RLS checks                | Not configured; prepared SQL has not been applied                                         |

Deployed browser checks: all ten starters rendered; Coupon equipment filtering returned one workout; an unmatched search displayed the empty state; reset restored the library. Favoriting survived reload. Copying created a separate personal draft, title/raw-note edits saved with explicit success, and exact pasted text survived reload. The original source title/content remained unchanged. Q view exposed enlarged text. A no-Mary plan displayed its explicit omission note. Backup export downloaded successfully; importing that exact file required confirmation, retained the existing draft, and reported one conflict kept as a new copy (two personal drafts afterward). The Thang-only checkbox and Print action responded; rendered output remains unverified. QA drafts/favorites exist only in the cloud browser's local storage; no shared catalog was modified.

Model/UI tests also cover malformed/unknown-version/oversized imports, duplicate workout/internal IDs, reserved source-ID conflicts, unknown timing, counting conventions, save failures retaining edits, schema validity, and remote catalog rejection of personal/malformed/duplicate data. UI tests use jsdom, not a browser layout engine.

## Implemented scope

- React/TypeScript/Vite app with monochrome styling informed by f3thefe.com, locally bundled fonts/icons, responsive cards/filters, keyboard focus styles, and no consumer sign-in.
- Ten original illustrative starters covering circuits, 11s, EMOM, AMRAP, ladder, partner, stations, and chipper; 30/45-minute session options, declared equipment/running, and one omitted-Mary plan. No Q, AO, event date or real-world testing history is fabricated.
- Workout details: ordered Warmup, The Thang and optional Mary; estimated section timing; equipment; plain instructions; explicit amounts/units/optional sets/counting; provenance and adaptation notes. Timing includes explanation, recovery, and transitions and is not a safety guarantee.
- Deep-copied personal workouts with fresh IDs and originId, explicit save feedback and reload persistence, favorites, editable titles/sections/blocks/exercises/counts/sets/units/counting/instructions/adaptation notes, and block/exercise ordering. Source workouts cannot be edited through the app.
- Create-from-scratch and pasted-notes path. Exact raw notes stay separate and appear in Q view/full print. No automatic interpretation or live AI.
- Large-text Q mode; plain-background print CSS; option to print only The Thang.
- Local export/import format `fe-workout-backup`, version 1. Imports validate size/schema/IDs and require explicit confirmation. Existing drafts remain; conflicts become new IDs with an imported-copy suffix; favorite IDs are combined. Exports include a valid open draft.
- Browser data is device-specific and can be cleared; the app explains this. Save failures retain open changes. Unreadable stored data is preserved until an explicit recovery/unlock action.
- Read-only catalog repository interface, bundled catalog, optional Supabase Data API adapter with published-only HTTPS reads, validation and 8-second timeout/fallback. Schema and original seed SQL are prepared with RLS and SELECT-only public access. See DATABASE_ADAPTER.md; there is no browser shared-write path.

## Limits and source decisions

- Mobile layout and rendered print QA remain required before launch. The original internal preview address was blocked, but the real Netlify desktop preview is now verified.
- No regional imports, national catalog import, shared/admin editing, cross-device sync, live database, live AI, idea generation, or Surprise me in Sprint 1.
- Backups are limited to 5 MB, 200 drafts and 500 favorite IDs. Text fields, including raw notes, have a 20,000-character validation limit; longer raw text is not silently truncated but cannot be saved/exported until shortened. Same-browser concurrent tabs have no conflict merge.
- All starter plans and descriptions are original illustrative content. See SOURCES.md for checks of the six requested references. No national CSV descriptions, source code, logos, IronPAX workouts or actual backblasts were imported. Public visibility was not treated as reuse permission. Font redistribution licenses are included in public/licenses and the built output.
- Netlify linked the private repository only after Shane approved browser setup. An expired sign-in returned Invalid state key; a freshly approved flow succeeded. No security protection was bypassed or weakened.
- Linking automatically triggered README-only main build `6ad118f751817ebb0b39046d`; it failed and deployment was skipped. A cancel attempt hit a detached control because that build had already finished. The develop preview then built successfully. There is no production app to roll back.

## Next sprint starting point

1. Verify narrow mobile library/editor/Q flows and rendered full/The Thang-only print. Fix findings before production promotion. Keep using develop; preserve personal backup compatibility and source-copy isolation.
2. Sprint 2: get permission for regional backblast imports, preserve raw originals/provenance, mark ambiguous counts/timing, and implement an admin-reviewed publication flow. Provision a dedicated FE Supabase project only after organization/cost approval; apply and live-test the prepared RLS/schema/seed and anonymous read/denied-write behavior.
3. Sprint 3: live AI and idea/pasted-plan/Surprise me starting paths. API credentials must not block the independent library/editor. Keep production promotion and domains for launch.

## Regional styling pass

Shane requested f3thefe.com as the styling reference. The app now uses a black regional header, white background, strong geometric Tektur display headings, monochrome cards/controls, and links to the region and AO schedule. Body instructions retain DM Sans; print headings use Arial. No source data, personal-storage key, backup format, security setting, or production branch changed. Narrow-screen inputs are at least 16px to avoid unwanted mobile input zoom, card text/metadata has been enlarged, long titles wrap, primary copy actions span the phone width, and reduced-motion preferences are honored. Existing 31 automated tests, lint and type/build checks pass on the changed application. Real narrow-viewport inspection remains unavailable through the current browser API.

### Styling deployment and print inspection

The regional styling pass deployed successfully at commit `d6919abbf719635d382f8c0ea8d6762fa4eafc16`, Netlify branch deploy `6ad11cde37186b7504e78127`. The new black header, geometric headings, monochrome cards and regional links were inspected in the live desktop preview.

For print QA, actual workout-detail DOM markup was exported read-only from the deployed app and rendered with the current built stylesheet using WeasyPrint 70.0, then inspected via Poppler PNGs and PDF text/position extraction. This caught an orphan section heading and awkward fragmented header layout; print-specific break rules and stacked timing labels now keep headings with content and avoid timing-label clipping. The final US Letter sample prints the full plan in 3 legible pages and only The Thang in 1 page, without decorative backgrounds. Content assertions confirm The Thang-only excludes Warmup, Mary and source notes, while full print retains them. This supersedes the earlier entirely-unverified print status: independent stylesheet rendering is inspected; native Chrome/Safari print-dialog output remains unverified. Temporary PDFs and page images are QA intermediates, not product deliverables.

### Typography correction · October 15, 2026

Shane rejected the geometric Tektur heading face as unreadable and selected the previously recommended Barlow/DM Sans pairing. Headings now use Google Fonts' Barlow Condensed in semibold/bold, with DM Sans retained for instructions, forms, navigation and controls. The fonts are self-hosted through Fontsource packages; no external Google font request is needed. Tektur and its font assets were removed. Hero headings use sentence case and more relaxed spacing; workout titles remain in sentence case with larger readable type. The regional black/white palette and links remain. No data model, local draft/favorite storage, backup compatibility, access controls or production branch changed.

### Sprint 1 draft protection · October 15, 2026

Shane confirmed visual verification of the Barlow Condensed / DM Sans update at remote commit `4e38b8230f3770b3825dea2fd165024672603004`. GitHub Checks passed for that commit. This acceptance does not assert separate narrow-mobile or native-browser print testing.

The next increment protects against stale saves across tabs. A storage event warns when another tab changes or clears saved data. Each write also checks the saved snapshot before proceeding, so a delayed/missing event cannot silently replace a newer snapshot. The user can export current work or load the latest saved workouts; loading keeps any open editor contents as a separate unsaved recovered copy with a fresh identifier. Latest favorites and drafts are retained. Malformed latest data leaves the current editor and stored bytes untouched. Backup version and storage key remain unchanged.

Validation: 34 tests pass, including stale-save rejection before a storage event, recovery of open edits without changing the other tab's saved workout, preservation of latest favorites, storage clearing, and malformed external data. Lint and TypeScript/Vite build pass. Local storage offers no atomic multi-tab transaction; this is stale-snapshot detection/recovery, not a cross-tab merge or cross-device sync. New warning UI still needs live preview inspection. Production remains untouched.
