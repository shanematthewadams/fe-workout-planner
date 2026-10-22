// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import App from "../src/App";
import { Planner } from "../src/Planner";
import { conceptsFor, VIBES } from "../src/workout-concepts";
import { SESSION_KEY } from "../src/planner-session";
import { type Workout, STORAGE_KEY } from "../src/model";
import { resolveRequest } from "../src/planner-contract";
import { fallbackPlan } from "../src/fallback";
const props = {
  onSave: (w: Workout) => w,
  onEdit: vi.fn(),
  onPreview: vi.fn(),
  onReference: vi.fn(),
};
const click = (name: string | RegExp) =>
  fireEvent.click(screen.getByRole("button", { name }));
const saved = () =>
  JSON.parse(localStorage.getItem(STORAGE_KEY)!).workouts as Workout[];
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("offers two clear entries and three terrain-independent concepts per vibe without AI", () => {
  const fetcher = vi.spyOn(globalThis, "fetch");
  render(<Planner {...props} />);
  expect(screen.getByRole("button", { name: "I have an idea" })).toBeVisible();
  expect(screen.queryByLabelText("Describe your Q")).toBeNull();
  click("Help me find one");
  click(/Work together/);
  fireEvent.change(screen.getByLabelText("Q location"), {
    target: { value: "Unknown downrange AO" },
  });
  click(/Show me some ideas/);
  expect(
    screen.getByRole("button", { name: /The Buddy System/ }),
  ).toBeVisible();
  expect(document.querySelectorAll(".choice-grid button")).toHaveLength(3);
  for (const vibe of VIBES) expect(conceptsFor(vibe.id)).toHaveLength(3);
  expect(fetcher).not.toHaveBeenCalled();
  click(/The Buddy System/);
  expect(screen.getByRole("heading", { name: "Anything else?" })).toBeVisible();
  expect(
    screen.getByRole("heading", { name: "The Buddy System" }),
  ).toBeVisible();
  expect(screen.getByLabelText("Describe your Q")).not.toBeVisible();
  expect(screen.getByLabelText("Q location")).toHaveValue(
    "Unknown downrange AO",
  );
  expect(screen.getByRole("group", { name: "Using coupons?" })).toBeVisible();
  expect(
    screen.getByRole("group", { name: "How much running?" }),
  ).toBeVisible();
});
it("recovers the selected vibe, location and concept step on refresh", () => {
  const first = render(<Planner {...props} />);
  click("Help me find one");
  click(/Bring the heavy stuff/);
  fireEvent.change(screen.getByLabelText("Q location"), {
    target: { value: "Gold Rush" },
  });
  click(/Show me some ideas/);
  first.unmount();
  render(<Planner {...props} />);
  expect(screen.getByRole("button", { name: /Slow Burn/ })).toBeVisible();
  click(/Slow Burn/);
  expect(screen.getByLabelText("Q location")).toHaveValue("Gold Rush");
});
it("sends explicit session coupon/running choices and the optional note in one provider call", async () => {
  const response = fallbackPlan(resolveRequest({ prompt: "test" }));
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(JSON.stringify(response)));
  render(<Planner {...props} />);
  click("Help me find one");
  click(/Bring the heavy stuff/);
  click(/Show me some ideas/);
  click(/Slow Burn/);
  click("Yes");
  click("None");
  fireEvent.change(
    screen.getByLabelText("Anything we should know? (Optional)"),
    { target: { value: "A gold-mining theme. Partners." } },
  );
  click("Build my workout");
  await screen.findByLabelText("Generated workout draft");
  expect(fetcher).toHaveBeenCalledTimes(1);
  const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
  expect(body).toMatchObject({ equipment: "Coupon", running: "None" });
  expect(body.prompt).toContain("A gold-mining theme. Partners.");
  expect(body.site.amenities?.couponsOnSite).not.toBe(true);
});
it("autosaves inline changes under one ID, preserves unrelated exercises, and reopens after refresh", () => {
  const first = render(<App />);
  click("I have an idea");
  click("Use offline template");
  const original = structuredClone(saved()[0]);
  const firstExercise = original.sections[0].blocks[0].exercises[0];
  expect(
    screen.getByRole("heading", { name: "Circle of Trust" }),
  ).toBeVisible();
  expect(
    screen.getByRole("heading", { name: original.sections[0].title }),
  ).toBeVisible();
  click(`Edit ${firstExercise.name}`);
  const fields = within(
    screen.getByRole("group", { name: "Edit this exercise" }),
  );
  fireEvent.change(fields.getByLabelText("Reps or duration"), {
    target: { value: "17" },
  });
  fireEvent.change(fields.getByLabelText("Exercise"), {
    target: { value: "My modified movement" },
  });
  const updated = saved();
  expect(updated).toHaveLength(1);
  expect(updated[0].id).toBe(original.id);
  expect(updated[0].sections[0].blocks[0].exercises[0].amount).toBe("17");
  expect(updated[0].sections[1]).toEqual(original.sections[1]);
  expect(updated[0].sections[0].blocks[0].exercises.slice(1)).toEqual(
    original.sections[0].blocks[0].exercises.slice(1),
  );
  expect(
    JSON.parse(sessionStorage.getItem(SESSION_KEY)!).result.plan.sections[0]
      .blocks[0].exercises[0].name,
  ).toBe("My modified movement");
  first.unmount();
  render(<App />);
  expect(saved()).toHaveLength(1);
  expect(
    screen.getByRole("button", { name: "Edit My modified movement" }),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Lead this workout" }),
  ).toBeEnabled();
});
it("reports a storage failure honestly, keeps the draft, and retries without duplicate saves", () => {
  const write = Storage.prototype.setItem;
  const denied = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(function (this: Storage, key, value) {
      if (key === STORAGE_KEY) throw Error("Storage full");
      return write.call(this, key, value);
    });
  render(<App />);
  click("I have an idea");
  click("Use offline template");
  expect(screen.getByText(/Could not save on this device/)).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Lead this workout" }),
  ).toBeDisabled();
  expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  denied.mockRestore();
  click("Retry saving");
  expect(saved()).toHaveLength(1);
  expect(
    screen.getByRole("button", { name: "Lead this workout" }),
  ).toBeEnabled();
});
it("does not overwrite workouts changed in another tab", () => {
  render(<App />);
  click("I have an idea");
  click("Use offline template");
  const concurrent = saved()[0];
  concurrent.title = "Newer work in another tab";
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ schemaVersion: 1, workouts: [concurrent], favorites: [] }),
  );
  fireEvent.change(screen.getByLabelText("Workout name"), {
    target: { value: "My open edits" },
  });
  expect(saved()[0].title).toBe("Newer work in another tab");
  expect(screen.getByLabelText("Workout name")).toHaveValue("My open edits");
  expect(screen.getByText(/Could not save on this device/)).toBeVisible();
});
it("preserves the saved ID and current manual edits when asking AI for a targeted change", async () => {
  render(<App />);
  click("I have an idea");
  click("Use offline template");
  const id = saved()[0].id;
  fireEvent.change(screen.getByLabelText("Workout name"), {
    target: { value: "My own title" },
  });
  const result = JSON.parse(sessionStorage.getItem(SESSION_KEY)!).result;
  result.provider = "Gemini";
  result.workout.id = "provider-new-id";
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(JSON.stringify(result)));
  fireEvent.click(
    screen.getByText("Help me change this", { selector: "summary" }),
  );
  fireEvent.change(screen.getByLabelText("What would you change?"), {
    target: { value: "Less running, keep everything else." },
  });
  click("Refine this draft");
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Lead this workout" }),
    ).toBeEnabled(),
  );
  expect(saved()).toHaveLength(1);
  expect(saved()[0].id).toBe(id);
  expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body)).current.title).toBe(
    "My own title",
  );
});

it("lets a Q leave a stalled provider for an immediate offline draft and ignores its late response", async () => {
  let finish!: (response: Response) => void;
  const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<Planner {...props} />);
  click("I have an idea");
  fireEvent.change(screen.getByLabelText("Describe your Q"), {
    target: { value: "Partner circuit with no running" },
  });
  click("Build my workout");
  const signal = fetcher.mock.calls[0][1]?.signal;
  expect(
    screen.getByRole("button", { name: "Use offline template" }),
  ).toBeEnabled();
  click("Use offline template");
  expect(signal?.aborted).toBe(true);
  const original = screen.getByRole("heading", { level: 1 }).textContent;
  const response = fallbackPlan(
    resolveRequest({ prompt: "Different workout" }),
  );
  response.workout.title = "Stale provider draft";
  finish(new Response(JSON.stringify(response)));
  await waitFor(() =>
    expect(
      screen.queryByRole("heading", { name: "Stale provider draft" }),
    ).toBeNull(),
  );
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    original!,
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
});
