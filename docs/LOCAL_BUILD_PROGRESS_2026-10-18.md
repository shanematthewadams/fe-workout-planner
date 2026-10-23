# FE Workout Planner — local development report

October 18, 2026 · `studio/ux-streamline`

## Status

Implemented locally. Not pushed, merged, or deployed. Production is unchanged. No Netlify builds, preview deploys, paid-provider calls, or database changes were started during this pass. Remote Git refs were fetched read-only to confirm the starting release was still current.

Shane's explicit approval is required for production changes and for Netlify builds or deploys that consume credits. That rule now appears in `AGENTS.md`. Do not push this branch merely to obtain CI results; a push may trigger Netlify.

## What changed

### 1. Shared movement intelligence

- Added a 50-entry catalog, combining the existing app guide with eight additional planning entries.
- Each entry has stable identity, aliases, equipment and fixed-support requirements, counting guidance, and an alternative or modification note.
- The API, exercise browser, editor picker, and workout search now consume the same catalog. Removed the unused separate nine-exercise list.
- No saved-workout schema, version 1 backup format, database schema, credentials, or free-only provider rules changed.
- Entries are explicitly labeled app planning conventions, not verified regional standards. Alternatives are suggestions, not automatic edits or promises of medical suitability.

### 2. Stronger generation checks

- Names such as blockees, WW3, BOR, OHP, and thrusters can no longer pass a no-gear check solely because the AI omitted their equipment from metadata or instructions.
- Named support-dependent movements such as erkins, dips, and People's Chair add their requirements to the existing AO checks. Unknown and closed support remain unavailable.
- Added word-boundary and negation handling so a term such as BOR is not found in “boring,” explicitly excluded movements are not treated as instructions, and “run the clock” is not mistaken for running.
- Provider context sends at most 24 eligible catalog entries, prioritizing requested/current movements and mixing categories. Known conflicts are removed before generation. This bounds guide size instead of sending all 50 entries on every request.
- These checks remain conservative heuristics. They do not establish that every unfamiliar movement or arbitrary generated sentence is safe or correct.

### 3. A more useful playbook

- Extracted the library into `WorkoutLibrary.tsx`, removing roughly 250 lines from the main app component.
- Added one-tap no-running, no-gear, and 30-minutes-or-less filters.
- Added alphabetical, shortest-first, and recently-updated sorting, alongside source order/FE-originals-first sorting. Unknown duration sorts after known duration, not as zero.
- Multiword search includes known movement aliases, instructions, AO, and Q.
- No-gear/no-running results also inspect recognized movements instead of trusting metadata alone. Unknown source requirements remain excluded from those restrictive filters.
- Filter count and result count are visible. Reset clears favorites-only as well as other filters. Favorites and sorting survive a trip into details and back.
- “Use this workout” saves a separate personal copy and opens the editor directly. The same copy handler is used from details. Reviewed originals remain unchanged; blocked storage and draft limits are respected.

### 4. A smaller, clearer exercise guide

- Replaced the exercise-card wall with expandable movement rows showing requirements up front.
- Added category and requirement filters, alias search, counting notes, and alternatives.
- The editor can insert a catalog movement into a block. It brings in instructions but deliberately asks the Q to set reps or time. It does not silently change equipment, AO facts, timing, or other exercises.
- Catalog and custom additions stop at the existing 100-exercise-per-block limit.

### 5. Scoped visual work and maintenance

- Added scoped library/guide CSS using the existing forest, cream, and copper palette and Barlow/DM Sans type system.
- Cards have more compact spacing, shorter summaries, and direct actions; source explanations are expandable.
- Scoped responsive rules provide single-column mobile cards, wrapping controls, and touch-size actions. This is an implemented layout, not a visually verified redesign.
- Split the AO directory from exercise rendering to remove unused conditional branches. No new dependencies were added.

## Verification

Local checks completed:

- Unit/integration/component suite: **205 tests passed across 22 files**, up from 162 tests before this pass.
- ESLint: passed.
- TypeScript: passed as part of the production build.
- Local production build and offline-asset generation: passed. The optional external-source probe reported `skipped`.
- Git whitespace/diff check: passed.
- Playwright discovery: 32 cases listed successfully across desktop, tablet, mobile Chromium, and mobile WebKit. These include two new journeys per profile, plus four optional historical comparisons.

The added tests cover movement requirements and aliases, hidden gear and support conflicts, exclusion/clock wording, compact provider context, direct-copy preservation, blocked storage, combined filters, reset behavior, sorting, navigation state, guide filtering, editor insertion, and block limits.

## Not verified — do not call this release-ready yet

- **No browser journeys, screenshots, axe scans, or new print renders were executed during this pass.** This managed environment has no supported browser-control skill, so the Sites workflow requires skipping browser QA. The two new browser journeys are written and discoverable, not passed.
- **No live AI calls were made.** Free-provider output quality, quota behavior, and end-to-end latency still need evaluation in an approved environment.
- No physical-iPhone, audio/background timer, or wake-lock verification.
- The broader app/editor remains large. URL/history navigation, sync-code lifecycle, backup-scope unification, and deeper editor decomposition remain follow-ups.

## Next safe step

Run the expanded browser and visual checks in a supported local environment, fix observed issues, and review representative live free-provider output separately. This does not require Shane to perform routine testing. Any remote build, preview deployment, production migration, or publication must wait for explicit approval.
