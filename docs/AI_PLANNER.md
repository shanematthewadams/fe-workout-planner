# AI-lite Q planner

Current integration: see [STUDIO_INTEGRATION.md](STUDIO_INTEGRATION.md). The unified app adds strict timing, formal/wildcard entry, template fallback, field tools and private-code cloud sync. Earlier sprint storage/hosting limitations below describe their original implementation where noted.

The prompt is the front door. Example: “I have a Q at Gold Rush. I want to use coupons. I’d like the theme to be something about digging for gold.” The app drafts a new workout, supports plain-language refinement of that current draft, then uses the existing editor, Q view, personal-copy storage and full/Thang-only printing. The reviewed library is supporting material, not a generated-plan publishing destination.

## Context and output

Every request includes the versioned F3 briefing in `server/planner-context.ts`: Q/PAX/AO/XOs/coupon/Warmup/Thang/Mary/IC/OYO/six vocabulary, plain movement instructions, explicit counting conventions, partner totals, ladders/11s and travel rules. The server supplies verified AO schedule/local facts and at most three relevant approved regional workout references. Empty local attributes stay unknown; AO names do not imply terrain. Reference sections are bounded to control context size. Personal stored workouts, attendance, raw backblasts, prayer/health/contact material and unrelated private content are not retrieved or supplied. Refinement sends only the current structured draft and the new change request, with fresh F3 context. No conversation-wide or saved-workout history is sent.

`src/planner-contract.ts` validates request/output. Natural-language session duration (20–60 minutes), no running, no coupons/equipment and omitted/added Mary can update defaults. Explicit equipment/running preferences take precedence over prompt inference. Plans require warmup/Thang/(requested Mary) in order, nonempty instructions, exercises with amount/unit/counting/instructions, and block estimates summing to the requested duration. The model cannot set IDs, publication fields, source approval, AO provenance or lineage; the server creates those independently. Treat outputs as drafts requiring Q review, not field-tested plans or guaranteed timing/safety. Semantic exercise suitability and estimated pace still need human judgment.

New work is `kind:personal`, `provenance.status:personal`, clearly **AI-assisted**, with estimated duration and server-selected reference provenance. It is never an imported/reviewed FE original and is never published into the reviewed Supabase catalog. Personal plans can be synced to the private-code collection. Existing originals/IDs and `fe-planner:v1` backups remain unchanged. An optional `provenance.generation` object records provider/model/reference IDs within the existing version 1 schema.

## AO context and simple entry

The builder shows location and start time first, with a collapsed “Anything different today?” panel for temporary availability and conditions. Any downrange AO name is accepted. Website descriptions checked October 16, 2026 seed Gold Rush, South Park, Clocktower and Stagecoach; other features remain unknown. Each seeded fact retains its source/review date. Website review is not on-site verification. Self-service regional upload, admin approval and publication remain future work.

Features are explicitly available, unavailable or unknown. Temporary selectors and clear Q statements can confirm features; closures such as “the field is muddy” override baseline availability for that request. Hypothetical phrases do not establish availability. These changes never edit the regional profile. Output declares requiredFeatures, and server validation also scans common facility-dependent instructions. Unavailable/unconfirmed requirements reject that provider result; automatic routing may try the next eligible free provider within the existing deadline. New generation retains the terrain-neutral offline fallback. Refinement failure preserves the current draft. Natural-language detection is conservative and bounded, not a semantic guarantee: the Q should review the plan and use explicit availability selectors for certainty.

The selected start time persists in the plan/backup, drives timeline, print and live timer, and still leaves exactly 45 minutes before the physical hard stop. COT remains separate. Legacy plans default to 5:30 AM. Site summaries preserve the assumptions used when a plan was generated; changing controls requires generation/refinement to update the draft.

Verification: 125 automated tests pass, plus lint, TypeScript/Vite build and mobile/desktop Chromium checks. Coverage includes unknown/custom AOs, temporary closures, unsupported facilities, next-provider retry, conditional statements, backup compatibility, custom start/hard stop and invalid-time UI handling. Mobile checks cover quick entry and offline plan/timer/library reload.

