# The next Q is yours

Historical redesign notes follow. The current October 22, 2026 palette is warm charcoal, red, gold and supporting steel blue; see [DESIGN_PALETTE.md](DESIGN_PALETTE.md) for the approved tokens and usage. The current approved vibe-first flow and autosave boundaries are in [ENJOYABLE_FLOW.md](ENJOYABLE_FLOW.md). Current branch/deployment authority is in `AGENTS.md` and `STAGING.md`.

## Design decision

Two palettes were considered for Athletic Editorial × Modern Outdoor:

| Direction | Ground | Main color | Accent | Character |
| --- | --- | --- | --- | --- |
| Forest / Bone / Copper (selected) | `#f4f1e7` | `#163e32` | `#934725` | Early mornings, outdoor community, warm and approachable |
| Charcoal / Sand / Clay | `#eee8dc` | `#292d2a` | `#a3543c` | Tougher and more urban, less connected to the outdoor brief |

Forest wins because green establishes the identity while copper adds warmth without making orange the primary interface color. Barlow Condensed provides large, confident headlines. DM Sans keeps forms and exercise instructions readable. Fonts are bundled for offline use. Contour lines are a lightweight CSS detail, not a downloaded image.

Shared tokens live in `src/design.css`; existing editor, printing and recovery layouts retain their structural styles in `src/style.css`. Removed over 300 lines of obsolete wizard styling.

## Simplification

- One primary navigation: Build, Library, My Workouts.
- More contains AO Directory, Exicon & Lexicon, Sync & backups.
- Favorites is a collection filter, not another destination.
- Deleted step banners, numbered creation boxes, oversized mode cards, repeated readiness headings and the misleading “battle-tested / complete timing” claim.
- The common path is AO + idea + Build. Start time stays visible because it changes the hard stop. Temporary terrain, structured preferences and formal inputs are optional.
- Timer is contextual to the current plan; preview/print uses the existing dedicated printable workout.
- Sync/import/export have one destination instead of occupying every collection screen.

## Trustworthy AO resolution

The shared `siteContext` function is used by browser context, API context, validation and saved site summaries. It resolves:

1. Bundled regional facts, with their existing source and review date.
2. Unpublished device terrain edits, explicitly labeled Q-supplied context.
3. Today's amenity values and explicit overrides.
4. Textual closures, which take precedence over availability.

`withLocalAO` reads and validates the existing local terrain key, then attaches a bounded `site.localDraft` to a planning request. The server does not read browser storage or treat local notes as regional publication. A change of AO clears another site's local context. Base regional data remains unchanged.

Unsupported Site Q defaults were removed in this design pass. The later [Site Q roster correction](SITE_Q_ROSTER_2026-10-19.md) connects the explicit current inventory roster as the regional default. A locally entered override remains labeled unverified. Unknown does not mean an opening or vacancy. The directory's local editor is not an authorization system and cannot publish regional changes.

Portable gear excludes fixed stairs, bleachers and pull-up bars. Existing API enum values remain accepted for compatibility, but never establish facility availability. Every generated plan goes through the terrain validator, including non-strict API requests.

Saved-workout and version 1 backup formats, storage keys, regional originals, cloud sync and database security have not been migrated. No infrastructure or paid AI provider was added.

## Field experience

High contrast forest and cream, large controls, a tabular countdown and one exercise at a time. Previous/next advances the instruction without moving the timer. Live timers can be stopped; a stopped timer can resume in practice mode. Muting also suppresses activation beeps. Wake-lock cleanup releases a late-arriving lock after leaving the view.

## Automated verification

- `npm test -- --maxWorkers=1`: data compatibility, provider failures, request handling, persistence, backup conflicts, database constraints and UI journeys.
- `npm run lint` and `npm run build`: lint, full TypeScript compilation and production assets/service worker.
- `npm run test:browser`: Chromium at 1440×1000, 768×1024 and 390×844. Tests use synthetic local data, never production personal workouts or live paid AI.
- Browser checks cover create/refine/edit/save/print/lead/reopen, offline reload/template use, fallback/refinement failures, horizontal overflow, browser exceptions and WCAG A/AA checks.
- GitHub Actions builds the pre-redesign branch commit `8a0c426` in a detached worktree for before screenshots. It publishes screenshots, a printable Q sheet and test reports as the `browser-qa` artifact.
- Provider-boundary browser responses are fixtures. They are not evidence that a live free provider has capacity. Shared real API behavior has separate integration tests.
- Netlify's current site protection requires an invited account for live runtime inspection. Do not change audience or weaken protection to make QA easier.

## Release procedure

Development stays on `studio/ux-streamline`. Inspect remote heads before every push. No force pushes. Main stays production. Run all checks, inspect actual browser screenshots, then merge the verified development commit using the existing repo workflow. Inspect the Netlify deployment result and exercise the protected production runtime once access is available.

If a published change is defective, revert the release commit and let continuous deployment build the fix. Prior commits remain in Git; do not delete local data or restore an unrelated project.

## Next release priorities

| Priority | Opportunity | Impact | Effort | Risk | Incremental cost |
| --- | --- | --- | --- | --- | --- |
| 1 | Authorized regional review/publishing of AO updates with sources and verification dates | High | Medium | Medium: permissions and stale facts | Existing Supabase; assess usage |
| 2 | A small AI evaluation set for terrain, counting, timing and targeted refinements | High | Medium | Low with fixture replay; provider quotas for live checks | Free models only |
| 3 | Intentional export/share of a personal plan with clear adaptation provenance | Medium | Small | Medium: avoid accidental personal publication | None for local exports |
| 4 | Shared regional collections with review and import-as-copy | High | Large | Medium: permissions, provenance and moderation | Assess existing service limits |
| 5 | Region-aware catalog and schedules, retaining verified/unknown values | Medium initially | Large | Medium: source maintenance | Assess before expanding |

Regional publishing and shared libraries require an actual permission boundary. Keep the local editor honest until that is built; do not add pretend admin authentication or new accounts just for this release.
