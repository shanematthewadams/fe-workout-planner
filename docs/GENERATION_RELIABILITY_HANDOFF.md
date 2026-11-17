# Workout generation reliability

Work continued on `studio/ux-streamline` from `832bba1ec85511df7630f8c13e43ca6380640434`. The first bounded staging run against `84c392977fc1befe072da8baf4990443ea323ed5` returned a Gemini plan for the seasonal venue case (4,981 ms). Coupon partners (22,571 ms) and individual rain/core (10,974 ms) returned timeout templates. Refinement was skipped because its coupon partner starting draft was unavailable. These were three independent requests and no saved plans were written.

The shared planner derives an output schema from its existing validation contract. Gemini receives it as a constrained response schema. OpenRouter's free router receives the same schema in its instructions with JSON object mode and the existing zero-price ceiling. The prompt specifies the actual schedule for each session type and removes the old example with conflicting phase lengths. The first free provider can use 14 seconds when a second route is configured. The fallback uses the remaining portion of the same 22-second provider deadline, capped at 20 seconds. Each route gets at most one attempt and client cancellation stops further attempts.

Attempt logs report provider, elapsed time, HTTP status when available, and a fixed outcome category. Schema errors include capped field paths and codes. Draft text, prompts, and credentials are excluded from those logs. The app still validates phase order and times, movement eligibility, equipment, running, site restrictions and refinements. An unsuccessful refinement preserves the previous draft. Eligible new requests retain the labeled template fallback.

The existing authorized source-text safeguard remains prepared locally and committed. The migration confirmation expired on the follow-up attempt and a fresh schema read confirmed the column is absent and all 36 links are still stored. Resume with the guarded migration and import described in [the Codex handoff](exicon/PLANNER_INTEGRATION_HANDOFF.md).

Run `npm run eval:planner -- https://studio-ux-streamline--fe-workout-planner.netlify.app qa/generation-reliability/after.json` against the verified app commit. The evaluator sends up to four synthetic staging requests and counts only validated provider drafts as successes. Check per-case outcomes, duration, and catalog origin. Use the latest verified branch build for staging and revert the implementation commit to redeploy the previous planner behavior if needed. Production promotion still requires Shane's explicit approval.

## Staging evidence

November 17 deploy `6afccdcdfe414822737cd493` serves commit `6d04716cdebaf6ad3037c528b9c413925a91040f` and tree `04b1f1f284b46dc66a9fffbf2c66ac9d4262c6dd`. The hosted build identity matched. The hosted JS matched the locally configured build byte for byte (SHA-256 `feb6bcf2bc5d95b129b13236512759df8fa3c6bcd3dcc2f8afe2142bd5fbc03d`). The hosted read returned 50 exercises, 35 exercise links and one format link. Production main was still `e254c11ec266e62586208cb1282f9eeb8e7b093a`.

| Scenario | November 10 baseline | November 17 staging |
| --- | --- | --- |
| Coupon partners and closed track | Timeout template | Gemini, 13.45 s |
| Unknown seasonal venue | Gemini, 4.98 s | Gemini, 4.63 s |
| Individual standing core in rain | Timeout template | Gemini, 3.37 s |
| Targeted reduction of gear and running | Skipped | HTTP 504, also on one bounded recheck |

All three new drafts used the database AO and exercise catalogs and passed plan validation. The overall evaluation did not pass because refinement failed. Request `01M7NR9TDKP1D64M04W7K370PD` recorded Gemini HTTP 503 after 2.32 seconds and returned HTTP 504 after 22.05 seconds of server time. The single repeat `01M7NRC7VCPBXJB67QNM3J7XS9` returned HTTP 504 after 26.65 seconds of server time. Logs did not establish a specific OpenRouter failure cause. The sample spans different days and provider conditions. It cannot isolate the effect of the code change or establish a success rate.

Local lint, type check, build and 480 tests across 64 files passed. Existing UI tests cover draft preservation on HTTP 504. The remaining application milestone is a successful bounded live refinement under these same preferences, with a narrower edit payload or provider routing change only after measuring the failure on each configured route. Retain full validated plan output and preserve the original draft on failure.

