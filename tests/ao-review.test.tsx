// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { AOReview } from "../src/AOReview";
import { parseAOUpdate, reviewedAO } from "../src/ao-review";
import { siteContext, describeSite } from "../src/ao-context";
import { withLocalAO, TERRAIN_KEY } from "../src/ao-drafts";
import proposal from "../data/ao-proposals/fe-ao-heartland.json";
import { contextFor } from "../server/planner-context";
import { plannerRequestSchema } from "../src/planner-contract";
afterEach(() => {
  cleanup();
  localStorage.clear();
});
it("reviews a source-backed proposal without publishing or applying device facts", () => {
  render(<AOReview />);
  fireEvent.click(screen.getByText("Review an AO update"));
  fireEvent.change(screen.getByLabelText("AO update JSON"), {
    target: { value: JSON.stringify(proposal) },
  });
  fireEvent.click(screen.getByRole("button", { name: "Review proposal" }));
  expect(screen.getByLabelText("AO proposal review")).toHaveTextContent(
    "Morgan Freeman",
  );
  expect(localStorage.getItem(TERRAIN_KEY)).toBeNull();
  fireEvent.change(screen.getByLabelText("AO update JSON"), {
    target: { value: "{}" },
  });
  expect(screen.queryByLabelText("AO proposal review")).toBeNull();
});
it("rejects unknown AOs, fabricated approval fields, invalid dates and cross-venue amenities", () => {
  for (const patch of [
    { aoId: "made-up" },
    { approved: true },
    { checkedAt: "2026-02-30" },
    {
      venues: [
        { id: "one", name: "One", season: "Summer", access: "Unknown" },
        { id: "two", name: "Two", season: "Winter", access: "Unknown" },
      ],
    },
  ])
    expect(() =>
      parseAOUpdate(JSON.stringify({ ...proposal, ...patch })),
    ).toThrow();
  expect(() =>
    reviewedAO(parseAOUpdate(JSON.stringify(proposal)), ""),
  ).toThrow();
});
it("keeps seasonal venues distinct and requires explicit confirmation of amenities", () => {
  const unknown = siteContext("South Park");
  expect(unknown.venueRequired).toBe(true);
  expect(unknown.available).toEqual([]);
  localStorage.setItem(
    TERRAIN_KEY,
    JSON.stringify({ "fe-ao-south-park": { track: { state: "available" } } }),
  );
  const summer = siteContext(
    "South Park",
    "",
    withLocalAO("South Park", "", {
      venueId: "heritage-marina",
      notes: "",
      overrides: {},
    }),
  );
  expect(summer.venue).toBe("Heritage Park Marina");
  expect(summer.features.track).toBe("unavailable");
  expect(summer.available).toContain("pullupBars");
  const winter = siteContext("South Park", "", {
    venueId: "brougham-elementary",
    notes: "",
    overrides: { track: "available" },
  });
  expect(winter.venue).toBe("Brougham Elementary");
  expect(winter.features.track).toBe("available");
});
it("gives the planner workout landmarks without converting coffee spaces or nearby places into terrain", () => {
  const heartland = siteContext("Heartland");
  expect(heartland.features.benches).toBe("available");
  expect(describeSite(heartland)).toContain("Back concrete benches");
  expect(
    heartland.landmarks.some((value) => value.name === "Indoor coffeeteria"),
  ).toBe(false);
  const clocktower = siteContext("Clocktower");
  expect(clocktower.landmarks.some((value) => value.use === "nearby")).toBe(
    false,
  );
  const stagecoach = siteContext("Stagecoach");
  expect(
    stagecoach.landmarks.some((value) => value.name === "Goose Poop Island"),
  ).toBe(false);
  const seasonal = contextFor(
    plannerRequestSchema.parse({
      ao: "South Park",
      prompt: "Bodyweight circuit",
    }),
  );
  expect(seasonal.ao?.local.activeVenue).toBeUndefined();
  expect(seasonal.site.available).toEqual([]);
  expect(seasonal.ao?.local).not.toHaveProperty("venues");
  const server = contextFor(
    plannerRequestSchema.parse({
      ao: "Heartland",
      prompt: "Bodyweight circuit",
    }),
  );
  expect(server.ao?.local.landmarks.map((value) => value.name)).toContain(
    "Back concrete benches",
  );
  expect(
    server.ao?.local.landmarks.some(
      (value) => value.use !== "workout" || value.status !== "confirmed",
    ),
  ).toBe(false);
});
