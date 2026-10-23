// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import App from "../src/App";
import { Planner } from "../src/Planner";
import { SESSION_KEY } from "../src/planner-session";
import { STORAGE_KEY, type Workout } from "../src/model";
import { fallbackPlan } from "../src/fallback";
import { resolveRequest } from "../src/planner-contract";
const click = (name: string | RegExp) =>
  fireEvent.click(screen.getByRole("button", { name }));
const props = {
  onSave: (w: Workout) => w,
  onEdit: vi.fn(),
  onPreview: vi.fn(),
  onReference: vi.fn(),
};
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
it("starts at the three choices after review and refresh while preserving the saved workout and using a new identity", () => {
  const first = render(<App />);
  click("I have an idea");
  click("Use offline template");
  const original = JSON.parse(localStorage.getItem(STORAGE_KEY)!).workouts[0];
  click("Start a new workout");
  expect(screen.getByRole("button", { name: "Make a Weinke" })).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Return to current draft" }),
  ).toBeNull();
  first.unmount();
  render(<App />);
  expect(screen.getByRole("button", { name: "I have an idea" })).toBeVisible();
  click("Make a Weinke");
  expect(screen.getByLabelText("The Thang")).toHaveValue("");
  fireEvent.change(screen.getByLabelText("The Thang"), {
    target: { value: "Merkins x17 OMD" },
  });
  click("Preview my Weinke");
  click("Save & open Weinke");
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!).workouts;
  expect(saved).toHaveLength(2);
  expect(saved.find((w: Workout) => w.id === original.id)).toEqual(original);
  expect(saved[1].id).not.toBe(original.id);
});
it("cancels safely, then clears unsaved Weinke notes and all setup sidecars without affecting other accounts", () => {
  sessionStorage.setItem(SESSION_KEY + ":other-account", "keep");
  render(<Planner {...props} />);
  click("Make a Weinke");
  fireEvent.change(screen.getByLabelText("The Thang"), {
    target: { value: "Keep these notes if I cancel" },
  });
  vi.mocked(window.confirm).mockReturnValueOnce(false);
  click("Start a new workout");
  expect(screen.getByLabelText("The Thang")).toHaveValue(
    "Keep these notes if I cancel",
  );
  click("Start a new workout");
  expect(sessionStorage.getItem(SESSION_KEY + ":weinke")).toBeNull();
  expect(sessionStorage.getItem(SESSION_KEY + ":other-account")).toBe("keep");
  click("I have an idea");
  expect(screen.getByLabelText("Describe your Q")).toHaveValue("");
  click("Start a new workout");
  click("Make a Weinke");
  expect(screen.getByLabelText("The Thang")).toHaveValue("");
});
it("aborts pending generation and ignores a late response after starting fresh", async () => {
  let resolve!: (value: Response) => void;
  const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const save = vi.fn((w: Workout) => w);
  render(<Planner {...props} onSave={save} />);
  click("I have an idea");
  fireEvent.change(screen.getByLabelText("Describe your Q"), {
    target: { value: "A challenging partner workout" },
  });
  click("Build my workout");
  const signal = fetcher.mock.calls[0][1]?.signal;
  click("Start a new workout");
  expect(signal?.aborted).toBe(true);
  await act(async () =>
    resolve(
      new Response(
        JSON.stringify(fallbackPlan(resolveRequest({ prompt: "test" }))),
      ),
    ),
  );
  expect(
    screen.getByRole("button", { name: "Help me find one" }),
  ).toBeVisible();
  expect(screen.queryByLabelText("Generated workout draft")).toBeNull();
  expect(save).not.toHaveBeenCalled();
});
it("keeps the open setup and restores recovery copies if clearing storage fails partway", () => {
  render(<Planner {...props} />);
  click("I have an idea");
  fireEvent.change(screen.getByLabelText("Describe your Q"), {
    target: { value: "Important unsaved setup" },
  });
  const before = sessionStorage.getItem(SESSION_KEY);
  const original = Storage.prototype.removeItem;
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (
    this: Storage,
    key,
  ) {
    if (this === sessionStorage && key.endsWith(":flow"))
      throw Error("Synthetic blocked storage");
    original.call(this, key);
  });
  click("Start a new workout");
  expect(screen.getByRole("alert")).toHaveTextContent("Couldn’t start fresh");
  expect(screen.getByLabelText("Describe your Q")).toHaveValue(
    "Important unsaved setup",
  );
  expect(sessionStorage.getItem(SESSION_KEY)).toBe(before);
});
