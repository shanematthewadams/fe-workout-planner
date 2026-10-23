import { describe, expect, it } from "vitest";
import {
  movements,
  mentionedMovements,
  searchMovements,
} from "../src/movements";
import { fallbackPlan } from "../src/fallback";
import { resolveRequest } from "../src/planner-contract";
import { validatePlan } from "../server/planner-service";
import { contextFor } from "../server/planner-context";
import { catalog } from "../src/catalog";
import { filtersEmpty, matches } from "../src/model";

const input = () =>
  resolveRequest({
    prompt: "Bodyweight only. No running.",
    equipment: "None",
    running: "None",
    strictSchedule: true,
  });
describe("shared movement catalog", () => {
  it("has unique stable IDs, explicit requirements, counting, and alternatives", () => {
    expect(movements.length).toBeGreaterThan(40);
    expect(new Set(movements.map((m) => m.id)).size).toBe(movements.length);
    for (const m of movements) {
      expect(m.id).toMatch(/^[a-z0-9-]+$/);
      expect(m.counting.length).toBeGreaterThan(10);
      expect(m.alternative.length).toBeGreaterThan(10);
      expect(m.equipment).toBeInstanceOf(Array);
      expect(m.features).toBeInstanceOf(Array);
    }
  });
  it.each([
    "Blockees",
    "WW3s",
    "WWIII",
    "BOR",
    "OHP",
    "Thrusters",
    "Curls for the Girls",
    "Farmer carries",
  ])("recognizes gear hidden in %s", (name) => {
    expect(mentionedMovements(name).some((m) => m.equipment.length)).toBe(true);
  });
  it.each([
    "No blockees",
    "Without WW3",
    "Skip thrusters",
    "Replace blockees with squats",
    "Boring squat hold",
    "Run the clock",
  ])("does not invent a loaded movement from %s", (text) => {
    expect(mentionedMovements(text).some((m) => m.equipment.length)).toBe(
      false,
    );
  });
  it("searches aliases, requirements, punctuation, and categories", () => {
    expect(searchMovements("decline merkin").map((m) => m.name)).toContain(
      "Derkin",
    );
    expect(searchMovements("cdd").map((m) => m.name)).toContain(
      "Carolina Dry Dock (CDD)",
    );
    expect(searchMovements("coupon ww3").map((m) => m.name)).toEqual(["WW3"]);
    expect(searchMovements("unfindable")).toEqual([]);
  });
  it.each([
    "Run the clock",
    "Running total",
    "No running",
    "Skip shuttle sprints",
  ])("does not mistake %s for executable travel", (text) => {
    expect(mentionedMovements(text).some((m) => m.running)).toBe(false);
  });
  it.each(["Blockees", "WW3", "BOR", "OHP", "Thrusters"])(
    "rejects %s in a misleading no-gear draft",
    (name) => {
      const request = input(),
        plan = fallbackPlan(request).plan;
      plan.sections[1].blocks[0].exercises[0].name = name;
      plan.sections[1].blocks[0].exercises[0].instructions =
        "Ten controlled reps.";
      expect(() => validatePlan(plan, request)).toThrow("gear");
    },
  );
  it.each(["Erkins", "Dips", "People's chair"])(
    "rejects unconfirmed fixed support hidden in %s",
    (name) => {
      const request = input(),
        plan = fallbackPlan(request).plan;
      plan.sections[1].blocks[0].exercises[0].name = name;
      plan.sections[1].blocks[0].exercises[0].instructions =
        "Ten controlled reps.";
      expect(() => validatePlan(plan, request)).toThrow("unconfirmed");
    },
  );
  it("uses the same structured requirements in provider context", () => {
    const context = contextFor(
      resolveRequest({
        prompt: "WW3 and derkins",
        equipment: "Coupon",
        site: { notes: "", overrides: { benches: "available" } },
      }),
    );
    expect(context.exercises.length).toBeLessThanOrEqual(24);
    expect(context.exercises.find((e) => e.name === "WW3")?.equipment).toEqual([
      "Coupon",
    ]);
    expect(
      context.exercises.find((e) => e.name === "Derkin")?.requiredFeatures,
    ).toEqual(["benches"]);
    expect(context.exerciseGuideWarning).toContain("not verified");
  });
  it("excludes unavailable requirements before sending a compact, varied provider guide", () => {
    const context = contextFor(input());
    expect(context.exercises.length).toBeLessThanOrEqual(24);
    expect(
      context.exercises.every(
        (m) => !m.equipment.length && !m.requiredFeatures.length && !m.running,
      ),
    ).toBe(true);
    expect(context.exercises.some((m) => m.name === "American Hammer")).toBe(
      true,
    );
    expect(JSON.stringify(context.exercises).length).toBeLessThan(18000);
  });
  it("searches workout movement aliases across words", () => {
    expect(
      matches(catalog[0], { ...filtersEmpty, query: "pushup circle" }),
    ).toBe(true);
  });
  it.each([
    "Run the clock and rotate in place.",
    "Without dumbbells. No kettlebells.",
    "Skip shuttle sprints. Hold a plank.",
  ])("accepts explicit exclusions and clock directions: %s", (instructions) => {
    const request = input(),
      plan = fallbackPlan(request).plan;
    plan.sections[1].blocks[0].instructions = instructions;
    expect(() => validatePlan(plan, request)).not.toThrow();
  });
  it("does not let misleading metadata enter no-gear or no-running results", () => {
    const workout = structuredClone(catalog[0]);
    workout.equipment = [];
    workout.running = "None";
    workout.sections[0].blocks[0].exercises[0].name = "WW3";
    expect(matches(workout, { ...filtersEmpty, equipment: "None" })).toBe(
      false,
    );
    workout.sections[0].blocks[0].exercises[0].name = "Shuttle sprint";
    expect(matches(workout, { ...filtersEmpty, running: "None" })).toBe(false);
  });
});
