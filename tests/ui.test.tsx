// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import App from "../src/App";
import { catalog } from "../src/catalog";
import { copyWorkout, STORAGE_KEY } from "../src/model";
beforeEach(() => {
  localStorage.clear();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("library UI", () => {
  it("combines filters and resets the empty state", () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Equipment"), {
      target: { value: "Coupon" },
    });
    expect(
      screen.getByRole("button", { name: "Bring your block" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Circle up, get after it" }),
    ).toBeNull();
    fireEvent.change(screen.getByLabelText("Search workouts"), {
      target: { value: "xxxxx" },
    });
    expect(screen.getByText("No workouts match those filters.")).toBeVisible();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Reset filters" })[0],
    );
    expect(
      screen.getAllByRole("button", { name: "View workout" }),
    ).toHaveLength(10);
  });
  it("persists favorites across reload", () => {
    const first = render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: "Favorite Circle up, get after it" }),
    );
    first.unmount();
    render(<App />);
    expect(
      screen.getByRole("button", {
        name: "Unfavorite Circle up, get after it",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /Favorites/ }));
    expect(
      screen.getAllByRole("button", { name: "View workout" }),
    ).toHaveLength(1);
  });
  it("copies, edits and saves without changing the library source", () => {
    const before = JSON.stringify(catalog[0]);
    const app = render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: "Circle up, get after it" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Copy to my workouts" }),
    );
    fireEvent.change(screen.getByLabelText("Workout title"), {
      target: { value: "My changed workout" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Save workout" })[0]);
    expect(screen.getByRole("status")).toHaveTextContent("Workout saved");
    expect(JSON.stringify(catalog[0])).toBe(before);
    app.unmount();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /My workouts/ }));
    expect(
      screen.getByRole("button", { name: "My changed workout" }),
    ).toBeVisible();
  });
  it("keeps pasted notes exactly and accepts unknown timing", () => {
    render(<App />);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Create a workout" })[0],
    );
    const raw = "  A plan\n\n20 merkins,  10 each side.  ";
    fireEvent.change(screen.getByLabelText(/Original pasted notes/), {
      target: { value: raw },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Save workout" })[0]);
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY)!).workouts[0].rawNotes,
    ).toBe(raw);
    expect(screen.getByRole("status")).toHaveTextContent("Workout saved");
  });
  it("opens Q view, optional Mary and print-only choice", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "One list, one crew" }));
    expect(screen.getByText("Mary omitted in this plan.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Q view" }));
    expect(screen.getByRole("main")).toHaveClass("q-mode");
    fireEvent.click(screen.getByLabelText("Print only The Thang"));
    expect(screen.getByRole("main")).toHaveClass("thang-only");
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: "Print" }));
    expect(print).toHaveBeenCalledOnce();
  });
  it("reports save failures while keeping the open edits", () => {
    render(<App />);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Create a workout" })[0],
    );
    fireEvent.change(screen.getByLabelText("Workout title"), {
      target: { value: "Please keep this" },
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw Error("quota");
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Save workout" })[0]);
    expect(screen.getByRole("status")).toHaveTextContent("Could not save");
    expect(screen.getByLabelText("Workout title")).toHaveValue(
      "Please keep this",
    );
  });
  it("imports conflicts only after confirmation and keeps both drafts", async () => {
    const w = copyWorkout(catalog[0]);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        format: "fe-workout-backup",
        version: 1,
        exportedAt: new Date().toISOString(),
        workouts: [w],
        favorites: [],
      }),
    );
    render(<App />);
    const file = new File([""], "backup.json", { type: "application/json" });
    Object.defineProperty(file, "text", {
      value: async () =>
        JSON.stringify({
          format: "fe-workout-backup",
          version: 1,
          exportedAt: new Date().toISOString(),
          workouts: [w],
          favorites: [],
        }),
    });
    fireEvent.change(screen.getByLabelText("Import backup"), {
      target: { files: [file] },
    });
    expect(await screen.findByRole("dialog")).toBeVisible();
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY)!).workouts,
    ).toHaveLength(1);
    fireEvent.click(
      screen.getByRole("button", { name: "Import as copies where needed" }),
    );
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY)!).workouts,
    ).toHaveLength(2);
  });
  it("rejects malformed import without modifying data", async () => {
    render(<App />);
    const file = new File([""], "bad.json");
    Object.defineProperty(file, "text", { value: async () => "{bad" });
    fireEvent.change(screen.getByLabelText("Import backup"), {
      target: { files: [file] },
    });
    expect(await screen.findByText(/Import rejected/)).toBeVisible();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
