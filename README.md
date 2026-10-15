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
- Create from scratch or paste exact raw notes; the app does not automatically interpret them.
- Large-text Q view and a plain print layout, including a The Thang-only print choice.
- Version 1 JSON backups, validated before import; explicit confirmation and no silent overwrite. Conflicting IDs create new personal copies. Favorites combine by ID (a conflicted favorite continues to refer to the existing workout).
- Browser storage failures report an error, keep open changes, and support exporting the open draft. Invalid stored data is not overwritten until explicitly unlocked after a recovery download.
- A read-only Supabase adapter with bundled fallback. It is unconfigured by default. No existing database was changed.

## Personal data and backup behavior

Drafts and favorites are saved only to the current browser on the current device. They do not sync. Clearing site data, private browsing, storage limits, or changing devices can remove or hide them. Export backups and import them on another device. Open edits require an explicit Save workout; leaving unsaved edits prompts before navigation. Export includes the open draft if valid. Backups allow at most 200 personal workouts, 500 favorite IDs, and 5 MB. Original notes are capped by validation at 20,000 characters; longer text stays open but cannot be saved or exported until shortened. There is no automatic parsing or AI.

## Development and hosting

Private repository: https://github.com/shanematthewadams/fe-workout-planner
Development branch: `develop`. The application source was uploaded and the branch verified at implementation commit `5ce28ad5ae479395e240577e274906468f9fb1ad`. Its tree `3ff7bc7420aac1bc179fd011eb18574858e10474` exactly matches the tested local snapshot. A subsequent documentation-only commit updates this status. `main` retains the original starter README at `f293071740044c1f9b700e5bc70d9ee6cf28ce2a`.

Netlify hosting has **not** been deployed. No FE project was found in the connected inventory. The available tools expose project creation/read operations but no Git repository linkage, branch configuration, or build-file upload operation, and no CLI deploy credentials exist. No preview URL is claimed.

Hosting setup must connect a **new** Netlify project to this repository, use `npm run build` and `dist`, keep `main` as the eventual production branch, and enable `develop` as a branch deployment. Application code must not be promoted to main in Sprint 1. Since main contains only a README, its application build cannot succeed; the intended working app is on develop. Use a draft deploy or the develop branch deployment rather than changing the production branch to develop. `netlify.toml` includes build settings, Node version, SPA fallback, and basic headers. `.netlify` is ignored so local site linkage is never committed. Branch previews are shareable by link unless access controls are separately configured.

An authenticated Netlify CLI can instead create a draft with `npm run build` followed by `netlify deploy --dir dist` (without `--prod`) against a dedicated FE site. The earlier delivery package includes built static files, but that package itself is not a hosted preview. Never paste a personal deploy token in chat.

## Verification limits

Automated data, adapter, and UI interaction checks are in `tests/`. Build, type, lint, and test results are recorded in `docs/SPRINT_HANDOFF.md`. UI tests use jsdom; they are not a real browser layout check. The provided cloud browser rejected the internal preview URL with `net::ERR_BLOCKED_BY_CLIENT`. Narrow mobile/desktop screenshots and rendered print/PDF inspection remain unverified, as does a live Netlify preview. Do not promote to production until those checks pass.

## Next sprint

See `docs/SPRINT_HANDOFF.md`, `docs/SOURCES.md`, and `docs/DATABASE_ADAPTER.md`. Regional backblast imports are Sprint 2; live AI and idea/Surprise me starting paths are Sprint 3. No national catalog import is required to use Sprint 1.
