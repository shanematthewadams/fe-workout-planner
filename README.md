# The FE Beatdown Planner

One planner for F3 The FE in Olathe, Kansas: describe a Q, roll a wildcard, or use the formal builder. Shape the result, save it, and lead it in the field.

- **Builder:** Surprise Me, Enter an Idea, Formal Builder, natural-language refinement and labeled offline templates.
- **AO context:** choose an FE AO or type a downrange location, set your start time, and optionally adjust today’s available features, stored coupons, surface and lighting. Casual idea entry stays the default.
- **Plan:** ordered instructions, counting rules, 45-minute timeline, welcome/disclaimer, separate COT, Slack Q-sheet copy and full/Thang-only print.
- **Field Q-Timer:** live countdown from the selected start time (5:30 AM default) or practice countdown, 45-minute physical hard stop, optional Mary, 5/10-minute COT, whistle and four-count cadence.
- **Exicon & Lexicon:** Studio movement/term/style guide, plus source-checked exercise references and FE AO schedule snapshots.
- **Saved:** local-first personal plans, backups, recovery and optional private-code cloud sync without signup. Sync is explicit: use **Sync now** after changes and before changing devices. Download the private sync code separately to connect another device.
- **Library:** 25 reviewed regional backblasts and ten clearly labeled illustrative starters. Personal and generated drafts never become reviewed originals automatically.

## Development

Node 22. React/TypeScript/Vite frontend; a Netlify Function handles free-only Gemini/OpenRouter generation. No Express production server is needed. Provider keys are server-side; never add them to a VITE variable or browser bundle.

```sh
npm ci
npm test
npm run lint
npm run build
```

`npm run dev` runs the frontend and `/api/plan-workout` through the same handler used by Netlify, including in AI Studio. Offline templates work without an API. The build generates the static service worker. Load the deployed app once online before relying on offline reload.

The strict schedule is 2 minutes welcome, 8 warmup, 29 Thang and 6 Mary; skipping Mary gives the Thang 35 minutes. COT follows the physical hard stop. Source plans keep their original timing and may differ. Workout estimates and exercise suitability still need Q review.

## Storage and deployment

Repository: https://github.com/shanematthewadams/fe-workout-planner

Netlify project: `fe-workout-planner` (`1d2480e0-3891-41db-9574-61cb13b7ae0a`). Production follows `main`; `develop` is the development branch. Existing Netlify team protection remains in place.

Dedicated Supabase project: `kitqovhdwzkhpxlepvfn`. The approved/published `workouts` catalog is read-only to clients. Personal sync uses a capability-scoped RPC and a private schema. Old Studio `beatdowns` rows remain available for explicit import, with browser mutation access revoked. No With/Elsewhere database was changed.

Local `fe-planner:v1` saved plans and version 1 backups remain compatible. Cloud plans are not encrypted with the sync code: anyone with it can access/change that collection. Keep it private and download it before clearing browser storage. Favorites remain local. Ordinary backups do not contain the sync credential. Device-specific background audio and native printing depend on browser support.

See [STUDIO_INTEGRATION.md](docs/STUDIO_INTEGRATION.md) for integration decisions, data handling and verification; [AI_PLANNER.md](docs/AI_PLANNER.md) for provider/context details; [IMPORT_WORKFLOW.md](docs/IMPORT_WORKFLOW.md) for regional source review; and [SPRINT_HANDOFF.md](docs/SPRINT_HANDOFF.md) for historical sprint evidence.

See [STUDIO_SYNC.md](docs/STUDIO_SYNC.md) for the single-repository Studio workflow and preview environment details.
