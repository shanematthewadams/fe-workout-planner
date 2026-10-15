# Sprint 1 handoff · The FE Workout Planner

Date: October 15, 2026. Product manager: Shane Adams.

## Repository and resource evidence

- Local checkout: `/workspace/scratch/c9d8a5aee5d8/fe-workout-planner`
- Branch: `develop`
- Full implementation commit: `fc12d29fbcdf7773c5c3862411068383a87087ca`
- This handoff is a subsequent documentation-only commit. `git log -1` and the delivery package's `DELIVERY.txt` identify the packaged final commit, avoiding a self-referential commit hash in a tracked file.
- Remote repository: **not created; not pushed**. Requested destination is a new private `shanematthewadams/fe-workout-planner`; that name is proposed, not a verified account resource.
- Discovery: connected GitHub inventory returned only health-tracker and elsewhere; the workout repository search returned no matches. Workspace began empty, with no applicable repository instructions. No existing repository was reused.
- Netlify: no FE site found in connected project inventory. **No FE site ID, deploy ID, or hosted preview URL exists. No deployment was attempted or claimed.** Connector exposes project creation and read operations but no deploy-file upload; no CLI auth credentials were present. Existing sites were untouched.
- Supabase: no FE project found. Only With Application was returned; it was not read beyond project discovery or changed. **No FE Supabase project ID exists.** Provisioning requires organization selection and cost confirmation; the complete UI uses the catalog fallback instead of blocking. No purchases/upgrades.
- A Git bundle preserves local commits. The source ZIP includes that bundle, the full project, and a separate ZIP of built static files. No node_modules or credentials are packaged.

## Setup and checks

Node.js 22 recommended; install the pinned packages from the lockfile:

```sh
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm run preview
```

No API key, sign-in, OAuth, or database is needed. Optional public database configuration is described in `.env.example` and `docs/DATABASE_ADAPTER.md`. GitHub Actions is prepared to run lint, tests, and build when a remote is connected; no remote check runs are claimed.

Final checks on the implementation commit:

| Check                                  | Result                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------- |
| ESLint                                 | Pass, zero errors                                                       |
| TypeScript                             | Pass, including the `tsc -b` build stage                                |
| Vitest                                 | 31 tests pass across 3 test files                                       |
| Vite production build                  | Pass; static output in `dist/`                                          |
| npm audit                              | Zero vulnerabilities after updating Vite, Vitest, and typescript-eslint |
| Git whitespace check                   | Pass                                                                    |
| Real mobile/desktop layout inspection  | **Blocked / not verified**                                              |
| Rendered print/PDF inspection          | **Blocked / not verified**                                              |
| Hosted Netlify preview                 | **Not deployed / not verified**                                         |
| Live Supabase query / RLS verification | **Not configured / not verified**                                       |

Tests cover source-copy isolation, reload persistence and raw notes, explicit save feedback and storage failures, favorite persistence, combined filters/reset/empty state, version/shape/size/duplicate import validation, confirmation before import, preserving conflicts as new IDs (including source-ID collisions), optional Mary, unknown timing, declared counts, Q mode and print-only selection, and published-catalog adapter validation/failures. UI tests run in jsdom. They prove interaction/state behavior, not layout or physical print legibility.

Browser QA evidence: the Sites preview supervisor reported `http://terminal.local:4173/`; the cloud browser rejected that address with `net::ERR_BLOCKED_BY_CLIENT`. A local HTTP request also could not reach the supervisor's server. The supervisor was stopped. No screenshots, viewport checks, or rendered PDFs were obtained, and no other browser path was used to work around the block. The print action is wired to `window.print`; media rules omit decorative backgrounds and optionally omit every section except The Thang. Their rendered appearance still needs inspection.

During development, lint/type checks caught unused imports and a test option/signature issue; these were fixed. Dependency audit findings in development tools were fixed through pinned package updates. All final checks above ran after those fixes.

## Implemented behavior

