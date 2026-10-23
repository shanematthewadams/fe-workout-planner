import {
  intervalPhase,
  intervalTotal,
  type IntervalSettings,
} from "./interval-timer";
const words = ["", "One", "Two", "Three", "Four", "Five"];
/** Return only a fresh cue for the current moment, never a list of missed cues. */
export function intervalVoiceCue(
  settings: IntervalSettings,
  previous: number,
  elapsed: number,
) {
  if (elapsed <= previous) return null;
  const phase = intervalPhase(settings, elapsed);
  const before = intervalPhase(settings, previous);
  if (phase.key !== before.key) {
    const duration = phase.stage === "Work" ? settings.work : settings.rest;
    const age =
      phase.stage === "Complete"
        ? elapsed - intervalTotal(settings)
        : duration - phase.remaining;
    if (age > 0.5) return null;
    if (phase.stage === "Complete") return "Stop. Set complete.";
    if (phase.stage === "Work") return "Go";
    if (phase.stage === "Rest") return "Stop";
    return null;
  }
  const seconds = Math.ceil(phase.remaining);
  const limit = phase.stage === "Work" ? 5 : 3;
  // A delayed render may say the current number, but never recite skipped ones.
  if (
    seconds >= 1 &&
    seconds <= limit &&
    Math.ceil(before.remaining) > seconds &&
    seconds - phase.remaining <= 0.5
  )
    return words[seconds];
  // Leave room between the halfway call and the five-second countdown.
  if (phase.stage === "Work" && settings.work >= 12) {
    const halfway = settings.work / 2;
    if (
      before.remaining > halfway &&
      phase.remaining <= halfway &&
      halfway - phase.remaining <= 0.5
    )
      return "Halfway";
  }
  return null;
}
