import { contextFor } from "../server/planner-context";
import { describe, it, expect, vi } from "vitest";
import { siteContext, blockedFeatures, describeSite } from "../src/ao-context";
import { plannerRequestSchema } from "../src/planner-contract";
import { fallbackPlan } from "../src/fallback";
import { validatePlan, generatePlan } from "../server/planner-service";
import { clockLabel, sessionStart, qSheet } from "../src/session";
import { elapsedAt, liveTimer } from "../src/FieldTimer";
import { parseBackup } from "../src/model";
const request = () =>
  plannerRequestSchema.parse({
    prompt: "Dora",
    ao: "Gold Rush",
    strictSchedule: true,
    equipment: "None",
    startTime: "06:30",
  });
describe("AO facts and terrain enforcement", () => {
  it("keeps source facts, unknowns and custom AOs distinct", () => {
    const gold = siteContext("Gold Rush");
    expect(gold.features.track).toBe("available");
    expect(gold.details.track?.detail).toContain("400 m");
    expect(gold.features.stairs).toBe("unknown");
    expect(siteContext("Clocktower").features.stairs).toBe("available");
    expect(siteContext("My downrange AO").available).toEqual([]);
  });
  it("applies temporary closures without changing the regional profile", () => {
    const ctx = siteContext("Clocktower", "", {
      overrides: { stairs: "unavailable" },
      notes: "The field is muddy today.",
    });
    expect(ctx.features.stairs).toBe("unavailable");
    expect(ctx.features.field).toBe("unavailable");
    expect(siteContext("Clocktower").features.field).toBe("available");
  });
  it("catches undeclared terrain in exercise names and instructions", () => {
    const input = request(),
      plan = fallbackPlan(input).plan;
    plan.sections[1].blocks[0].exercises[0].name = "Stair repeats";
    plan.requiredFeatures = [];
    expect(() => validatePlan(plan, input)).toThrow("site features");
    expect(() =>
      validatePlan(plan, {
        ...input,
        site: { overrides: { stairs: "available" }, notes: "" },
      }),
    ).not.toThrow();
  });
  it("blocks declared features even when instructions hide their use", () => {
    const plan = fallbackPlan(request()).plan;
    plan.requiredFeatures = ["walls"];
    expect(blockedFeatures(plan, siteContext("Gold Rush"))).toEqual(["walls"]);
  });
  it("never allows a source workout to supply unconfirmed facilities at a custom AO", () => {
    const input = { ...request(), ao: "Downrange" },
      plan = fallbackPlan(input).plan;
    plan.sections[1].blocks[0].instructions = "Run four laps of the track.";
    expect(() => validatePlan(plan, input)).toThrow("site features");
  });
  it("can retry a rejected facility plan through the other free provider", async () => {
    const input = request(),
      bad = fallbackPlan(input).plan,
      good = structuredClone(bad);
    bad.requiredFeatures = ["stairs"];
    const f = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              { content: { parts: [{ text: JSON.stringify(bad) }] } },
            ],
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            model: "test:free",
            choices: [{ message: { content: JSON.stringify(good) } }],
          }),
        ),
      );
    const result = await generatePlan(
      input,
      {
        GEMINI_API_KEY: "test",
        GEMINI_FREE_TIER_CONFIRMED: "true",
        OPENROUTER_API_KEY: "test",
      },
      f,
    );
    expect(f).toHaveBeenCalledTimes(2);
    expect(result.provider).toBe("OpenRouter");
  });
});
it("accepts explicit Q availability but never a hypothetical facility", () => {
  expect(
    siteContext("Downrange", "We have stadium stairs this morning.").features
      .stairs,
  ).toBe("available");
  expect(
    siteContext("Downrange", "The stairs are available this morning.").features
      .stairs,
  ).toBe("available");
  expect(
    siteContext("Downrange", "If stairs are available, use them.").features
      .stairs,
  ).toBe("unknown");
  expect(
    siteContext("Clocktower", "The field is muddy today.").features.field,
  ).toBe("unavailable");
  expect(siteContext("Clocktower", "No stairs today.").features.stairs).toBe(
    "unavailable",
  );
});
it("does not mistake tracking reps or a wall clock for facilities", () => {
  const plan = fallbackPlan({ ...request(), ao: "Downrange" }).plan;
  plan.sections[1].blocks[0].instructions =
    "Keep track of reps. Track rounds on the wall clock.";
  expect(blockedFeatures(plan, siteContext("Downrange"))).toEqual([]);
});
describe("start time follows the saved plan", () => {
  it("persists custom time through backups and renders the correct hard stop", () => {
    const w = fallbackPlan(request()).workout;
    expect(sessionStart(w)).toBe(390);
    expect(clockLabel(2700, sessionStart(w))).toBe("7:15 AM");
    expect(qSheet(w)).toContain("7:15 AM physical hard stop");
    const backup = parseBackup(
      JSON.stringify({
        format: "fe-workout-backup",
        version: 1,
        exportedAt: new Date().toISOString(),
        workouts: [w],
        favorites: [],
      }),
    );
    expect(backup.workouts[0].schedule?.startTime).toBe("06:30");
  });
  it("handles afternoon and midnight clock labels", () => {
    expect(clockLabel(2700, 18 * 60 + 30)).toBe("7:15 PM");
    expect(clockLabel(2700, 23 * 60 + 30)).toBe("12:15 AM");
  });
  it("waits for a custom live start and stops exactly 45 minutes later", () => {
    const early = new Date(2026, 9, 16, 6, 20).getTime(),
      start = new Date(2026, 9, 16, 6, 30).getTime(),
      stop = new Date(2026, 9, 16, 7, 15).getTime(),
      timer = liveTimer(early, 10, "06:30");
    expect(elapsedAt(timer, early)).toBe(0);
    expect(elapsedAt(timer, start)).toBe(0);
    expect(elapsedAt(timer, stop)).toBe(2700);
  });
});

