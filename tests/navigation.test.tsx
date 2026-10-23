// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import App from "../src/App";
import { readRoute, routeHash } from "../src/navigation";
import { newWorkout, writeState } from "../src/model";
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("restores a saved workout link on reload and keeps route parsing bounded", () => {
  const w = newWorkout();
  w.title = "Linked personal Q";
  writeState({ workouts: [w], favorites: [] });
  history.replaceState({}, "", `/#workout/${w.id}`);
  render(<App />);
  expect(
    screen.getByRole("heading", { name: "Linked personal Q" }),
  ).toBeVisible();
  expect(readRoute("#workout/%3Cscript%3E")).toEqual({ tab: "builder" });
  expect(routeHash({ tab: "arbitrary" })).toBe("#build");
});
it("retains dirty editor work when a browser-history navigation is declined", () => {
  const w = newWorkout();
  w.title = "Original";
  writeState({ workouts: [w], favorites: [] });
  history.replaceState({}, "", `/#edit/${w.id}`);
  render(<App />);
  fireEvent.change(screen.getByLabelText("Workout title"), {
    target: { value: "Keep this edit" },
  });
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  fireEvent.click(screen.getByRole("link", { name: "Skip to workouts" }));
  expect(location.hash).toBe(`#edit/${w.id}`);
  expect(screen.getByRole("main")).toHaveFocus();
  expect(confirm).not.toHaveBeenCalled();
  history.replaceState({}, "", "/#library");
  fireEvent(window, new PopStateEvent("popstate"));
  expect(screen.getByLabelText("Workout title")).toHaveValue("Keep this edit");
  expect(location.hash).toBe(`#edit/${w.id}`);
});
