// @vitest-environment jsdom
import { startPlanning, openCreativeHelp } from "./planning-helpers";
import type { Workout } from "../src/model";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Planner } from "../src/Planner";
import { FieldTimer } from "../src/FieldTimer";
import { fallbackPlan } from "../src/fallback";
import { resolveRequest } from "../src/planner-contract";
import { validatePlan } from "../server/planner-service";
import { siteContext } from "../src/ao-context";
import { workoutPhases } from "../src/session";
import { cloudRequest, CloudSnapshotError } from "../src/cloud";
const props = {
  onSave: (workout: Workout) => workout,
  onEdit: () => {},
  onPreview: () => {},
  onReference: () => {},
};
const input = () =>
  resolveRequest({
    prompt: "Bodyweight only. No running.",
    equipment: "None",
    running: "None",
    strictSchedule: true,
  });
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
it.each([
  ["Sprint", "Sprint 100 meters between rounds.", "running"],
  ["Coupon curls", "Lift a cinder block for 20 reps.", "gear"],
  ["Ruck carry", "Carry your loaded ruck.", "gear"],
])("rejects misleading metadata for %s", (name, instructions, reason) => {
  const request = input(),
    plan = fallbackPlan(request).plan;
  plan.sections[1].blocks[0].exercises[0] = {
    ...plan.sections[1].blocks[0].exercises[0],
    name,
    instructions,
  };
  expect(() => validatePlan(plan, request)).toThrow(reason);
});
it("accepts bodyweight instructions that explicitly exclude running and gear", () => {
  const request = input(),
    plan = fallbackPlan(request).plan;
  plan.sections[1].blocks[0].instructions =
    "No running. Without equipment. Use a running clock and rotate in place.";
  expect(() => validatePlan(plan, request)).not.toThrow();
});
it("recognizes deliberate running changes without treating less running as permission", () => {
  expect(
    resolveRequest({ prompt: "Add light running", running: "From prompt" })
      .running,
  ).toBe("Light");
  expect(
    resolveRequest({
      prompt: "Include moderate running",
      running: "From prompt",
    }).running,
  ).toBe("Moderate");
  expect(
    resolveRequest({
      prompt: "Less running, keep everything else",
      running: "From prompt",
    }).running,
  ).toBe("From prompt");
});
it.each([true, false])(
  "keeps closures regardless of conflicting statement order (%s)",
  (reverse) => {
    const prompt = reverse ? "Stairs are open." : "Stairs are closed.";
    const notes = reverse ? "Stairs are closed." : "Stairs are open.";
    expect(
      siteContext("", prompt, { notes, overrides: { stairs: "available" } })
        .features.stairs,
    ).toBe("unavailable");
  },
);
it("recovers all formal setup fields and an unfinished revision", () => {
  render(<Planner {...props} />);
  startPlanning();
  fireEvent.click(screen.getByRole("button", { name: "Formal Builder" }));
  fireEvent.change(screen.getByLabelText("Plan title"), {
    target: { value: "Keep this Q" },
  });
  fireEvent.change(screen.getByLabelText("Q name"), {
    target: { value: "Rug Burn" },
  });
  fireEvent.change(screen.getByLabelText("PAX count"), {
    target: { value: "17" },
  });
  fireEvent.click(screen.getByLabelText("Coupon"));
  cleanup();
  render(<Planner {...props} />);
  startPlanning();
  expect(screen.getByLabelText("Plan title")).toHaveValue("Keep this Q");
  expect(screen.getByLabelText("Q name")).toHaveValue("Rug Burn");
  expect(screen.getByLabelText("PAX count")).toHaveValue(17);
  expect(screen.getByLabelText("Coupon")).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Use offline template" }));
  openCreativeHelp();
  fireEvent.change(screen.getByLabelText("What would you change?"), {
    target: { value: "More partner work" },
  });
  cleanup();
  render(<Planner {...props} />);
  startPlanning();
  expect(screen.getByLabelText("What would you change?")).toHaveValue(
    "More partner work",
  );
  expect(screen.queryByRole("button", { name: "Build my workout" })).toBeNull();
});
it("retains inferred restrictions through consecutive refinements", async () => {
  const response = fallbackPlan(input());
  response.provider = "OpenRouter";
  const f = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => new Response(JSON.stringify(response)));
  render(<Planner {...props} />);
  startPlanning();
  fireEvent.change(screen.getByLabelText("Describe your Q"), {
    target: { value: "Bodyweight only. No running." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Build my workout" }));
  await screen.findByLabelText("Generated workout draft");
  for (const revision of [
    "Make this partner based. Stairs are closed.",
    "Simplify the directions",
  ]) {
    openCreativeHelp();
    fireEvent.change(screen.getByLabelText("What would you change?"), {
      target: { value: revision },
    });
    fireEvent.click(screen.getByRole("button", { name: "Refine this draft" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Refine this draft" }),
      ).not.toHaveTextContent("Working"),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("What would you change?")).toHaveValue(""),
    );
  }
  expect(f).toHaveBeenCalledTimes(3);
  for (const call of f.mock.calls.slice(1)) {
    const request = JSON.parse(String(call[1]?.body));
    expect(request.running).toBe("None");
    expect(request.equipment).toBe("None");
  }
  expect(
    JSON.parse(String(f.mock.calls[2][1]?.body)).site.overrides.stairs,
  ).toBe("unavailable");
});
it("retains an existing draft when a new request returns a server fallback", async () => {
  const response = fallbackPlan(input());
  response.provider = "OpenRouter";
  response.workout.title = "Keep the good draft";
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify(response)))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...fallbackPlan(input()),
          fallbackReason: "PRIVATE provider diagnostic",
        }),
      ),
    );
  render(<Planner {...props} />);
  startPlanning();
  fireEvent.change(screen.getByLabelText("Describe your Q"), {
    target: { value: "Bodyweight grinder" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Build my workout" }));
  await screen.findByRole("heading", { name: "Keep the good draft" });
  fireEvent.click(screen.getByRole("button", { name: "← Back to setup" }));
  fireEvent.click(screen.getByRole("button", { name: "Make a new draft" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "current draft is unchanged",
  );
  expect(screen.getByRole("alert")).not.toHaveTextContent("PRIVATE");
  fireEvent.click(
    screen.getByRole("button", { name: "Return to current draft" }),
  );
  expect(
    screen.getByRole("heading", { name: "Keep the good draft" }),
  ).toBeVisible();
});
it("recovers exercise position, resets it deliberately, and starts fresh the next day", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 17, 5, 41));
  vi.spyOn(window, "confirm").mockReturnValue(true);
  const w = fallbackPlan(input()).workout;
  render(<FieldTimer workout={w} onExit={() => {}} />);
  startPlanning();
  if (!screen.queryByRole("button", { name: "Session timer" }))
    fireEvent.click(screen.getByText("Timer options", { exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Session timer" }));
  fireEvent.click(screen.getByText("Schedule & session settings"));
  fireEvent.click(
    screen.getByRole("button", { name: "Join live 5:30 AM schedule" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Next exercise" }));
  cleanup();
  render(<FieldTimer workout={w} onExit={() => {}} />);
  startPlanning();
  if (!screen.queryByRole("button", { name: "Session timer" }))
    fireEvent.click(screen.getByText("Timer options", { exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Session timer" }));
  fireEvent.click(screen.getByText("Schedule & session settings"));
  expect(screen.getByText("2 of 4")).toBeVisible();
  expect(screen.getByRole("timer")).toHaveTextContent("34:00");
  fireEvent.click(screen.getByRole("button", { name: "Reset" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Join live 5:30 AM schedule" }),
  );
  expect(screen.getByText("1 of 4")).toBeVisible();
  cleanup();
  vi.setSystemTime(new Date(2026, 9, 18, 5, 20));
  render(<FieldTimer workout={w} onExit={() => {}} />);
  startPlanning();
  if (!screen.queryByRole("button", { name: "Session timer" }))
    fireEvent.click(screen.getByText("Timer options", { exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Session timer" }));
  fireEvent.click(screen.getByText("Schedule & session settings"));
  expect(screen.getByRole("timer")).toHaveTextContent("45:00");
});
it("uses saved block timing and requires consent to use a generic schedule for unknown timing", () => {
  const w = fallbackPlan(
    resolveRequest({ prompt: "Bodyweight workout", minutes: 30 }),
  ).workout;
  const phases = workoutPhases(w)!;
  expect(phases.at(-1)!.start).toBe(1800);
  expect(phases[0].end).toBe(300);
  render(<FieldTimer workout={w} onExit={() => {}} />);
  startPlanning();
  if (!screen.queryByRole("button", { name: "Session timer" }))
    fireEvent.click(screen.getByText("Timer options", { exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Session timer" }));
  fireEvent.click(screen.getByText("Schedule & session settings"));
  expect(screen.getByRole("timer")).toHaveTextContent("30:00");
  cleanup();
  w.sections[0].blocks[0].minutes = null;
  render(<FieldTimer workout={w} onExit={() => {}} />);
  startPlanning();
  if (!screen.queryByRole("button", { name: "Session timer" }))
    fireEvent.click(screen.getByText("Timer options", { exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Session timer" }));
  fireEvent.click(screen.getByText("Schedule & session settings"));
  expect(screen.getByRole("button", { name: "Start timer" })).toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", { name: "Use standard 45-minute timer" }),
  );
  expect(screen.getByRole("button", { name: "Start timer" })).toBeEnabled();
});
it("keeps Mary doses consistent with timed template directions", () => {
  const mary = fallbackPlan(input()).plan.sections[2].blocks[0];
  expect(
    mary.exercises.every(
      (e) => e.amount === "30" && e.unit === "seconds" && e.counting === "time",
    ),
  ).toBe(true);
});
it("offers recovery rather than accepting a malformed cloud snapshot", async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-test");
  const raw = { version: 1, workouts: [{ id: "invalid" }] };
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(raw)),
  );
  try {
    await cloudRequest("a".repeat(64), "get");
    throw Error("Expected validation failure");
  } catch (e) {
    expect(e).toBeInstanceOf(CloudSnapshotError);
    expect((e as CloudSnapshotError).snapshot).toEqual(raw);
  }
});
