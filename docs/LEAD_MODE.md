# Lead workout

**Lead workout** opens a readable workout sheet with no timer running. The main work is expanded; warmup, Mary and notes are optional disclosures. Reps and authored directions remain, while the cadence trainer and counting badges have been removed from this view.

Choose **Session timer** for the saved workout's session countdown, or **Intervals** for a separate interval set. Sound defaults to **Off**. Choose **Beeps** or **Voice**, then use **Preview sound** while paused. Selecting a sound also confirms the choice with a beep or “Voice on.” Start, pause/resume and reset are the primary controls. Pause before changing timer modes. Keep the screen open and phone volume up for audio; screen wake lock is requested where supported. Mobile browsers may suspend audio when locked.

Session timing retains its existing recovery key, saved block timing, physical hard stop and COT handling. Incomplete/inconsistent timing still requires an explicit choice to use the standard schedule. Scheduled-start and COT controls live under Schedule & session settings. No workout or database schema changes.

## Intervals

The Tabata-style preset is 20 seconds work, 10 seconds rest, 8 rounds, plus 10 seconds to get ready. The active set is 4 minutes; the final rest period is included. Custom intervals allow 1–300 seconds work, 0–300 seconds rest, 1–100 rounds, and 0–60 seconds preparation. Active sets are capped at 60 minutes. Reset before changing a started set.

The clock derives elapsed time from timestamps rather than counting ticks, so a delayed render catches up. Optional cues distinguish work, rest and completion, with pips in the last three seconds. Hidden-screen catch-up does not replay a queue of old cues. This interval set has its own clock; it does not rewrite or claim to enforce the workout's scheduled finish.

Interval state is local, scoped to the workout and revision, and expires on a new day. Leaving Lead pauses an interval set for recovery. Reopening never auto-enables sounds. Invalid stored settings are ignored. Workouts remain usable if timer storage or screen wake lock is unavailable.

## Design and importing

Main screen titles and section signposts use uppercase Big Shoulders Display; authored workout names and instructions retain their case. Manrope remains the body font. Import entry copy now explains bringing a workout from ChatGPT or Gemini, with the action **Import a workout**. The import screen explains Markdown and the chat prompt before asking for pasted text.

## Focus timer

Starting or resuming intervals opens focus mode: setup, workout chrome and explanatory paragraphs give way to the phase, large tabular countdown, round, next phase and whole-set progress. Work uses gold; rest uses warm white, with explicit text for both. Sound mode can be changed in focus. Exit focus (or Escape) reveals the plan controls without stopping the set. Space pauses/resumes when the timer panel has keyboard focus; repeated keydown events are ignored. Native button keyboard behavior remains intact. Reset asks before discarding progress and returns to setup.

A 40/20 × 8 preset complements 20/10 Tabata and custom settings. The next-phase preview handles zero-rest intervals and the final rest correctly. The timer adapts to portrait and short landscape screens. A small staging label remains visible in focus mode.

A `pagehide` interruption now freezes the in-memory timer as well as its recovery record, including when the browser restores the same page from its back/forward cache. A hidden tab otherwise catches up from timestamps, without replaying missed cues. Screen wake-lock requests are deduplicated while pending; grants received after stopping or hiding are released. These features do not guarantee audio or operation while a phone is locked.

## Spoken cues

**Voice** uses the browser's speech synthesis, preferring a local English voice where available. It replaces interval beeps. Preparation and rest count down “Three, two, one,” then work begins with “Go.” Work announces “Halfway,” counts “Five, four, three, two, one,” then says “Stop” at rest. The set ends with “Stop. Set complete.” Work under 12 seconds skips halfway so it cannot crowd the final countdown. Zero-rest rounds say “Go” at the next round; no competing stop/go commands are queued. Session timers use “Timer started,” “Next section” and “Session complete,” rather than interval countdowns.

Each cue replaces outstanding speech. Pause, mute, reset, page hiding/leaving and switching timer modes cancel speech. Focus changes leave the clock alone. Missed cues are discarded after delayed rendering; no old countdown is replayed. A voice that errors or cannot start within 700 milliseconds is cancelled, and the UI visibly switches to beeps. Preview is disabled while running to avoid interrupting cues. Sound stays off when reopening Lead.

Voice quality and availability depend on the browser/OS; some installed/default voices can use a remote service. The app sends only fixed cue words to speech synthesis, never workout text, and adds no AI API calls or paid services. Screen lock/background audio is not guaranteed. Reference: [SpeechSynthesis cancellation](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/cancel).

Verification includes pure boundary/freshness tests, mocked speech start/error/cancellation and voice selection tests, and four browser profiles exercising the UI with deterministic speech synthesis. The existing browser journey also runs native Web Audio beeps. Automated speech tests verify the app's cue commands and cleanup, not a physical phone speaker or its installed voice.
