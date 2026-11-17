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
