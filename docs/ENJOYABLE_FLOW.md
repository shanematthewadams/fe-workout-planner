# A helpful fellow Q — October 22, 2026

Shane approved this product flow in the conversation following the steel-blue release. This document is the durable implementation brief, not a new application or architecture.

## Approved experience

1. “You’ve got the Q. Let’s make it a good one.” Two entries: **I have an idea** and **Help me find one**.
2. Inspiration: vibe first → AO → three curated concepts. All three steps use ordinary code, with no provider calls. Ideas require no undocumented site amenities. Unknown/downrange locations remain supported; confirmed AO context is supplied to generation through the existing grounding path.
3. “Anything else?” Exactly two primary preferences: coupons Yes/No and running Lots/Some/None, plus an optional note. Lots maps to the existing Moderate running value; Some to Light. Yes confirms equipment for this session, not coupon storage at the AO. Visible defaults are concrete No coupons / Some running; notes can suggest other values, and explicit button choices take priority. Formal Builder coupon controls share the same gear selection. Duration remains the existing 45-minute FE schedule; advanced options remain available.
4. Show the entire workout in order, including warmup, Thang, Mary when included, and COT. Inline exercise/count/unit/instruction/order and block-time edits use ordinary code and keep the refinement plan and saved workout aligned. Additional established editing capabilities remain under **More editing options**.
5. The working Q sheet saves automatically to the existing private local collection. Lead is primary; Print and Copy for Slack are secondary. Existing cloud status reports cloud acknowledgements separately. Never infer cloud success from a local write.
6. Creative help is optional, under **Help me change this**. Reuse the existing scoped refinement and provider validation. A failed provider cannot replace an existing draft. Refinement preserves the saved workout ID and personal notes.
7. Icons accompany readable labels. Keep warm charcoal, red navigation, gold primary actions and steel-blue supporting accents. Selection includes a checkmark, not color alone.

## Saving and compatibility

- Reuse the version 1 workout and backup formats, account-scoped storage, attribution, the 200-workout cap, unreadable-storage lock and cross-tab conflict protection. No schema/database/auth/provider-policy changes or new dependencies.
- Initial generation creates one private copy. Subsequent inline edits update that saved identity. Conflicting in-memory versions become explicit conflict copies; changes in another browser tab block writing until existing recovery controls are used.
- Storage failure keeps the open sheet, shows Retry saving and prevents entering Lead with an unpersisted identity. Session recovery retains the working sheet. A newer compatible saved workout supersedes a stale assistant snapshot when returning from the established advanced editor.
- COT/personal notes on newly built sheets use the existing notes field. They appear in full print, Slack copy and applicable Lead COT details; no new backup field is introduced. Existing source workouts are never modified by this flow.
- The established advanced editor and imports retain their explicit Save controls. Autosave applies to the new working Q sheet; this is not a rewrite of every editing surface.
- If AI is slow, Use offline template remains available during the request, cancels it and ignores late responses. Templates remain clearly labeled and do not prove live AI availability.

## Verification

Local verification: clean `npm ci`; 396 unit/component tests across 51 files; lint; TypeScript/build; and `git diff --check` passed. Added nine focused flow/autosave regression cases and a four-viewport browser journey. Existing workflow tests now enter the explicit idea path and verify persistence through autosave rather than clicking a removed draft Save action; no assertions are skipped.

Local browser installation failed while downloading the Playwright archive. `npm run test:browser` was attempted: The checks could not launch the missing browser executables. This is an environment limitation, not a passed browser run. The existing GitHub workflow must install and execute the unchanged browser matrix before the staging mirror is advanced. Record those actual results and the exact staging commit before handoff. No production promotion is authorized.
