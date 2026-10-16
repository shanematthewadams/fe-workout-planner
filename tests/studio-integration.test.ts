import { describe, it, expect } from "vitest";
import { fallbackPlan, STYLES } from "../src/fallback";
import { plannerRequestSchema } from "../src/planner-contract";
import { sessionPhases, sessionMatches } from "../src/session";
import { elapsedAt, liveTimer } from "../src/FieldTimer";
import { mergeCloud } from "../src/cloud";
import { importStudio } from "../src/studio/import";
import { validatePlan } from "../server/planner-service";
import { copyWorkout } from "../src/model";
const request = () =>
  plannerRequestSchema.parse({
    prompt: "A Gold Rush coupon workout",
    strictSchedule: true,
    equipment: "Coupon",
    ao: "Gold Rush",
  });
describe("unified timing and fallback", () => {
  for (const mary of [true, false])
    for (const style of STYLES)
      it(`${style} fits strict timing with Mary=${mary}`, () => {
        const input = {
          ...request(),
          mary,
          builder: {
            title: "Dig for gold",
            qName: "Rug Burn",
            focus: "Full body",
            style,
            gear: ["Coupon" as const],
            terrain: "Flat parking lot",
            pax: 11,
          },
        };
        const next = fallbackPlan(input);
        expect(sessionMatches(next.workout)).toBe(true);
        expect(next.workout.kind).toBe("personal");
        expect(next.provider).toBe("Template");
        expect(() => validatePlan(next.plan, input)).not.toThrow();
        const phases = sessionPhases(mary);
        expect(phases.find((p) => p.id === "cot")?.start).toBe(2700);
        expect(phases.find((p) => p.id === "thang")?.end).toBe(
          mary ? 2340 : 2700,
        );
      });
  it("honors bodyweight / no running / no Mary in an offline request", () => {
    const next = fallbackPlan({
      ...request(),
      equipment: "None",
      running: "None",
      prompt: "Dora without coupons, no running and skip Mary",
    });
    expect(next.workout.equipment).toEqual([]);
    expect(next.workout.sections.some((s) => s.kind === "mary")).toBe(false);
    expect(next.plan.sections[1].blocks[0].instructions).toContain(
      "marches in place",
    );
    expect(sessionMatches(next.workout)).toBe(true);
  });
  it("honors plain-language exclusions when offline preferences are inferred", () => {
    const next = fallbackPlan({
      ...request(),
      equipment: "From prompt",
      running: "From prompt",
      prompt: "Bodyweight Dora, no coupons and no running",
    });
    expect(next.workout.equipment).toEqual([]);
    expect(next.plan.sections[1].blocks[0].exercises[0].name).toBe("Merkins");
    expect(next.plan.sections[1].blocks[0].instructions).toContain(
      "marches in place",
    );
  });
  it("rejects a total that fits but steals minutes from warmup", () => {
    const input = request(),
      plan = fallbackPlan(input).plan;
    plan.sections[0].blocks[0].minutes = 7;
    plan.sections[1].blocks[0].minutes = 30;
    expect(() => validatePlan(plan, input)).toThrow("strict phase");
  });
  it("catches up after sleep and caps at COT, preserving paused practice", () => {
    const state = { elapsed: 0, anchor: 1000, wall: true, cot: 10 };
    expect(elapsedAt(state, 2701000)).toBe(2700);
    expect(elapsedAt(state, 9999999)).toBe(3300);
    expect(elapsedAt({ ...state, anchor: null, elapsed: 40 }, 9999999)).toBe(
      40,
    );
  });
});
it("live mode waits for 5:30 when started early and always reaches the 6:15 hard stop", () => {
  const early = new Date(2026, 9, 16, 5, 25).getTime(),
    start = new Date(2026, 9, 16, 5, 30).getTime(),
    stop = new Date(2026, 9, 16, 6, 15).getTime();
  const state = liveTimer(early);
  expect(elapsedAt(state, early)).toBe(0);
  expect(elapsedAt(state, start)).toBe(0);
  expect(elapsedAt(state, stop)).toBe(2700);
  const late = liveTimer(start + 1800000);
  expect(elapsedAt(late, stop)).toBe(2700);
});
describe("cloud reconciliation protects independent work", () => {
  const original = copyWorkout(fallbackPlan(request()).workout);
  it("takes remote edits and propagates a deletion of an unchanged plan", () => {
    const changed = { ...original, title: "Edited on phone" };
    expect(mergeCloud([original], [original], [changed]).workouts).toEqual([
      changed,
    ]);
    expect(mergeCloud([original], [original], []).workouts).toEqual([]);
    expect(mergeCloud([original], [], [original]).workouts).toEqual([]);
  });
  it("keeps both concurrent edits and preserves edits against deletion", () => {
    const here = { ...original, title: "Laptop edit" },
      there = { ...original, title: "Phone edit" };
    const merged = mergeCloud([original], [here], [there]);
    expect(merged.workouts).toHaveLength(2);
    expect(merged.conflicts).toBe(1);
    expect(new Set(merged.workouts.map((w) => w.id)).size).toBe(2);
    expect(mergeCloud([original], [here], []).workouts[0].title).toContain(
      "Laptop edit",
    );
  });
  it("rejects malformed Studio data without coercing it into a saved plan", () => {
    expect(() => importStudio({ id: "bad", sections: {} })).toThrow();
  });
});