- Welcoming green/cream, mobile-first React/TypeScript/Vite interface with locally bundled fonts, responsive cards and filters, and accessible labels and keyboard focus styles.
- Ten original illustrative starter plans across eight formats, including 30- and 45-minute sessions. A no-Mary plan explicitly leaves five minutes for extra recovery or an earlier finish. Equipment is declared; no wall, hill, stairs, or coupon is silently assumed.
- Full detail view with ordered Warmup/The Thang/optional Mary, section estimates, equipment, running level, plain instructions, counts/sets/units, source status and adaptation notes. Timing is visibly estimated and includes transitions/recovery/explanation.
- Favorites saved per browser. Personal copies deep-clone the source with distinct IDs and an originId; original provenance is retained. Sources are never editable through the UI.
- Explicit personal saves with feedback and reload persistence; section titles, block ordering, exercises, counts, units, optional sets, counting method, instructions, and adaptation notes are editable. Warmup/Mary can be removed or added; The Thang is required. Section order remains Warmup, The Thang, Mary.
- Create from scratch or paste exact notes. Raw notes remain separate and appear in Q view/full print. There is no automatic interpretation.
- Large-text Q view and print action with The Thang-only checkbox. Print stylesheet uses a white page, plain text and exercise row break avoidance.
- Versioned export/import: format `fe-workout-backup`, version 1. Personal drafts and favorites only. Validation enforces a 5 MB file limit, 200 drafts, 500 favorite IDs, field limits, allowed enum values, unique workout/internal IDs and required The Thang. Existing drafts are never silently replaced. Conflicting incoming IDs become fresh IDs with an “imported copy” suffix; favorites union by original ID.
- Export includes the open draft if valid. Unsaved navigation prompts before discarding. Read failures preserve unreadable browser data until the user explicitly unlocks saving after recovery download; save failures keep the open draft. Browser/device-specific storage and clearing risk are explained in the app.
- Read-only catalog repository interface and tested Supabase adapter. Bundled fallback works independently; optional remote catalog has an 8-second timeout, published-only query, schema validation, HTTPS check and duplicate/personal rejection. Prepared SQL enables RLS and grants published SELECT only. SQL and seed were not applied.

## Limits and remaining work

- Required visual and deployed-preview verification is outstanding; Sprint 1 is functionally implemented but not release-verified. Do not promote to production on the strength of jsdom tests.
- No remote repository, Netlify deployment, cross-device persistence, consumer login, shared editing, admin publishing, regional imports, national catalog import, live AI, Surprise me, or idea-to-workout generation.
- Pasted notes have a 20,000-character validation ceiling. Longer text remains open but saving/export validation rejects it until shortened; no automatic truncation or interpretation.
- Local storage has no cross-tab merge or cloud backup. Same-browser concurrent tabs can overwrite each other's last saved local collection; exports are the recovery path. Cross-tab conflict handling is a future improvement.
- Current duration estimates are illustrative and require Q judgment. They are not field-tested or safety guarantees.
- Data API/RLS scripts require live verification in a dedicated FE project before activation.

## Source decisions

See `docs/SOURCES.md` for all six requested reference URLs and current retrieval findings. No external code, national descriptions/CSV entries, real backblasts, F3 logos, or IronPAX plans were imported. F3 Nation's monorepo page lists AGPL-3.0; no license was identified in the retrieved codex/widgets pages. Public visibility was not treated as reuse permission. All starter descriptions are original, and no Q/AO/date/testing history is fabricated. Font license files are included in `public/licenses` and the built output.

## Exact unblock and next starting point

