# FE planner development

- This is one application: `shanematthewadams/fe-workout-planner`. Keep AI Studio and other editors on this repository. Never create a parallel planner or a replacement repository.
- Read `docs/STUDIO_SYNC.md` before Studio integration changes. Main is production; inspect its current head before editing and preserve unpushed work. Use tested feature branches/PRs for release.
- Reuse the shared planner handler, F3 context, schemas and provider policy. Vite previews and Netlify must not grow separate generators.
- Keep provider credentials server-side and preserve free-only routing. Never use an unverified/paid key or print secrets/private sync codes.
- Preserve strict timing, unknown AO facts, explicit temporary closures, version 1 backups, local saved workouts and private opt-in sync. Do not overwrite reviewed regional originals with generated drafts.
- Verify changes with relevant tests, lint and production build; check the runtime that changed. Do not claim live provider success based on a template fallback.
- Shane manages the product and expects a simple mobile flow. Handle routine engineering work autonomously; explain concrete blockers plainly.
