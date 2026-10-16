// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  render as renderUI,
  screen,
  fireEvent,
  cleanup,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
import { catalog } from "../src/catalog";
import { copyWorkout, STORAGE_KEY, writeState, readState } from "../src/model";
function render(element: React.ReactElement) {
  const view = renderUI(element);
  fireEvent.click(screen.getByRole("button", { name: "Library" }));
  return view;
}
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
    ).toHaveLength(catalog.length);
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
  it("blocks stale saves even before a storage event and recovers open edits as a copy", () => {
    const original = copyWorkout(catalog[0]);
    writeState({ workouts: [original], favorites: [] });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /My workouts/ }));
    fireEvent.click(screen.getByRole("button", { name: original.title }));
    fireEvent.click(screen.getByRole("button", { name: "Edit workout" }));
    fireEvent.change(screen.getByLabelText("Workout title"), {
      target: { value: "My unsaved edits" },
    });
    const elsewhere = { ...original, title: "Saved in the other tab" };
    writeState({ workouts: [elsewhere], favorites: [catalog[1].id] });
    const latestRaw = localStorage.getItem(STORAGE_KEY);
    fireEvent.click(screen.getAllByRole("button", { name: "Save workout" })[0]);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(latestRaw);
    expect(screen.getByLabelText("Workout title")).toHaveValue(
      "My unsaved edits",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Load latest saved workouts" }),
    );
    expect(screen.getByLabelText("Workout title")).toHaveValue(
      "My unsaved edits · recovered copy",
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Save workout" })[0]);
    const saved = readState();
    expect(saved.workouts).toHaveLength(2);
    expect(saved.workouts.find((w) => w.id === original.id)?.title).toBe(
      elsewhere.title,
    );
    expect(saved.workouts.find((w) => w.id !== original.id)?.title).toBe(
      "My unsaved edits · recovered copy",
    );
    expect(saved.favorites).toEqual([catalog[1].id]);
  });
  it("detects another tab clearing storage and never restores stale favorites", () => {
    writeState({ workouts: [], favorites: [catalog[0].id] });
    render(<App />);
    localStorage.clear();
    fireEvent(
      window,
      new StorageEvent("storage", { key: null, storageArea: localStorage }),
    );
    expect(screen.getByLabelText("Saved workouts changed")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Load latest saved workouts" }),
    );
    expect(
      screen.getByRole("button", { name: "Favorite Circle up, get after it" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
  it("keeps current work when the latest data is unreadable", () => {
    render(<App />);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Create a workout" })[0],
    );
    fireEvent.change(screen.getByLabelText("Workout title"), {
      target: { value: "Keep me" },
    });
    localStorage.setItem(STORAGE_KEY, "{bad");
    fireEvent(
      window,
      new StorageEvent("storage", {
        key: STORAGE_KEY,
        storageArea: localStorage,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Load latest saved workouts" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Nothing was replaced",
    );
    expect(screen.getByLabelText("Workout title")).toHaveValue("Keep me");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("{bad");
  });
  it("saves and opens a workout directly for leading and printing", () => {
    render(<App />);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Create a workout" })[0],
    );
    expect(screen.getByText("Unsaved changes")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Workout title"), {
      target: { value: "Ready to Q" },
    });
    fireEvent.change(screen.getByLabelText(/Original pasted notes/), {
      target: { value: "  Keep these notes exactly.  " },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save & view workout" }),
    );
    expect(screen.getByRole("heading", { name: "Ready to Q" })).toBeVisible();
    expect(readState().workouts[0].rawNotes).toBe(
      "  Keep these notes exactly.  ",
    );
    fireEvent.click(screen.getByRole("button", { name: "Q view" }));
    expect(screen.getByRole("main")).toHaveClass("q-mode");
    fireEvent.click(screen.getByRole("button", { name: "Edit workout" }));
    expect(screen.getByLabelText("Workout title")).toHaveValue("Ready to Q");
    expect(screen.getByText("Saved on this device")).toBeVisible();
  });
  it("keeps the editor open when save and view cannot save", () => {
    render(<App />);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Create a workout" })[0],
    );
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw Error("quota");
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save & view workout" }),
    );
    expect(screen.getByLabelText("Workout title")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Could not save");
    expect(screen.queryByRole("button", { name: "Q view" })).toBeNull();
  });
  it("preserves typed equipment spaces and makes custom equipment filterable", async () => {
    const user = userEvent.setup();
    render(<App />);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Create a workout" })[0],
    );
    await user.type(
      screen.getByLabelText("Equipment (comma separated)"),
      "Sand bag, Pull-up bar",
    );
    expect(screen.getByLabelText("Equipment (comma separated)")).toHaveValue(
      "Sand bag, Pull-up bar",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Save & view workout" }),
    );
    expect(readState().workouts[0].equipment).toEqual([
      "Sand bag",
      "Pull-up bar",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Back to workouts" }));
    fireEvent.change(screen.getByLabelText("Equipment"), {
      target: { value: "Sand bag" },
    });
    expect(
      screen.getAllByRole("button", { name: "View workout" }),
    ).toHaveLength(1);
  });
  it("explains unknown and over-budget timing without fabricating estimates", () => {
    render(<App />);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Create a workout" })[0],
    );
    expect(screen.getByLabelText("Plan timing")).toHaveTextContent(
      "2 untimed blocks",
    );
    fireEvent.change(
      screen.getByLabelText("Session estimate (minutes, optional)"),
      { target: { value: "45" } },
    );
    const times = screen.getAllByLabelText(
      "Estimated minutes · blank = unknown",
    );
    fireEvent.change(times[0], { target: { value: "5" } });
    fireEvent.change(times[1], { target: { value: "45" } });
    expect(screen.getByLabelText("Plan timing")).toHaveTextContent(
      "5 minutes beyond",
    );
    fireEvent.change(times[1], { target: { value: "35" } });
    expect(screen.getByLabelText("Plan timing")).toHaveTextContent(
      "5 minutes remain",
    );
    fireEvent.change(times[1], { target: { value: "40" } });
    expect(screen.getByLabelText("Plan timing")).toHaveTextContent(
      "match your session",
    );
  });
  it("warns before leaving an unsaved new plan and respects cancellation", () => {
    render(<App />);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Create a workout" })[0],
    );
    vi.mocked(window.confirm).mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: "My workouts" }));
    expect(screen.getByLabelText("Workout title")).toBeVisible();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
  it("downloads exact oversized pasted notes without requiring a valid backup", async () => {
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    const blobs: Blob[] = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return "blob:notes";
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    try {
      render(<App />);
      fireEvent.click(
        screen.getAllByRole("button", { name: "Create a workout" })[0],
      );
      const raw = "  Original\n\n" + "🧱".repeat(11000) + "  ";
      fireEvent.change(screen.getByLabelText(/Original pasted notes/), {
        target: { value: raw },
      });
      fireEvent.click(
        screen.getByRole("button", { name: "Download original notes" }),
      );
      const downloaded = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(blobs[0]);
      });
      expect(downloaded).toBe(raw);
      expect(screen.getByLabelText(/Original pasted notes/)).toHaveValue(raw);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(screen.getByRole("status")).toHaveTextContent(
        "exactly as entered",
      );
      await new Promise((resolve) => setTimeout(resolve, 1100));
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  });
  it("adds and omits Mary on a personal draft across save and reopen", () => {
    render(<App />);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Create a workout" })[0],
    );
    fireEvent.click(screen.getByRole("button", { name: "Add Mary" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Save & view workout" }),
    );
    expect(screen.getByRole("heading", { name: "Mary" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Edit workout" }));
    const mary = screen
      .getByRole("heading", { name: "Mary" })
      .closest("section")!;
    fireEvent.click(
      within(mary).getByRole("button", { name: "Remove section" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Save & view workout" }),
    );
    expect(screen.getByText("Mary omitted in this plan.")).toBeVisible();
    expect(
      readState().workouts[0].sections.map((section) => section.kind),
    ).toEqual(["warmup", "thang"]);
  });
  it("preserves corrupt stored data until saving is explicitly unlocked", () => {
    localStorage.setItem(STORAGE_KEY, "{corrupt");
    render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: "Circle up, get after it" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Copy to my workouts" }),
    );
    expect(localStorage.getItem(STORAGE_KEY)).toBe("{corrupt");
    fireEvent.click(screen.getByRole("button", { name: "Unlock saving" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Copy to my workouts" }),
    );
    expect(readState().workouts).toHaveLength(1);
  });
});