1. Shane opens https://github.com/new under `shanematthewadams`, names the repository `fe-workout-planner`, chooses **Private**, checks **Add a README file**, and creates it. Return the repository URL. An initialized private repository makes source writes available through the existing connection; no PR review is needed merely to transfer source.
2. Push the prepared application to `develop` in that new repository (do not overwrite the initialized main branch or reuse another application's resources). The prepared GitHub workflow should run; verify its actual results. A future connector commit can have a different SHA from the preserved local bundle; record both rather than invent parity.
3. Connect a dedicated Netlify project to that repository. Build: `npm run build`; publish: `dist`. Keep production branch `main`, enable `develop` branch deploys, and do not promote application code to main. If connection setup is not exposed through the connector, Shane must perform that account action. No token needs to be pasted in chat.
4. Obtain and verify the real preview URL, then inspect 360/390px mobile and 1280px desktop: browse/filter/reset, favorite/reload, copy/edit/save/reload, raw note persistence, backup export/reimport, conflict behavior, optional Mary, large-text Q view, and full/The Thang-only print PDF. Fix findings before release.
5. Sprint 2 starts with regional import permissions/provenance and an admin-reviewed publication flow. Provision a dedicated Supabase project only after organization/cost confirmation, then apply/test the prepared schema and seed. Sprint 3 adds live AI and alternative starting paths. Production promotion/custom domains stay in the launch sprint.

## GitHub connection update · October 15, 2026

This section supersedes the earlier repository-creation blocker and steps 1–2 of the earlier unblock list. Those paragraphs describe the original local-only delivery.

- Verified private remote: https://github.com/shanematthewadams/fe-workout-planner
- GitHub repository ID: `1421135917`.
- Verified uploaded development implementation commit: `5ce28ad5ae479395e240577e274906468f9fb1ad`.
- Verified implementation tree: `3ff7bc7420aac1bc179fd011eb18574858e10474`, identical to the tested local handoff tree at `e82086a446e4b7f7f10bdcee3ecfa83bb71ef9aa`.
- The remote commit is parented to the new repository's initialized main commit `f293071740044c1f9b700e5bc70d9ee6cf28ce2a`. The original local commits remain preserved in the earlier Git bundle; their different commit SHAs are intentional, while source tree parity was verified.
- `develop` was created at that uploaded commit. `main` was not changed. There were no remote AGENTS.md instructions; the initialized repository contained only README.md.
- This status update is a later documentation-only commit on develop. Its final SHA can be obtained from the branch head; a tracked handoff cannot contain its own commit SHA.
- Initial GitHub Actions query after branch creation returned zero runs. The following documentation ref update should trigger the prepared push workflow; its real status must be checked before claiming remote CI success.
- Netlify discovery again returned no FE project. No Netlify identifiers/preview URL exist; no site was created or deployment claimed. Repository linkage, branch configuration, and file upload remain unavailable through the current connector. No existing Netlify projects were modified.
- Next action: connect a dedicated Netlify project or authorize an authenticated draft-deploy mechanism. Preserve production branch main and deploy only the develop branch/draft. Then verify the hosted preview, actual mobile/desktop layouts, and rendered full/The Thang-only print before production promotion.

### Verified remote CI

The GitHub Checks run for implementation commit `5ce28ad5ae479395e240577e274906468f9fb1ad` completed successfully: https://github.com/shanematthewadams/fe-workout-planner/actions/runs/38781816991 . This verifies npm ci, lint, tests, and production build on GitHub's runner. Later changes are documentation only. The documentation status commit `84cdf472930e974e1d7055452161ee4c88f58213` was verified as the develop head before this CI evidence addition. Main remained at `f293071740044c1f9b700e5bc70d9ee6cf28ce2a`.

## Netlify connection update · October 15, 2026

This section supersedes the earlier no-site/linkage blockers. Shane authorized browser-based setup. The expired GitHub OAuth handoff returned Invalid state key; after renewed approval a fresh connection succeeded using existing account permissions.

- Dedicated Netlify project: `fe-workout-planner`.
- Site/project ID: `1d2480e0-3891-41db-9574-61cb13b7ae0a`.
- Team ID: `6a8d98d0bae1a4d6a86f48de` (shanematthewadams).
- Dashboard: https://app.netlify.com/projects/fe-workout-planner
- Linked repository: https://github.com/shanematthewadams/fe-workout-planner
- Verified production branch: main. Verified additional branch deploys: develop only.
- Build command: npm run build. Publish directory: dist. Existing netlify.toml controls the develop build and Node version.
- Visibility remains private for production and previews; no access protection was weakened. No paid upgrade, custom domain, or production promotion was performed.
- Netlify automatically attempted a main-branch setup build when linking. It failed at the README-only main commit `f293071740044c1f9b700e5bc70d9ee6cf28ce2a`; deployment was skipped. Initial setup deploy ID: `6ad118f751817ebb0b39046d`. A cancel attempt encountered a detached control because the build had already finished. Main application code was not added or published.
- This documentation push triggers the first develop branch deployment. Its result and actual URL must be verified before a working preview is claimed.
