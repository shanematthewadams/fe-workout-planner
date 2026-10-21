import { expect, it } from "vitest";
import { siteContext } from "../src/ao-context";
import { aoProfiles } from "../src/discovery";
import { fallbackPlan } from "../src/fallback";
import { resolveRequest } from "../src/planner-contract";
import { validatePlan } from "../server/planner-service";
it("grounds new reports without promoting legacy inventory flags or storage", () => {
  for (const name of ["Gold Rush", "Stagecoach", "Dysentery", "Sunnyside Up"]) {
    const site = siteContext(name);
    expect(site.features.shelter).toBe("available");
    expect(site.amenities.couponsOnSite).toBeNull();
    expect(site.sourceUrl).toContain("1bc2SK_");
    expect(
      aoProfiles.find((a) => a.name === name)?.local.reviewBasis,
    ).toContain("source record");
  }
  expect(siteContext("Gold Rush").features).toMatchObject({
    track: "available",
    field: "available",
    stairs: "available",
    walls: "available",
    benches: "available",
    bleachers: "unknown",
    pullupBars: "unknown",
  });
});
it("keeps uncertain distances, nearby facilities and partial lighting distinct", () => {
  const sunny = siteContext("Sunnyside Up");
  expect(sunny.features.field).toBe("unknown");
  expect(sunny.features.pullupBars).toBe("unknown");
  expect(sunny.landmarks.map((x) => x.name)).not.toContain(
    "Arbor Landing Park",
  );
  expect(sunny.accessNotes).toContain("approximate");
  expect(sunny.amenities.lighting).toBe("partially_lit");
  expect(siteContext("Dysentery").features.stairs).toBe("unknown");
  expect(siteContext("Stagecoach").landmarks.map((x) => x.name)).not.toContain(
    "Goose Poop Island",
  );
});
it("preserves a closure over newly reported amenities and temporary positive overrides", () => {
  const input = resolveRequest({
    prompt: "The stairs are closed today",
    ao: "Gold Rush",
    strictSchedule: true,
    equipment: "None",
    site: { overrides: { stairs: "available" } },
  });
  const plan = fallbackPlan(input).plan;
  plan.sections[1].blocks[0].exercises[0].name = "Stair repeats";
  expect(() => validatePlan(plan, input)).toThrow("site features");
  expect(siteContext("Gold Rush").features.stairs).toBe("available");
});
it("accepts brought coupons at an unknown site without publishing a stash", () => {
  const input = resolveRequest({
    prompt: "We have coupons available today. No running",
    ao: "Unknown pilot AO",
    strictSchedule: true,
    site: { amenities: { couponsOnSite: true } },
  });
  expect(input.equipment).toBe("Coupon");
  expect(() => validatePlan(fallbackPlan(input).plan, input)).not.toThrow();
  expect(siteContext("Unknown pilot AO").amenities.couponsOnSite).toBeNull();
});
