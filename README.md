# The FE Workout Planner

A phone-first workout library for F3 The FE. Browse without signing up, copy a plan, make it yours, and take it into the gloom.

## Run locally

Requires Node.js 22 and npm.

```sh
npm ci
npm run dev
```

Open the address Vite prints. No API key or database setup is needed.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run preview
```

## What works

- Ten clearly labeled original illustrative starters, searchable and filterable by duration, equipment, running, and format.
- Details with Warmup, The Thang, optional Mary, counting conventions, estimated section timing, adaptation notes, and provenance.
- Independent personal copies, explicit saves, editable sections/ordered blocks/exercises/counts/units/sets/instructions, and favorites.
- Create from scratch or paste exact raw notes; download original notes independently of backup validation. The app does not automatically interpret them.
- Editor timing summary shows missing estimates, remaining time, or blocks exceeding the session estimate. Equipment names retain typed spaces and custom equipment appears in filters.
- Large-text Q view and a plain print layout, including a The Thang-only print choice.
- Version 1 JSON backups, validated before import; explicit confirmation and no silent overwrite. Conflicting IDs create new personal copies. Favorites combine by ID (a conflicted favorite continues to refer to the existing workout).
- Browser storage failures report an error, keep open changes, and support exporting the open draft. Invalid stored data is not overwritten until explicitly unlocked after a recovery download.
- A read-only Supabase adapter with bundled fallback. It is unconfigured by default. No existing database was changed.

## Personal data and backup behavior

Drafts and favorites are saved only to the current browser on the current device. They do not sync. Clearing site data, private browsing, storage limits, or changing devices can remove or hide them. Export backups and import them on another device. Open edits require an explicit Save workout; leaving unsaved edits prompts before navigation. Save & view workout opens the saved detail for Q view or printing. Other-tab changes block stale writes; load the latest saved workouts to preserve open edits as a separate recovered copy. Export includes the open draft if valid. Backups allow at most 200 personal workouts, 500 favorite IDs, and 5 MB. Original notes are capped by validation at 20,000 characters; longer text stays open but cannot be saved or exported until shortened. Original notes can also be downloaded as exact plain text, including notes too long for a valid draft backup. There is no automatic parsing or AI.

## Development and hosting

Private repository: https://github.com/shanematthewadams/fe-workout-planner
Development branch: `develop`. The application source was uploaded and the branch verified at implementation commit `5ce28ad5ae479395e240577e274906468f9fb1ad`. Its tree `3ff7bc7420aac1bc179fd011eb18574858e10474` exactly matches the tested local snapshot. Later implementation commits are recorded in docs/SPRINT_HANDOFF.md. `main` retains the original starter README at `f293071740044c1f9b700e5bc70d9ee6cf28ce2a`.

Development preview: https://develop--fe-workout-planner.netlify.app/

Netlify project: `fe-workout-planner`; site ID: `1d2480e0-3891-41db-9574-61cb13b7ae0a`. The dedicated project is linked to this private repository. Production branch remains `main`; only `develop` is enabled as an additional branch deploy. No production application or custom domain has been published. The preview remains private to the Netlify team and may ask for Netlify sign-in; the app itself has no consumer account requirement.

Build: `npm run build`; publish: `dist`; Node 22. Settings, SPA fallback, and headers are in `netlify.toml`. `.netlify` is ignored so local site linkage is never committed. No secrets or paid upgrades were added. Push development changes to `develop` and verify Netlify's branch deployment; keep production promotion for launch.

## Verification limits

47 automated data, adapter, and UI interaction tests pass locally. Lint, TypeScript, and the production build pass. See the handoff for commit-specific GitHub Checks and deployment evidence. The deployed preview was opened in a real cloud browser. Desktop library/detail/Q layouts and filters, empty states, copy/edit/save/reload, favorite persistence, exact raw notes, backup export/reimport/conflict behavior, and omitted Mary were checked successfully. The original library source remained unchanged after editing a copy.

The browser controls did not provide reliable mobile viewport resizing or native print-dialog output. Those checks remain outstanding. Independent print-stylesheet inspection used actual deployed workout markup, WeasyPrint and Poppler: the sample full plan and one-page The Thang-only output were visually inspected, and orphan headings were fixed. Native browser print appearance is not claimed verified. Supabase is unconfigured and its SQL has not been run against a real project. Do not promote to production until outstanding checks pass.

## Next sprint

See `docs/SPRINT_HANDOFF.md`, `docs/SOURCES.md`, and `docs/DATABASE_ADAPTER.md`. Regional backblast imports are Sprint 2; live AI and idea/Surprise me starting paths are Sprint 3. No national catalog import is required to use Sprint 1.
