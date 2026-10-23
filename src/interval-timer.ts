import { z } from "zod";

export const intervalSettingsSchema = z
  .object({
    work: z.number().int().min(1).max(300),
    rest: z.number().int().min(0).max(300),
    rounds: z.number().int().min(1).max(100),
    prepare: z.number().int().min(0).max(60),
  })
  .refine(
    (s) => (s.work + s.rest) * s.rounds <= 3600,
    "Keep an interval set to 60 minutes or less.",
  );
export type IntervalSettings = z.infer<typeof intervalSettingsSchema>;
export const TABATA: IntervalSettings = {
  work: 20,
  rest: 10,
  rounds: 8,
  prepare: 10,
};
export type IntervalState = {
  settings: IntervalSettings;
  elapsed: number;
  anchor: number | null;
};
export function intervalTotal(s: IntervalSettings) {
  return s.prepare + (s.work + s.rest) * s.rounds;
}
export function intervalElapsed(state: IntervalState, now: number) {
  return Math.min(
    intervalTotal(state.settings),
    Math.max(
      0,
      state.elapsed + (state.anchor === null ? 0 : (now - state.anchor) / 1000),
    ),
  );
}
export function intervalPhase(s: IntervalSettings, elapsed: number) {
  const total = intervalTotal(s);
  if (elapsed >= total)
    return {
      stage: "Complete" as const,
      round: s.rounds,
      remaining: 0,
      key: "complete",
    };
  if (elapsed < s.prepare)
    return {
      stage: "Get ready" as const,
      round: 0,
      remaining: s.prepare - elapsed,
      key: "prepare",
    };
  const active = Math.max(0, elapsed - s.prepare);
  const cycle = s.work + s.rest;
  const round = Math.min(s.rounds, Math.floor(active / cycle) + 1);
  const within = active % cycle;
  const work = within < s.work;
  return {
    stage: work ? ("Work" as const) : ("Rest" as const),
    round,
    remaining: (work ? s.work : cycle) - within,
    key: `${round}:${work ? "work" : "rest"}`,
  };
}
export function timerLabel(value: number) {
  const seconds = Math.ceil(Math.max(0, value));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
