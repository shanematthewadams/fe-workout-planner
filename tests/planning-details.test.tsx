// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import {
  planningDetailsSchema,
  planningContext,
  groupDescription,
  refinePlanning,
} from "../src/planning-details";
import { plannerRequestSchema, resolveRequest } from "../src/planner-contract";
import { fallbackPlan } from "../src/fallback";
import { Planner } from "../src/Planner";
import App from "../src/App";
import { contextFor } from "../server/planner-context";
import { validatePlan } from "../server/planner-service";
import { SESSION_KEY, restorePlannerSession } from "../src/planner-session";
const props = {
  onSave: () => true,
  onEdit: () => {},
  onPreview: () => {},
  onReference: () => {},
};
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("removes the header credit and Gold Rush promotion", () => {
  render(<App />);
  expect(screen.getByRole("banner")).not.toHaveTextContent("Rug Burn");
  expect(
    screen.queryByRole("button", { name: "Try the Gold Rush idea" }),
  ).toBeNull();
  expect(screen.getByLabelText("Describe your Q")).not.toHaveAttribute(
    "placeholder",
    expect.stringContaining("Gold Rush"),
  );
});
it("collects and recovers all workout details in idea mode", () => {
  const first = render(<Planner {...props} />);
  fireEvent.click(
    screen.getByText("Workout details", { exact: false, selector: "summary" }),
  );
  fireEvent.change(screen.getByLabelText("PAX count"), {
    target: { value: "11" },
  });
  fireEvent.change(screen.getByLabelText("Fitness focus"), {
    target: { value: "Upper body" },
  });
  fireEvent.change(screen.getByLabelText("How much running"), {
    target: { value: "None" },
  });
  fireEvent.change(screen.getByLabelText("Work together"), {
    target: { value: "Partners" },
  });
  fireEvent.change(screen.getByLabelText("Workout date"), {
    target: { value: "2026-12-21" },
  });
  fireEvent.change(screen.getByLabelText("Expected light"), {
    target: { value: "Dark" },
  });
  fireEvent.click(screen.getByLabelText("Rain"));
  fireEvent.click(screen.getByLabelText("Wind"));
  first.unmount();
  render(<Planner {...props} />);
  expect(screen.getByLabelText("PAX count")).toHaveValue(11);
  expect(screen.getByLabelText("Fitness focus")).toHaveValue("Upper body");
  expect(screen.getByLabelText("How much running")).toHaveValue("None");
  expect(screen.getByLabelText("Expected light")).toHaveValue("Dark");
  expect(screen.getByLabelText("Workout date")).toHaveValue("2026-12-21");
  expect(screen.getByLabelText("Rain")).toBeChecked();
  expect(screen.getByLabelText("Wind")).toBeChecked();
  expect(screen.getByLabelText("Work together")).toHaveValue("Partners");
});
it("sends selected conditions, focus, count, and grouping through generation and refinement", async () => {
  const response = fallbackPlan(
    resolveRequest({ prompt: "bodyweight circuit" }),
  );
  response.provider = "Gemini";
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => new Response(JSON.stringify(response)));
  render(<Planner {...props} />);
  fireEvent.change(screen.getByLabelText("Describe your Q"), {
    target: { value: "Bodyweight partners" },
  });
  fireEvent.change(screen.getByLabelText("PAX count"), {
    target: { value: "11" },
  });
  fireEvent.change(screen.getByLabelText("Fitness focus"), {
    target: { value: "Lower body" },
  });
  fireEvent.change(screen.getByLabelText("Work together"), {
    target: { value: "Partners" },
  });
  fireEvent.change(screen.getByLabelText("Expected light"), {
    target: { value: "Dark" },
  });
  fireEvent.click(screen.getByLabelText("Snow / ice"));
  fireEvent.click(screen.getByRole("button", { name: "Build my workout" }));
  await screen.findByLabelText("Generated workout draft");
  const request = JSON.parse(fetcher.mock.calls[0][1]!.body as string);
  expect(request.planning).toMatchObject({
    pax: 11,
    focus: "Lower body",
    grouping: "Partners",
    light: "Dark",
    weather: ["Snow / ice"],
  });
  fireEvent.change(screen.getByLabelText("What would you change?"), {
    target: { value: "Make this individual. 15 guys. Focus on core." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Refine this draft" }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  const revision = JSON.parse(fetcher.mock.calls[1][1]!.body as string);
  expect(revision.planning).toMatchObject({
    pax: 15,
    focus: "Core",
    grouping: "Individual",
    light: "Dark",
    weather: ["Snow / ice"],
  });
});
it("keeps PAX and body focus shared when switching builder modes", () => {
  render(<Planner {...props} />);
  fireEvent.change(screen.getByLabelText("PAX count"), {
    target: { value: "17" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Formal Builder" }));
  expect(screen.getAllByLabelText("PAX count")).toHaveLength(1);
  expect(screen.getByLabelText("PAX count")).toHaveValue(17);
  expect(screen.getAllByLabelText("Fitness focus")).toHaveLength(1);
});
it.each(["2026-02-30", "2026-13-01", "tomorrow"])(
  "rejects an invalid date %s",
  (date) => {
    expect(planningDetailsSchema.safeParse({ date }).success).toBe(false);
  },
);
it("treats dates and conditions as expectations, never measured daylight or a forecast", () => {
  const request = resolveRequest({
    prompt: "Plan a Q",
    planning: {
      date: "2026-12-21",
      pax: 11,
      grouping: "Partners",
      weather: ["Rain", "Wind"],
      light: "Dark",
      focus: "Core",
    },
  });
  const context = contextFor(request).planning;
  expect(context.groupingInstructions).toContain(
    "4 pairs and one group of three",
  );
  expect(context.conditionsSource).toContain("not a live forecast");
  expect(context.conditionsInstructions.join(" ")).toContain("no racing");
  expect(context.conditionsInstructions.join(" ")).toContain("ground-contact");
  expect(
    planningContext(planningDetailsSchema.parse({ date: "2026-12-21" })).light,
  ).toBe("Not sure");
});
it("balances small groups without leaving a participant alone", () => {
  expect(groupDescription(5, "Groups of 4")).toContain("3, 2");
  expect(groupDescription(11, "Groups of 3")).toContain("3, 3, 3, 2");
  expect(groupDescription(1, "Partners")).toContain("individual work only");
  expect(groupDescription(undefined, "Partners")).toContain("unknown");
});
it("adapts the offline core template to rain and preserves valid timing", () => {
  const request = resolveRequest({
    prompt: "Core circuit",
    running: "None",
    equipment: "None",
    strictSchedule: true,
    planning: {
      weather: ["Rain"],
      light: "Dark",
      focus: "Core",
      pax: 1,
      grouping: "Individual",
    },
  });
  const response = fallbackPlan(request);
  expect(() => validatePlan(response.plan, request)).not.toThrow();
  const text = response.plan.sections
    .flatMap((s) => s.blocks.flatMap((b) => b.exercises.map((e) => e.name)))
    .join(" ");
  expect(text).not.toMatch(/merkins|dead bugs|LBC|hops/i);
  expect(response.plan.sections[1].blocks[0].instructions).toContain(
    "3 stations",
  );
  expect(response.plan.sections[1].blocks[0].instructions).toContain(
    "15 minutes",
  );
});
it("rejects partner-dependent metadata for a one-person request", () => {
  const request = resolveRequest({
    prompt: "One-person Q",
    planning: { pax: 1 },
  });
  const response = fallbackPlan(request);
  response.plan.format = "Partner";
  expect(() => validatePlan(response.plan, request)).toThrow("individual-work");
});
it("accepts legacy requests and keeps unmentioned refinement details", () => {
  expect(
    plannerRequestSchema.parse({ prompt: "Plain old Q" }).planning,
  ).toBeUndefined();
  const before = planningDetailsSchema.parse({
    pax: 11,
    weather: ["Cold"],
    light: "Dark",
  });
  expect(refinePlanning(before, "Simplify the instructions")).toEqual(before);
});
it("updates explicit weather and light revisions while retaining other conditions", () => {
  const before = planningDetailsSchema.parse({
    weather: ["Rain", "Wind"],
    light: "Dark",
    pax: 11,
  });
  expect(
    refinePlanning(before, "No rain now. We will be in daylight."),
  ).toMatchObject({ weather: ["Wind"], light: "Daylight", pax: 11 });
  expect(
    refinePlanning(
      planningDetailsSchema.parse({}),
      "It is raining, before sunrise.",
    ),
  ).toMatchObject({ weather: ["Rain"], light: "Dark" });
});
it("detects an actual partner dependency even when metadata says circuit", () => {
  const request = resolveRequest({
    prompt: "One-person Q",
    planning: { pax: 1 },
  });
  const plan = fallbackPlan(request).plan;
  plan.format = "Circuit";
  plan.sections[1].blocks[0].instructions =
    "Partner A works while Partner B rests, then swap.";
  expect(() => validatePlan(plan, request)).toThrow("individual-work");
});
it("takes a stated turnout from the idea when the count is left blank", () => {
  expect(
    resolveRequest({ prompt: "A workout for 17 guys", planning: {} }).planning
      ?.pax,
  ).toBe(17);
  expect(
    resolveRequest({ prompt: "Maybe 17 guys", planning: { pax: 20 } }).planning
      ?.pax,
  ).toBe(20);
});
it("keeps an unknown turnout blank after restoring formal mode", () => {
  const first = render(<Planner {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Formal Builder" }));
  fireEvent.change(screen.getByLabelText("PAX count"), {
    target: { value: "17" },
  });
  fireEvent.change(screen.getByLabelText("PAX count"), {
    target: { value: "" },
  });
  first.unmount();
  render(<Planner {...props} />);
  expect(screen.getByLabelText("PAX count")).toHaveValue(null);
});
it("does not discard valid older preferences when new planning details are invalid", () => {
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      prompt: "Keep my idea",
      preferences: {
        ao: "Gold Rush",
        running: "None",
        startTime: "06:00",
        planning: { pax: 0 },
      },
    }),
  );
  expect(restorePlannerSession().preferences).toMatchObject({
    ao: "Gold Rush",
    running: "None",
    startTime: "06:00",
  });
});