## Free-only providers

- Direct server-to-provider calls; no Netlify AI Gateway, paid model fallback, external tools, grounding, embeddings or billable search.
- OpenRouter uses **`openrouter/free`** plus `provider.max_price` of zero for prompt and completion. No arbitrary model/base URL is accepted from the browser. Capacity/quotas can fail, with no paid substitution.
- Gemini uses `gemini-3.5-flash-lite` without tools/caching and minimal thinking. A free-capable model name alone does not prove zero billing: the project must be on Free tier.
- Engineering inspected AI Studio read-only on October 16: newly created Default Gemini Project **`gen-lang-client-0481939256`** showed **Free tier**. Its masked key suffix matched the saved Netlify development key. Existing older projects showed Tier 1 and were left untouched. `server/provider-policy.ts` records this limited verification and only enables the matching key. A changed/unmatched key stays disabled until reverified. If anyone enables billing on this project, disable/reverify the Gemini route first; the API key does not expose live billing state on each request.
- Automatic mode tries verified-free Gemini, then free OpenRouter on provider failure. Provider preference remains compatible with stored sessions and the API; everyday UI uses automatic routing. Total upstream deadline is 20 seconds; client deadline 55 seconds. At most one call per eligible provider, no retry loops. Malformed/incomplete results do not replace the previous draft.

Both `GEMINI_API_KEY` and `OPENROUTER_API_KEY` are secret Netlify environment variables with Functions scope. Credentials stay server-side. Metadata inspection confirms presence, not plaintext validity; actual generation must be verified on the deployed endpoint. Neither key is in the repository, browser bundle or response. Masked connector values must never be used as credentials. No key from Elsewhere was read or reused.

## Endpoint and storage

`netlify/functions/plan-workout.mts` serves POST `/api/plan-workout`. The endpoint is enabled in branch, preview and production contexts. It checks same-origin Origin, JSON content type and a 48 KB streamed body limit; rejects unsupported requests; uses no-store responses; returns generic errors without provider bodies, credentials or source text in logs. Netlify rate limit: five requests per minute per domain/IP. Existing team protection remains unchanged; no consumer sign-in is added. Origin checks do not authenticate a user; the rate limiter and free-only routes bound misuse, while existing preview protection limits audience.

The assistant prompt, preferences and latest validated draft are kept in tab-scoped `sessionStorage` key **`fe-planner:assistant:v1`**, independently of personal workouts. Save a private copy creates an independent new ID in existing local storage. Refinement never silently overwrites a saved copy. Cancel/stale/failed requests keep the previous result. Broken storage surfaces an error; personal storage recovery and stale-tab safeguards still apply. Closing the tab can lose an unsaved assistant session; explicit saving/export/printing retains useful work.

## Engineering verification

```sh
npm ci
npm test -- --maxWorkers=1
npm run lint
npm run typecheck
npm run build
```

Server tests cover F3/AO/reference context, refinement payloads, private-backup compatibility, free routing/price ceilings, verified Gemini key gating, malformed/sparse output, timing/section/preference mismatches, quota/provider errors, cross-origin/invalid/oversized requests and nonsecret/no-store responses. UI tests cover generation, failed refinement preserving the draft, saved/preview/editor handoffs, session restoration and cancelled-response races. Headless Chromium at 390/1365px verifies the complete UI with synthetic responses and actual print rendering; this does not prove live model quality. Live deployment/provider results are recorded separately in SPRINT_HANDOFF.md.

Docs checked October 16: https://openrouter.ai/docs/guides/routing/model-variants/free; https://openrouter.ai/docs/guides/routing/provider-selection; https://ai.google.dev/gemini-api/docs/pricing; https://ai.google.dev/gemini-api/docs/rate-limits; Netlify Functions skill. Gemini free-tier content can be used for provider product improvement; the UI explains what is sent, and no unrelated personal backblast content is included.
