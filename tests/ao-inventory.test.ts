import { expect, it } from "vitest";
import { compareInventory } from "../scripts/ao-inventory";
const report = (facts: Record<string, unknown>, extra = {}) => ({
  aoId: "fe-ao-gold-rush",
  source: "Site Q report",
  sourceUrl: "https://example.test/inventory",
  checkedAt: "2026-10-20",
  facts,
  ...extra,
});
const compare = (...reports: ReturnType<typeof report>[]) =>
  compareInventory({ format: "fe-ao-inventory", version: 1, reports });
it("compares facts without treating missing fields as removal or mutating input", () => {
  const row = report({
    name: "Gold Rush",
    siteQs: [],
    "amenities.lighting": "lit",
    "features.track": { state: "unknown" },
  });
  const original = JSON.stringify(row);
  const result = compare(row);
  expect(result.requiresReview).toBe(true);
  expect(result.groups[0].facts.map((f) => [f.field, f.status])).toEqual([
    ["amenities.lighting", "changed"],
    ["features.track", "unknown"],
    ["name", "unchanged"],
    ["siteQs", "removed"],
  ]);
  expect(JSON.stringify(row)).toBe(original);
  expect(result.groups[0].facts[0].claims[0].sourceUrl).toContain(
    "example.test",
  );
  expect(result.groups[0].baselineSource.roster.checkedAt).toBeTruthy();
});
it("keeps conflicting co-Q reports and unsupported values for review", () => {
  const result = compare(
    report({
      siteQs: ["Rug Burn", "Tyson"],
      "amenities.lighting": "neon",
      inventedTerrain: true,
    }),
    report({ siteQs: ["Another Q"] }),
  );
  expect(result.groups[0].facts.map((f) => f.status)).toEqual([
    "unsupported",
    "unsupported",
    "conflicting",
  ]);
  expect(result.groups[0].facts[2].claims).toHaveLength(2);
});
it("compares roster sets and object keys consistently", () => {
  const result = compare(
    report({ siteQs: ["Tyson", "Rug Burn"] }),
    report({ siteQs: ["Rug Burn", "Tyson"] }),
  );
  expect(result.groups[0].facts[0].status).not.toBe("conflicting");
});
it("keeps unknown AOs, unknown venues and unscoped seasonal amenities ambiguous", () => {
  for (const extra of [
    { aoId: "new-ao" },
    { venueId: "new-venue" },
    { aoId: "fe-ao-south-park" },
  ]) {
    expect(
      compare(report({ "features.track": { state: "available" } }, extra))
        .groups[0].facts[0].status,
    ).toBe("ambiguous");
  }
});
it("does not inherit amenities between seasonal venues", () => {
  const result = compare(
    report(
      { "features.pullupBars": { state: "available" } },
      { aoId: "fe-ao-south-park", venueId: "brougham-elementary" },
    ),
  );
  expect(result.groups[0].facts[0].before).not.toEqual({ state: "available" });
});
it("retains nearby placement, approximate distances, shelter and indoor permissions independently", () => {
  const result = compare(
    report({
      landmarks: [
        {
          name: "Coffee",
          description: "Across the street",
          status: "reported",
          use: "nearby",
          restrictions: "No workout permission",
          distance: { value: 0.2, unit: "miles", certainty: "approximate" },
        },
      ],
      "amenities.hasCoveredShelter": true,
      lightningShelter: "unknown",
      indoorCoffeeteria: "available",
      indoorWorkoutPermission: "denied",
    }),
  );
  const facts = result.groups[0].facts;
  expect(
    facts.find((f) => f.field === "landmarks")?.claims[0].value,
  ).toMatchObject([{ use: "nearby", distance: { certainty: "approximate" } }]);
  expect(facts.find((f) => f.field === "lightningShelter")?.status).toBe(
    "unknown",
  );
  expect(
    facts.find((f) => f.field === "indoorWorkoutPermission")?.claims[0].value,
  ).toBe("denied");
});
it.each(["2026-02-30", "yesterday"])(
  "rejects invalid review dates %s",
  (checkedAt) => {
    expect(() => compare(report({}, { checkedAt }))).toThrow();
  },
);
it("does not promote explicit null or silently accept unsupported schema fields", () => {
  expect(compare(report({ siteQs: null })).groups[0].facts[0].status).toBe(
    "unknown",
  );
  expect(() =>
    compareInventory({
      format: "fe-ao-inventory",
      version: 1,
      reports: [],
      apply: true,
    }),
  ).toThrow();
});
