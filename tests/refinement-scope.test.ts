import { expect, it } from "vitest";
import { resolveRequest } from "../src/planner-contract";
import { fallbackPlan } from "../src/fallback";
import { validatePlan } from "../server/planner-service";

const setup = () => {
  const original = resolveRequest({
    prompt: "Bodyweight only, no running",
    strictSchedule: true,
  });
  const current = fallbackPlan(original).plan;
  const exercise = current.sections[1].blocks[0].exercises[0];
  return {
    current,
    exercise,
    request: resolveRequest({
      ...original,
      prompt: `Replace ${exercise.name} with lunges`,
      current,
    }),
  };
};
it("rejects an unrelated restart when only one exercise was requested", () => {
  const { current, request } = setup();
  const changed = structuredClone(current);
  changed.title = "A completely different workout";
  changed.sections[1].blocks[0].exercises[0].name = "Lunges";
  changed.sections[0].blocks[0].exercises[0].amount = "99";
  expect(() => validatePlan(changed, request)).toThrow(/unrequested/);
});
it("accepts a targeted exercise replacement and preserves the input", () => {
  const { current, request } = setup();
  const before = JSON.stringify(current);
  const changed = structuredClone(current);
  changed.sections[1].blocks[0].exercises[0] = {
    name: "Lunges",
    amount: "10",
    unit: "reps",
    counting: "per side",
    instructions: "Step back and return to standing. Reduce depth as needed.",
  };
  expect(() => validatePlan(changed, request)).not.toThrow();
  expect(JSON.stringify(current)).toBe(before);
});
it("rejects changes to another exercise or block during a targeted replacement", () => {
  const { current, request } = setup();
  for (const field of ["amount", "instructions"] as const) {
    const changed = structuredClone(current);
    changed.sections[1].blocks[0].exercises[0].name = "Lunges";
    changed.sections[2].blocks[0].exercises[0][field] = "Unexpected change";
    expect(() => validatePlan(changed, request)).toThrow(/unrequested/);
  }
});
it("allows broad revisions to redesign the workout", () => {
  const { current, request } = setup();
  request.prompt = "Redesign this as a new bodyweight circuit";
  const changed = structuredClone(current);
  changed.title = "A new circuit";
  expect(() => validatePlan(changed, request)).not.toThrow();
});
