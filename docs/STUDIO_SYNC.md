# One app in GitHub, Netlify and AI Studio

The canonical repository is `shanematthewadams/fe-workout-planner`. Production is `main`, served at `https://q.f3thefe.com`; `develop` is the canonical development branch; `studio/ux-streamline` remains the existing Netlify staging deployment mirror. AI Studio is an editor/preview of this repository, not a separate implementation. Do not create another GitHub repository or replace the application with the old Studio prototype.

## Synchronize the workspace

Import this existing repository through AI Studio's **Import from GitHub** flow. As observed in this account on October 17, 2026, that dialog explicitly says **“Imported code won't stay synced with GitHub.”** Import is a snapshot, not a live link. The old prototype's GitHub panel only offers **Create new repository**; retain it as a backup and do not create another repository. Preserve Studio-only edits before refreshing a workspace. Review diffs rather than accepting the old prototype over current main.

For this account, make changes on `develop` against this repository, run checks, and fast-forward the existing staging mirror before any separately approved release to main. Netlify publishes main automatically. Refresh Studio by importing current main again; export and review any Studio-only edits into `develop` before doing so. Source changes will not automatically appear in both places. If Studio later exposes an existing-repository pull/push connection, verify it before adopting that workflow. Do not infer support from documentation alone. A preview can show uncommitted work ahead of production.

## Same frontend and API implementation

`npm run dev` starts Vite on port 3000. Its middleware serves `/api/plan-workout` using `server/planner-handler.ts`. The Netlify Function delegates to that same handler. The F3 prompt, request/output validation, AO rules, timing, free provider policy, refinement behavior and deterministic fallback are shared. No second Express generator or external production proxy is needed. Preview requests retain body/origin checks and an in-memory five-per-minute/IP limit. Studio's HTTPS proxy forwards its external host/protocol; these are used to validate the browser origin.

Netlify's build remains `npm run build` with `dist` output and the existing serverless function. The Vite API middleware only runs in development. Private environment variables are read on the server and are never exposed through `VITE_*`.

## Environment and saved data

The dev preview reuses the two public Supabase browser settings in `netlify.toml`, with explicit environment overrides supported. This connects the regional catalog and opt-in private sync to the same project; it grants no extra database permissions. Import does not copy secret values. The preview can use server-only `GEMINI_API_KEY` / `OPENROUTER_API_KEY`; unmatched/unverified Gemini keys stay disabled under `server/provider-policy.ts`. Do not assume an automatically assigned Studio key is free, switch to a paid provider, or copy keys into source. Without eligible keys the shared API returns a clearly labeled offline template for new drafts. Failed refinement preserves the prior draft.

Source sync also does not copy browser storage across origins. Production, Studio previews and the old Netlify address have separate local/session storage. Use the existing backup import/export or private sync code and explicit **Sync now** to move personal plans. Never include the sync code in a public URL or repository. The read-only regional catalog remains shared; personal drafts are not published into it.

## Verification

Run `npm run lint`, `npm run build` and `npm test -- --maxWorkers=1`. Preview API integration tests start a real Vite server and cover fallback timing/site snapshots, no-coupon/no-running requests, HTTPS proxy origins, cross-origin rejection, oversized bodies and rate limiting. Check the actual Studio preview and Netlify deploy after syncing. A successful static build alone does not prove preview API parity or live provider availability.
