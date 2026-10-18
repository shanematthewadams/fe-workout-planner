# Lead workout

**Lead workout** opens a readable workout sheet with no timer running. The main work is expanded; warmup, Mary and notes are optional disclosures. Reps and authored directions remain, while the cadence trainer and counting badges have been removed from this view.

Choose **Session timer** for the saved workout's session countdown, or **Intervals** for a separate interval set. Sounds are off by default. **Enable sounds** plays a test beep and enables phase cues. Start, pause/resume and reset are the primary controls. Pause before changing timer modes. Keep the screen open and phone volume up for audio; screen wake lock is requested where supported. Mobile browsers may suspend audio when locked.

Session timing retains its existing recovery key, saved block timing, physical hard stop and COT handling. Incomplete/inconsistent timing still requires an explicit choice to use the standard schedule. Scheduled-start and COT controls live under Schedule & session settings. No workout or database schema changes.

## Intervals

The Tabata-style preset is 20 seconds work, 10 seconds rest, 8 rounds, plus 10 seconds to get ready. The active set is 4 minutes; the final rest period is included. Custom intervals allow 1–300 seconds work, 0–300 seconds rest, 1–100 rounds, and 0–60 seconds preparation. Active sets are capped at 60 minutes. Reset before changing a started set.

The clock derives elapsed time from timestamps rather than counting ticks, so a delayed render catches up. Optional cues distinguish work, rest and completion, with pips in the last three seconds. Hidden-screen catch-up does not replay a queue of old cues. This interval set has its own clock; it does not rewrite or claim to enforce the workout's scheduled finish.

Interval state is local, scoped to the workout and revision, and expires on a new day. Leaving Lead pauses an interval set for recovery. Reopening never auto-enables sounds. Invalid stored settings are ignored. Workouts remain usable if timer storage or screen wake lock is unavailable.

## Design and importing

Main screen titles and section signposts use uppercase Big Shoulders Display; authored workout names and instructions retain their case. Manrope remains the body font. Import entry copy now explains bringing a workout from ChatGPT or Gemini, with the action **Import a workout**. The import screen explains Markdown and the chat prompt before asking for pasted text.

## Focus timer

Starting or resuming intervals opens focus mode: setup, workout chrome and explanatory paragraphs give way to the phase, large tabular countdown, round, next phase and whole-set progress. Work uses gold; rest uses warm white, with explicit text for both. Sounds can be toggled in focus. Exit focus (or Escape) reveals the plan controls without stopping the set. Space pauses/resumes when the timer panel has keyboard focus; repeated keydown events are ignored. Native button keyboard behavior remains intact. Reset asks before discarding progress and returns to setup.

A 40/20 × 8 preset complements 20/10 Tabata and custom settings. The next-phase preview handles zero-rest intervals and the final rest correctly. The timer adapts to portrait and short landscape screens. A small staging label remains visible in focus mode.

A `pagehide` interruption now freezes the in-memory timer as well as its recovery record, including when the browser restores the same page from its back/forward cache. A hidden tab otherwise catches up from timestamps, without replaying missed cues. Screen wake-lock requests are deduplicated while pending; grants received after stopping or hiding are released. These features do not guarantee audio or operation while a phone is locked.