[GitHub Actions run 44185187625](https://github.com/shanematthewadams/fe-workout-planner/actions/runs/44185187625) records the remote checks for this application commit. Live evaluation was run separately as described above.

The first remote run passed lint, unit tests and build. It passed 136 browser tests with four optional skips. The hosted check passed the desktop journeys and the mobile WebKit save, bookmark, and timer journey, then failed on a WebKit access-control page error during the simulated cloud request in its direct Weinke journey. The fixture intercepts the request before it reaches Supabase. The same commit was queued for one rerun. The two hosted catalog checks were performed separately and passed the 50-movement/36-link read and the 977-reference identity check.

## Refinement follow-up

Staging deploy `6afcd4a7300544e2cf95c4f9` serves commit `ad52197e2cb3aae994e36c3d721a69afc46f3f74` (tree `b6b0008e60ad43d09a7fa5826137a3c3ec67e26e`). The previous CI rerun surfaced a sign-in test that asserted focus before the focus effect finished. The follow-up waits for that effect. The hosted direct Weinke check waits for the synthetic cloud response before reloading.

New workouts retain their full response schema. Refinements use a partial response schema, keep unchanged fields and sections from the original draft, and run the merged workout through the existing full validation. The shortened prompt omits regional workout examples on edits and uses a smaller movement guide. The preference parser recognizes compound requests such as removing all equipment and running.

One live retry of the prior Gold Rush coupon plan passed on November 17. Gemini returned HTTP 200 in 10.41 seconds, retained the original title and Mary section, and removed gear and running while preserving the track closure and 8/29/6 minute phases. Both live catalogs were used. Request ID `01M7NSYPD6HN2H53WZ9AS8BNRC`. The live exercise catalog still returned 50 movements, 35 exercise links and one format link. No plans were saved by the probe. This is one successful edit after two timeouts on the preceding build.

Local lint, type check, build, and 481 tests across 64 files passed. The deployed browser asset `/assets/index-DM6vQncw.js` matched the configured local build byte for byte (SHA-256 `3bedcb3a84e28362f3c8ba518f7a57f8ffb360149f80d4186c96d81837e7fd37`).

[GitHub Actions run 44190126237](https://github.com/shanematthewadams/fe-workout-planner/actions/runs/44190126237) tracks the follow-up build and hosted browser checks. The source-text migration remains a separate pending database operation.

A separate four-case staging pass on the same follow-up commit returned two new Gemini drafts (coupon partners in 9.08 seconds and seasonal venue in 3.70 seconds), a timeout template for individual rain/core (22.28 seconds), and a successful Gemini refinement of the new coupon draft in 6.83 seconds. The second refinement retained the original title and returned empty equipment and no running. The full four-case gate still failed on the rainy new-draft case. Netlify recorded a constraint rejection of Gemini’s draft after 3.92 seconds, then the request reached its deadline and returned the template (request `01M7NT3GS03832PMMN3RZ43YZF`). The specific constraint is not available in the log. The next reliability task is to expose the rejection reason safely and fix the rainy-workout case without relaxing validation. No further live provider requests were sent.

The follow-up CI run passed lint, unit tests, build, and 136 browser tests (four optional skips). Its hosted desktop journeys and mobile save/reload/timer journey passed. The hosted mobile WebKit direct Weinke journey again reported an access-control page error from the intercepted `fe_sync_plans` request, even after waiting for the synthetic save response. The full CI run remains red. The next verification step is to reproduce that error around the remaining navigations and separate the no-cloud direct authoring journey from the hosted cloud-save journey while retaining both checks.

## Wet-weather and hosted verification follow-up

Staging deploy `6afcddd03eeaecf39ccc1e94` serves commit `dad2823138049d93877a53dd07ce9b7a989eda1c` (tree `dbd643351731d7e1d08211baadddba163301c0a8`). The planner prompt now gives explicit solo and wet-weather directions, uses a shorter list of standing movements for wet bodyweight bootcamps, and omits regional workout examples that may conflict with the weather. Existing validation remains in place. The server records fixed rule names when a draft is rejected and keeps workout text and user prompts out of diagnostic logs.

The hosted test uses distinct sessions for its online synthetic cloud-save workflow and local-only Weinke recovery workflow. The latter simulates offline status without preventing delivery of the hosted page and asserts zero cloud sync requests. Both journeys still check navigation and saved workout recovery.

The November 17 live test returned a Gemini rainy solo plan in 3.51 seconds with standing exercises, no equipment, no running, no required facilities and 8/29/6-minute phases. Coupon partners passed in 7.54 seconds and refinement passed in 3.14 seconds. The seasonal unknown venue fell back to a template after 22.32 seconds. The new logging identified a Gemini site-access rejection at 4.93 seconds, followed by an OpenRouter timeout (request `01M7NW6JM69EAQ37PWDSC8VWEF`). No plans were saved. The specific rejected feature was not recorded. The next reliability task is to reduce irrelevant facility examples when venue amenities are unknown, preserving closures and the strict availability check.

Local lint, type checking, build and 481 tests across 64 files passed. The deployed catalog checks passed for 50 movements, 36 reviewed links, and 977 Codex reference identities. [GitHub Actions run 44196276139](https://github.com/shanematthewadams/fe-workout-planner/actions/runs/44196276139) tracks the hosted browser gate. The source-text migration is still pending.
