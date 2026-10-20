# FE planner development

- This is one application: `shanematthewadams/fe-workout-planner`. Keep AI Studio and other editors on this repository. Never create a parallel planner or a replacement repository.
- Read `docs/STUDIO_SYNC.md` before Studio integration changes. Main is production; inspect its current head before editing and preserve unpushed work. Use `studio/ux-streamline` as the single active development branch and a tested PR to `main` for release. Do not create more working branches.
- Reuse the shared planner handler, F3 context, schemas and provider policy. Vite previews and Netlify must not grow separate generators.
- Keep provider credentials server-side and preserve free-only routing. Never use an unverified/paid key or print secrets/private sync codes.
- Preserve strict timing, unknown AO facts, explicit temporary closures, version 1 backups, local saved workouts and automatic private cloud saving with offline fallback. Do not overwrite reviewed regional originals with generated drafts.
- Verify changes with relevant tests, lint and production build; check the runtime that changed. Do not claim live provider success based on a template fallback.
- Shane manages the product and expects a simple mobile flow. Handle routine engineering work autonomously; explain concrete blockers plainly.
- Explicit approval is required before any production publish, merge to main, or shared/production database change. Shane authorized routine pushes, remote verification builds, and staging/preview deployments on studio/ux-streamline without further approval on October 20, 2026. Run relevant local checks before pushing; verify fresh CI, the deployed commit/tree, and hosted files before reporting a staging release as verified. This standing authorization does not cover production publication, merging to main, database changes, paid services, or new infrastructure.
