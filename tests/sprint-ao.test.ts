import { qSheet, workoutPhases } from "../src/session";
import { expect, it, vi } from "vitest";
import { siteContext } from "../src/ao-context";
import { fallbackPlan } from "../src/fallback";
import { resolveRequest } from "../src/planner-contract";
import { validatePlan } from "../server/planner-service";
import {
  fetchNationDirectory,
  directoryCandidates,
} from "../scripts/nation-directory";
it("shares marina facts only after confirming the seasonal venue and preserves closures", () => {
  expect(siteContext("South Park").features.pullupBars).toBe("unknown");
  const confirmed = siteContext("South Park", "", {
    venueId: "heritage-marina",
    overrides: {},
    notes: "",
  });
  expect(confirmed.features.pullupBars).toBe(
    siteContext("Southstride").features.pullupBars,
  );
  expect(confirmed.features.pullupBars).toBe("available");
  expect(
    siteContext("South Park", "", {
      venueId: "brougham-elementary",
      overrides: {},
      notes: "",
    }).features.pullupBars,
  ).toBe("unknown");
  expect(
    siteContext("South Park", "pull-up bars are closed", {
      venueId: "heritage-marina",
      overrides: {},
      notes: "",
    }).features.pullupBars,
  ).toBe("unavailable");
});
it.each(["Run", "Ruck"])(
  "makes a timed %s route without mandatory warmup or Mary",
  (activity) => {
    const request = resolveRequest({
      prompt: "Plan a route with regrouping",
      minutes: 45,
      strictSchedule: true,
      mary: false,
      planning: {
        activity,
        route: "Q will confirm",
        distance: "3 miles",
        pace: "Conversational",
      },
    });
    const result = fallbackPlan(request);
    expect(result.plan.sections.map((section) => section.kind)).toEqual([
      "thang",
    ]);
    expect(result.plan.sections[0].blocks[0].minutes).toBe(43);
    expect(result.workout.sections.map((section) => section.kind)).toEqual([
      "thang",
    ]);
    expect(result.workout.format).toBe("Custom");
    expect(
      workoutPhases(result.workout)?.map(
        (phase) => phase.sectionKind ?? phase.id,
      ),
    ).toEqual(["welcome", "thang", "cot"]);
    expect(qSheet(result.workout)).toContain("6:15 AM physical hard stop");
    expect(qSheet(result.workout)).not.toContain(
      "Review session timing before leading.",
    );

    expect(() => validatePlan(result.plan, request)).not.toThrow();
    if (activity === "Ruck") expect(result.workout.equipment).toEqual(["Ruck"]);
  },
);
it("strips contacts, validates region and creates review candidates without modifying local records", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          orgs: [
            {
              orgId: 100,
              name: "South Park",
              orgType: "ao",
              hierarchy: [[5, "The FE", "region"]],
              activeLocations: [
                { locationId: 6, latitude: 38, longitude: -94 },
              ],
              email: "private@example.test",
            },
          ],
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          location: {
            id: 6,
            locationName: "Marina",
            regionId: 5,
            isActive: true,
            latitude: 38,
            longitude: -94,
            addressStreet: null,
            addressCity: null,
            addressState: null,
            email: "private@example.test",
          },
        }),
      ),
    );
  const directory = await fetchNationDirectory({
    token: "fixture",
    regionId: 5,
    fetcher: fetcher as typeof fetch,
  });
  const local = [{ id: "fe-ao-south-park", name: "South Park" }];
  expect(directoryCandidates(directory, local)[0]).toMatchObject({
    localId: "fe-ao-south-park",
    status: "needs-review",
  });
  expect(JSON.stringify(directory)).not.toContain("email");
  expect(local).toEqual([{ id: "fe-ao-south-park", name: "South Park" }]);
  expect(fetcher.mock.calls[1][0]).toContain("location/id/6");
});
it("does not silently accept wrong-region location records", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          orgs: [
            {
              orgId: 100,
              name: "South Park",
              orgType: "ao",
              hierarchy: [[5, "The FE", "region"]],
              activeLocations: [
                { locationId: 6, latitude: 38, longitude: -94 },
              ],
            },
          ],
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          location: {
            id: 6,
            locationName: "Wrong",
            regionId: 999,
            isActive: true,
            latitude: null,
            longitude: null,
            addressStreet: null,
            addressCity: null,
            addressState: null,
          },
        }),
      ),
    );
  await expect(
    fetchNationDirectory({
      token: "fixture",
      regionId: 5,
      fetcher: fetcher as typeof fetch,
    }),
  ).rejects.toThrow("mismatch");
});

it("preserves verified Nation links and local-only AOs during a regional schedule refresh", async () => {
  const { mergeSchedule } = await import("../scripts/ao-sync.mjs");
  const previous = [
    { id: "existing", name: "Old", nationOrgId: 9 },
    { id: "local-only", name: "Local" },
  ];
  const merged = mergeSchedule(previous, [{ id: "existing", name: "Updated" }]);
  expect(merged).toEqual([
    { id: "existing", name: "Updated", nationOrgId: 9 },
    { id: "local-only", name: "Local" },
  ]);
  expect(previous[0].name).toBe("Old");
  expect(() =>
    mergeSchedule(previous, [
      { id: "duplicate", name: "Duplicate" },
      { id: "duplicate", name: "Duplicate" },
    ]),
  ).toThrow("duplicate");
});

it("passes the route contract to the shared provider handler and accepts a one-section route", async () => {
  const { generatePlan } = await import("../server/planner-service");
  const request = resolveRequest({
    prompt: "A conversational ruck",
    strictSchedule: true,
    mary: false,
    planning: { activity: "Ruck" },
  });
  const plan = fallbackPlan(request).plan;
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(
      JSON.stringify({
        model: "fixture:free",
        choices: [{ message: { content: JSON.stringify(plan) } }],
      }),
    ),
  );
  const result = await generatePlan(
    request,
    { OPENROUTER_API_KEY: "fixture" },
    fetcher,
  );
  expect(result.provider).toBe("OpenRouter");
  expect(result.workout.sections.map((section) => section.kind)).toEqual([
    "thang",
  ]);
  expect(
    JSON.parse(fetcher.mock.calls[0][1]!.body as string).messages[0].content,
  ).toContain("ROUTE SESSION overrides bootcamp phase rules");
});
