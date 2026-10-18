// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import App from "../src/App";
import { catalog } from "../src/catalog";
import { readState, STORAGE_KEY } from "../src/model";
import { ExiconBrowser } from "../src/ExiconBrowser";
import { MovementPicker } from "../src/MovementPicker";

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
const library = () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Library" }));
};
it("copies a source directly into a saved personal editor without changing its original", () => {
  const before = JSON.stringify(catalog);
  library();
  fireEvent.click(
    screen.getByRole("button", {
      name: `Use this workout: ${catalog[0].title}`,
    }),
  );
  expect(screen.getByLabelText("Workout title")).toHaveValue(
    `${catalog[0].title} · my copy`,
  );
  expect(screen.getByText("Saved on this device")).toBeVisible();
  expect(readState().workouts).toHaveLength(1);
  expect(readState().workouts[0].originId).toBe(catalog[0].id);
  expect(JSON.stringify(catalog)).toBe(before);
});
it("does not enter an editor or discard corrupt storage when direct copying is blocked", () => {
  localStorage.setItem(STORAGE_KEY, "{corrupt");
  library();
  fireEvent.click(
    screen.getByRole("button", {
      name: `Use this workout: ${catalog[0].title}`,
    }),
  );
  expect(screen.queryByLabelText("Workout title")).toBeNull();
  expect(localStorage.getItem(STORAGE_KEY)).toBe("{corrupt");
});
it("combines quick filters and resets favorites as well as the hidden filters", () => {
  library();
  fireEvent.click(screen.getByRole("button", { name: "No running" }));
  fireEvent.click(screen.getByRole("button", { name: "No gear" }));
  expect(screen.getByLabelText("Running")).toHaveValue("None");
  expect(screen.getByLabelText("Equipment")).toHaveValue("None");
  fireEvent.click(screen.getByLabelText("Favorites only"));
  expect(
    screen.queryAllByRole("button", { name: "View workout" }),
  ).toHaveLength(0);
  fireEvent.click(screen.getAllByRole("button", { name: "Reset filters" })[0]);
  expect(screen.getByLabelText("Favorites only")).not.toBeChecked();
  expect(screen.getAllByRole("button", { name: "View workout" })).toHaveLength(
    catalog.length,
  );
});
it("sorts titles and treats known short durations ahead of unknown durations", () => {
  library();
  fireEvent.change(screen.getByLabelText("Sort workouts"), {
    target: { value: "title" },
  });
  const region = screen.getByRole("region", {
    name: "Regional workout library",
  });
  expect(
    within(region)
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent),
  ).toEqual(catalog.map((w) => w.title).sort((a, b) => a.localeCompare(b)));
  fireEvent.change(screen.getByLabelText("Sort workouts"), {
    target: { value: "duration" },
  });
  expect(
    within(region).getAllByRole("heading", { level: 3 })[0],
  ).toHaveTextContent(
    [...catalog].sort(
      (a, b) =>
        (a.duration ?? Infinity) - (b.duration ?? Infinity) ||
        a.title.localeCompare(b.title),
    )[0].title,
  );
});
it("filters the same movement guide used by generation and reveals counting on demand", () => {
  render(<ExiconBrowser />);
  fireEvent.change(screen.getByLabelText("Search reference"), {
    target: { value: "ww3" },
  });
  expect(screen.getByText("WW3")).toBeVisible();
  fireEvent.click(screen.getByText("WW3"));
  expect(screen.getByText(/One complete sit-up-and-press/)).toBeVisible();
  fireEvent.change(screen.getByLabelText("Movement requirements"), {
    target: { value: "Bodyweight, no fixed support" },
  });
  expect(screen.getByText(/No movements match/)).toBeVisible();
});
it("adds a catalog movement without inventing counts or changing gear settings", () => {
  library();
  fireEvent.click(
    screen.getAllByRole("button", { name: "Create a workout" })[0],
  );
  const picker = screen
    .getAllByText("Add from movement guide")[0]
    .closest("details")!;
  fireEvent.click(within(picker).getByText("Add from movement guide"));
  fireEvent.change(within(picker).getByLabelText("Find a movement"), {
    target: { value: "ww3" },
  });
  expect(within(picker).getByText("Coupon")).toBeVisible();
  fireEvent.click(within(picker).getByRole("button", { name: "Add WW3" }));
  expect(screen.getByLabelText("Exercise name")).toHaveValue("WW3");
  expect(screen.getByLabelText("Count / amount")).toHaveValue(
    "Set reps or time",
  );
  expect(screen.getByLabelText("Counting")).toHaveValue("not applicable");
  expect(screen.getByLabelText("Equipment (comma separated)")).toHaveValue("");
  expect(
    (screen.getByLabelText("Plain instructions") as HTMLInputElement).value,
  ).toContain("sit-up");
  expect(screen.getByText("Unsaved changes")).toBeVisible();
});
it("retains favorites and sorting when returning from workout details", () => {
  library();
  fireEvent.click(
    screen.getByRole("button", { name: `Favorite ${catalog[0].title}` }),
  );
  fireEvent.click(screen.getByLabelText("Favorites only"));
  fireEvent.change(screen.getByLabelText("Sort workouts"), {
    target: { value: "title" },
  });
  fireEvent.click(screen.getByRole("button", { name: catalog[0].title }));
  fireEvent.click(screen.getByRole("button", { name: "Back to workouts" }));
  expect(screen.getByLabelText("Favorites only")).toBeChecked();
  expect(screen.getByLabelText("Sort workouts")).toHaveValue("title");
  expect(screen.getAllByRole("button", { name: "View workout" })).toHaveLength(
    1,
  );
});
it("does not add beyond the block limit", () => {
  const onAdd = vi.fn();
  render(<MovementPicker onAdd={onAdd} disabled />);
  fireEvent.click(screen.getByText("Add from movement guide"));
  fireEvent.change(screen.getByLabelText("Find a movement"), {
    target: { value: "ww3" },
  });
  expect(screen.getByRole("button", { name: "Add WW3" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Add WW3" }));
  expect(onAdd).not.toHaveBeenCalled();
});
