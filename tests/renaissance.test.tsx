// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import App from "../src/App";
import { Planner } from "../src/Planner";
import { FieldTimer } from "../src/FieldTimer";
import { siteContext, describeSite } from "../src/ao-context";
import {
  withLocalAO,
  readTerrainDrafts,
  TERRAIN_KEY,
  retainQContext,
} from "../src/ao-drafts";
import { contextFor } from "../server/planner-context";
import { validatePlan } from "../server/planner-service";
import { fallbackPlan, GEAR } from "../src/fallback";
import { plannerRequestSchema } from "../src/planner-contract";
import { aoProfiles } from "../src/discovery";
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const empty = { overrides: {}, notes: "" };
const props = {
  onEdit: vi.fn(),
  onPreview: vi.fn(),
  onSave: () => true,
  onReference: vi.fn(),
};
it("propagates unpublished AO changes through directory, builder, API context and validator", async () => {
  render(<App />);
  fireEvent.click(screen.getByText("More", { selector: "summary" }));
  fireEvent.click(screen.getByRole("button", { name: "AO Directory" }));
  fireEvent.change(screen.getByLabelText("Search AOs"), {
    target: { value: "Gold Rush" },
  });
  expect(
    screen.getByText("Unknown", { selector: ".site-q-pill" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Edit local AO notes" }));
  fireEvent.change(screen.getByLabelText("Track for Gold Rush"), {
    target: { value: "unavailable" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Build" }));
  fireEvent.change(screen.getByLabelText("Q location"), {
    target: { value: "Gold Rush" },
  });
  fireEvent.click(screen.getByText("Anything different today?"));
  expect(screen.getByLabelText("Track today")).toHaveDisplayValue(
    "Profile: unavailable",
  );
  const request = plannerRequestSchema.parse({
    prompt: "Partner grinder",
    ao: "Gold Rush",
    site: withLocalAO("Gold Rush", "", empty),
  });
  const context = contextFor(request).site;
  expect(context.features.track).toBe("unavailable");
  expect(context.amenities.hasTrack).toBe(false);
  expect(describeSite(context)).toContain("Unpublished device edits");
  const plan = fallbackPlan(request).plan;
  plan.sections[1].blocks[0].instructions = "Run laps on the track.";
  expect(() => validatePlan(plan, request)).toThrow("site features");
  // Base regional snapshot remains unchanged.
  expect(siteContext("Gold Rush").features.track).toBe("available");
  expect(withLocalAO("Custom", "", request.site!)).not.toHaveProperty(
    "localDraft",
  );
});
it("temporary closures and unknown override local availability without publishing", () => {
  const localDraft = { track: { state: "available" as const } };
  expect(
    siteContext("Gold Rush", "", {
      ...empty,
      localDraft,
      amenities: { hasTrack: false },
    }).features.track,
  ).toBe("unavailable");
  expect(
    siteContext("Gold Rush", "", {
      ...empty,
      localDraft,
      overrides: { track: "unknown" },
    }).amenities.hasTrack,
  ).toBeNull();
  expect(
    siteContext("Gold Rush", "The track is closed", {
      ...empty,
      localDraft,
      overrides: { track: "available" },
    }).features.track,
  ).toBe("unavailable");
});
it("rejects corrupt local terrain and never defaults unknown Site Qs to people", () => {
  localStorage.setItem(
    TERRAIN_KEY,
    '{"fe-ao-gold-rush":{"track":{"state":"maybe"}}}',
  );
  expect(readTerrainDrafts()).toEqual({});
  expect(
    plannerRequestSchema.safeParse({
      prompt: "Build a plan",
      site: { localDraft: { track: { state: "maybe" } } },
    }).success,
  ).toBe(false);
  expect(aoProfiles.every((a) => !Object.hasOwn(a, "siteQ"))).toBe(true);
});
it("surprise without an AO sends a neutral location with no fabricated facility or gear", async () => {
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(
      async (_url, init) =>
        new Response(
          JSON.stringify(
            fallbackPlan(
              plannerRequestSchema.parse(JSON.parse(String(init?.body))),
            ),
          ),
        ),
    );
  render(<Planner {...props} />);
  fireEvent.change(screen.getByLabelText("Describe your Q"), {
    target: { value: "No coupons. The track is closed." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Surprise Me!" }));
  await screen.findByLabelText("Generated workout draft");
  const sent = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
  expect(sent.site.overrides.track).toBe("unavailable");
  expect(sent.ao).toBe("");
  expect(sent.builder.gear).toEqual([]);
  expect(screen.getByLabelText("Q location")).toHaveValue("");
  expect(GEAR).not.toContain("Bleachers / stairs");
  expect(GEAR).not.toContain("Pull-up bar");
});
it("formal portable gear never confirms fixed terrain", () => {
  render(<Planner {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Formal Builder" }));
  expect(screen.queryByLabelText("Bleachers / stairs")).toBeNull();
  fireEvent.click(screen.getByLabelText("Coupon"));
  fireEvent.click(screen.getByRole("button", { name: "Use offline template" }));
  expect(screen.getByLabelText("Generated workout draft")).toHaveTextContent(
    "Offline template",
  );
  const stored = JSON.parse(sessionStorage.getItem("fe-planner:assistant:v1")!);
  expect(stored.result.workout.equipment).toEqual(["Coupon"]);
  expect(stored.preferences.site.overrides).toEqual({});
});
it("keeps exactly three primary destinations and moves backup controls out of library", () => {
  render(<App />);
  const nav = screen.getByRole("navigation", { name: "Planner navigation" });
  expect(
    Array.from(nav.querySelectorAll(":scope > button")).map(
      (b) => b.textContent,
    ),
  ).toEqual(["Build", "Library", "My Workouts"]);
  fireEvent.click(screen.getByRole("button", { name: "Library" }));
  expect(
    screen.queryByRole("navigation", { name: "Workout collections" }),
  ).toBeNull();
  expect(screen.queryByText("Import backup")).toBeNull();
  fireEvent.click(screen.getByText(/reviewed FE workouts ·/));
  expect(
    screen.getByText(/Backblasts may have timing or exercise gaps/),
  ).toBeVisible();
});
it("can stop a live timer and move through exercises without changing phase time", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 17, 5, 41));
  const workout = fallbackPlan(
    plannerRequestSchema.parse({
      prompt: "Build a grinder",
      strictSchedule: true,
    }),
  ).workout;
  render(<FieldTimer workout={workout} onExit={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "Mute audio" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Join live 5:30 AM schedule" }),
  );
  expect(screen.getByRole("timer")).toHaveTextContent("34:00");
  expect(screen.getByText("1 of 4")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Next exercise" }));
  expect(screen.getByText("2 of 4")).toBeVisible();
  expect(screen.getByRole("timer")).toHaveTextContent("34:00");
  fireEvent.click(screen.getByRole("button", { name: "Stop live timer" }));
  expect(screen.getByRole("button", { name: "Resume" })).toBeEnabled();
});

it("keeps Q confirmations through refinement without overriding today's unknown", () => {
  expect(
    retainQContext("Custom", "We have benches", empty).overrides.benches,
  ).toBe("available");
  expect(
    retainQContext("Custom", "We have benches", {
      ...empty,
      overrides: { benches: "unknown" },
    }).overrides.benches,
  ).toBe("unknown");
});

it("keeps offline provenance visible when reopening the printable plan", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Use offline template" }));
  fireEvent.click(screen.getByRole("button", { name: "Preview & print" }));
  expect(
    screen.getByText(
      "Template-generated personal draft · not AI-generated or a reviewed regional original",
    ),
  ).toBeVisible();
});
