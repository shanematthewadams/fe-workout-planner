# Reliability sprint: executable engineering handoff (October 19, 2026)

**Status: audit / verification design, not implemented or released.** This is a continuation brief for the current F3 Q Builder source, **not** a request to build another app.

Repository: `shanematthewadams/fe-workout-planner`
Branch: `studio/ux-streamline`
Staging: `https://studio-ux-streamline--fe-workout-planner.netlify.app/`
Production (do not publish): `https://q.f3thefe.com`

Read `AGENTS.md`, `docs/STUDIO_SYNC.md`, `docs/STAGING_RELEASE_2026-10-19.md`, `docs/RELEASE_CANDIDATE.md`, and the existing browser suite **before changing code**. Inspect git status and recent commits. Preserve uncommitted changes, original regional workouts, backup v1, sync/recovery codes, guest stores, and account isolation. Latest previously verified source was `b8bb0654447f62e8fe7273fce07c9d630b7f6760`; 357 tests and 72 browser checks passed, with four optional history comparisons skipped. This is **not proof of follow-up work**.

## P0: first-use and recoverability

Use the existing fixture paths in `e2e/account.pw.ts`, `e2e/journey.pw.ts`, and `e2e/release.pw.ts`. Reuse existing auth, cloud, and planner controllers; avoid new storage formats, new routes and onboarding pages.

1. Guest enters an idea, builds, edits, saves, reloads, opens **My Workouts**, enters **Lead workout**, and returns. Assert the exact workout ID and user edits survive throughout.
2. Repeat the journey across optional **Keep my workouts** > **Create account** with **F3 Name**, simulated delayed confirmation link, then account reload and guest import. Returning sign-in is **Email me a sign-in code**, not a confirmation link. No real emails.
3. Simulate delayed account/cloud responses. Opening a bookmarked workout should wait for load rather than falsely show missing or create a duplicate. Explicitly assert the workout is eventually opened and its content matches.
4. Simulate offline device saving, reload, reconnect, and cloud failure. Assert device copy retained, upload acknowledged only when confirmed, no infinite retry or duplicate, and recovery language specifies next action. Simulate version conflict and check newer remote content is not overwritten.
5. Simulate rejected AI response, provider 504/timeout, and offline fallback. Existing draft and edits must remain intact; no paid or unnecessary live calls. Assert fallback is called a template, never a successful provider result.
6. Simulate expired OTP, 429 rate limiting, resend, and invalid confirmation link. Assert distinction between signup links and sign-in codes and that existing saved work is unaffected.
7. Profile: preexisting `display_name` is never overwritten by stale `f3_name` metadata; missing profile may be seeded once. Assert cross-account isolation.

## P0: Lead mode

Reuse `e2e/journey.pw.ts`, `e2e/voice-timer.pw.ts` and existing timer tests. Exercise session and interval start, pause/resume, phase transitions, reset, completion, switching modes, visibility loss and restore, and navigate-away/return. Check touch targets, narrow viewport overflow, focus behavior, reduced-motion/a11y, and accidental double taps. Mock speech synthesis and wake-lock rejection; no hardware claim. Do not regress circuits or timing.

## P1: inventory comparison preparation

Inspect `src/AOReview.tsx`, `src/ao-review.ts`, `scripts/review-aos.ts`, `scripts/import-site-q-roster.ts` and `scripts/site-q-roster.ts`. Extend existing offline proposal/review process to emit reviewable changes grouped by AO/venue, with unchanged/added/removed/ambiguous/conflicting facts, citations and review dates. Preserve unknowns, seasonal venue boundaries, onsite-vs-nearby, cover-vs-lightning-shelter, indoor-gathering-vs-workout permission and approximate distances. No Google Sheet writes, source promotion, new credentials, scheduled sync, DB mutations, or public editors. Import/reconcile updated sheet **after** summit, separately.

## Evidence and release gates

- Run full unit/component tests, lint, TypeScript and production build on the actual modified worktree.
- Run existing GitHub Playwright browsers: desktop, tablet, mobile Chromium, mobile WebKit. Keep interceptors and fixture isolation; no real email/workout mutations.
- Inspect screenshots and axe findings. State separately any gaps requiring actual iPhone voice/audio/wake-lock tests.
- Compare tested Git SHA/tree to staging deploy commit and hosted bundle/hash. Never infer success from an old release.
- Do not merge to main, publish production, or change shared database. Per `AGENTS.md`, obtain explicit approval before Netlify credit-consuming builds/deploys.
- Update `docs/SMALL_GROUP_PREVIEW_2026-10-23.md` only after verifying actual UI labels and success paths.
- Deliver changed files, why, fresh test counts, CI links, staged commit/hash, screenshots, and remaining limits.

**Execution instruction for AI Studio or another coding environment:** Work directly from this one repository and this same branch, implement changes and test them, do not merely write another plan. AI Studio GitHub import may be a disconnected snapshot; verify its HEAD before editing and reconcile unpushed Studio-only work. Stop at the staging-release authorization boundary if a build/deploy would consume credits.