describe("structured AO amenities", () => {
  it("accepts the Studio JSON shape and supplies it in AI context without inventing other features", () => {
    const amenities = {
      couponsOnSite: true,
      hasCoveredShelter: true,
      hasTrack: false,
      hasBleachers: true,
      hasPullUpBars: false,
      surface: "turf_and_asphalt" as const,
      lighting: "lit" as const,
    };
    const input = plannerRequestSchema.parse({
      ...request(),
      ao: "Custom AO",
      site: { amenities },
    });
    const context = contextFor(input).site;
    expect(context.amenities).toEqual(amenities);
    expect(context.features).toMatchObject({
      shelter: "available",
      track: "unavailable",
      bleachers: "available",
      pullupBars: "unavailable",
      field: "unknown",
      stairs: "unknown",
    });
    expect(describeSite(context)).toContain(
      "Surface: Turf and asphalt. Lighting: Lit.",
    );
  });
  it("keeps missing facts unknown and distinguishes confirmed absence", () => {
    expect(siteContext("Gold Rush").amenities).toMatchObject({
      hasTrack: true,
      hasBleachers: null,
      couponsOnSite: null,
      surface: "unknown",
      lighting: "unknown",
    });
    expect(siteContext("Clocktower").amenities.hasCoveredShelter).toBe(true);
    expect(siteContext("Custom").amenities.hasTrack).toBeNull();
    expect(
      siteContext("Custom", "", {
        overrides: {},
        notes: "",
        amenities: { hasTrack: false },
      }).features.track,
    ).toBe("unavailable");
  });
  it("keeps amenities and facility guards consistent after temporary closures", () => {
    const context = siteContext("Custom", "The bleachers are closed.", {
      overrides: {},
      notes: "",
      amenities: { hasBleachers: true },
    });
    expect(context.amenities.hasBleachers).toBe(false);
    expect(context.features.bleachers).toBe("unavailable");
    expect(
      siteContext("Gold Rush", "", {
        overrides: { track: "unavailable" },
        notes: "",
      }).amenities.hasTrack,
    ).toBe(false);
    expect(siteContext("Gold Rush").amenities.hasTrack).toBe(true);
  });
  it("does not treat stairs as confirmed bleachers", () => {
    const input = { ...request(), ao: "Clocktower" },
      plan = fallbackPlan(input).plan;
    plan.sections[1].blocks[0].instructions = "Use the bleachers for repeats.";
    expect(() => validatePlan(plan, input)).toThrow("site features");
    expect(() =>
      validatePlan(plan, {
        ...input,
        site: { overrides: {}, notes: "", amenities: { hasBleachers: true } },
      }),
    ).not.toThrow();
  });
  it("permits brought coupons even when none are stored on site", () => {
    const input = {
      ...request(),
      equipment: "Coupon" as const,
      site: { overrides: {}, notes: "", amenities: { couponsOnSite: false } },
    };
    const next = fallbackPlan(input);
    expect(next.workout.equipment).toEqual(["Coupon"]);
    expect(next.workout.schedule?.siteSummary).toContain(
      "no; bring your own if needed",
    );
    expect(() => validatePlan(next.plan, input)).not.toThrow();
  });
  it("rejects invalid amenity values at the request boundary", () => {
    expect(
      plannerRequestSchema.safeParse({
        ...request(),
        site: { amenities: { hasTrack: "yes" } },
      }).success,
    ).toBe(false);
    expect(
      plannerRequestSchema.safeParse({
        ...request(),
        site: { amenities: { lighting: "probably" } },
      }).success,
    ).toBe(false);
  });
});
