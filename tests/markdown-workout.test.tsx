// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { parseMarkdownWorkout, MARKDOWN_PROMPT } from "../src/markdown-workout";
import { MarkdownImport } from "../src/MarkdownImport";
import App from "../src/App";
import { readState, matches, filtersEmpty, parseBackup } from "../src/model";
import { workoutPhases } from "../src/session";

const markdown = `# Synthetic partner ladder
Summary: A test workout, not a regional original.
Duration: 45
Equipment: Coupon
Running: None
Format: Partner
AO: Unknown
Q: Fixture Q

## Warmup
### Get moving
Minutes: 8
- SSH | 10 | cadence | Four-count cadence.

## The Thang
### Ladder
Minutes: 29
Partners alternate. Stop at the cap; count each side as written.
- Lunges | 10 | 1=1 | Stay controlled.
- Hammers | 20 | 2=1 | Two movements count as one.
Rest for 30 seconds after the set.

## Mary
### Core
Minutes: 6
- Plank | 60 seconds | time | Modify as needed.

## Notes
COT follows the hard stop.`;
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
it("keeps order, counts, counting and post-exercise directions; maps explicit timing without fabricating AO facts", () => {
  const w = parseMarkdownWorkout(markdown);
  expect(w.kind).toBe("personal");
  expect(w.provenance.status).toBe("personal");
  expect(w.provenance.ao).toBeUndefined();
  expect(w.provenance.q).toBe("Fixture Q");
  expect(w.schedule).toBeUndefined();
  const es = w.sections[1].blocks[0].exercises;
  expect(es.map((e) => [e.name, e.amount, e.counting])).toEqual([
    ["Lunges", "10", "1=1"],
    ["Hammers", "20", "2=1"],
  ]);
  expect(es[1].instructions).toContain("Rest for 30 seconds");
  expect(w.rawNotes).toBe(markdown);
  expect(workoutPhases(w)?.find((p) => p.sectionKind === "thang")?.end).toBe(
    2340,
  );
  expect(w.adaptationNotes).toContain("COT follows");
});
it("preserves plain Markdown directions, unknown facts and backup compatibility", () => {
  const w = parseMarkdownWorkout(
    "# Plain workout\n## The Thang\nDo 10 merkins, then 20 squats.\n\nRepeat until time.",
  );
  expect(w.sections[0].blocks[0].instructions).toBe(
    "Do 10 merkins, then 20 squats.\n\nRepeat until time.",
  );
  expect(w.sections[0].blocks[0].exercises).toEqual([]);
  expect(w.duration).toBeNull();
  expect(workoutPhases(w)).toBeNull();
  expect(matches(w, { ...filtersEmpty, equipment: "None" })).toBe(false);
  expect(matches(w, { ...filtersEmpty, running: "None" })).toBe(false);
  expect(
    parseBackup(
      JSON.stringify({
        format: "fe-workout-backup",
        version: 1,
        exportedAt: new Date().toISOString(),
        workouts: [w],
        favorites: [],
      }),
    ).workouts[0],
  ).toEqual(w);
});
it("accepts a Markdown code wrapper and normalizes CRLF without altering the stored original", () => {
  const raw = "```markdown\r\n" + markdown.replaceAll("\n", "\r\n") + "\r\n```";
  const a = parseMarkdownWorkout(raw),
    b = parseMarkdownWorkout(raw);
  expect(a.title).toBe("Synthetic partner ladder");
  expect(a.rawNotes).toBe(raw);
  expect(a.id).not.toBe(b.id);
  expect(a.sections[0].id).not.toBe(b.sections[0].id);
});
it.each([
  ["No title\n## The Thang\nWork", "title"],
  ["# Title\n## Warmup\nWork", "The Thang"],
  ["# Title\n## The Thang\n", "empty block"],
  ["# Title\n## The Thang\nWork\n## The Thang\nMore", "only one"],
  ["# Title\n## The Thang\nWork\n## Round two\nMore", "###"],
  ["# Title\nRunning: Lots\n## The Thang\nWork", "Running"],
  ["# Title\nDuration: tomorrow\n## The Thang\nWork", "Duration"],
  ["# Title\n## The Thang\nMinutes: -2\nWork", "Minutes"],
  ["# Title\n## The Thang\n- Merkins | 10 | mystery |", "counting"],
  [
    "# Title\n## The Thang\n- Merkins | 10 | total | note | extra",
    "extra pipes",
  ],
  ["# Title\n## The Thang\nWork\n# Other workout", "one workout"],
  ["x".repeat(20_001), "20,000"],
] as const)(
  "rejects ambiguous or malformed input with a specific next step: %s",
  (raw, message) => {
    expect(() => parseMarkdownWorkout(raw)).toThrow(message);
  },
);
it("flags inconsistent timing instead of inventing a schedule", () => {
  const w = parseMarkdownWorkout(
    markdown.replace("Duration: 45", "Duration: 60"),
  );
  expect(w.provenance.issues?.join(" ")).toContain("Block times total 43");
  expect(workoutPhases(w)).toBeNull();
});
it("reviews locally, invalidates edited previews, and saves only through the existing editor", () => {
  render(<App />);
  expect(screen.getByRole("link", { name: "F3 Q BUILDER" })).toBeVisible();
  expect(within(screen.getByRole("banner")).queryByText(/OLATHE/)).toBeNull();
  fireEvent.click(
    within(screen.getByRole("main")).getByRole("button", {
      name: "Import a workout",
    }),
  );
  expect(
    screen.queryByRole("heading", { name: "Find your next workout" }),
  ).toBeNull();
  fireEvent.change(screen.getByLabelText("Workout Markdown"), {
    target: { value: markdown },
  });
  fireEvent.click(screen.getByRole("button", { name: "Review import" }));
  expect(
    screen.getByRole("heading", { name: "Review: Synthetic partner ladder" }),
  ).toHaveFocus();
  expect(readState().workouts).toEqual([]);
  fireEvent.change(screen.getByLabelText("Workout Markdown"), {
    target: { value: markdown + "\nExtra note" },
  });
  expect(screen.queryByRole("button", { name: "Open in editor" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Review import" }));
  fireEvent.click(screen.getByRole("button", { name: "Open in editor" }));
  expect(readState().workouts).toEqual([]);
  expect(screen.getByLabelText("Workout title")).toHaveValue(
    "Synthetic partner ladder",
  );
  fireEvent.click(screen.getAllByRole("button", { name: "Save workout" })[0]);
  expect(readState().workouts).toHaveLength(1);
  expect(
    readState().workouts[0].sections[1].blocks[0].exercises[1].counting,
  ).toBe("2=1");
});
it("does not let a stale file replace newer pasted text", async () => {
  let resolve!: (s: string) => void;
  const text = new Promise<string>((r) => {
    resolve = r;
  });
  render(<MarkdownImport onEdit={vi.fn()} />);
  const file = new File(["placeholder"], "workout.md", {
    type: "text/markdown",
  });
  Object.defineProperty(file, "text", { value: () => text });
  fireEvent.change(screen.getByLabelText("Choose Markdown file"), {
    target: { files: [file] },
  });
  fireEvent.change(screen.getByLabelText("Workout Markdown"), {
    target: { value: "# Newer text" },
  });
  resolve(markdown);
  await waitFor(() =>
    expect(screen.getByLabelText("Workout Markdown")).toHaveValue(
      "# Newer text",
    ),
  );
});
it("imports a file, keeps it across navigation, copies the prompt, and renders HTML as text", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  const onEdit = vi.fn();
  const ui = render(<MarkdownImport onEdit={onEdit} />);
  const raw = "# Markup\n## The Thang\n<script>alert('no')</script>";
  const file = new File([raw], "workout.md");
  Object.defineProperty(file, "text", { value: async () => raw });
  fireEvent.change(screen.getByLabelText("Choose Markdown file"), {
    target: { files: [file] },
  });
  await waitFor(() =>
    expect(screen.getByLabelText("Workout Markdown")).toHaveValue(raw),
  );
  ui.unmount();
  render(<MarkdownImport onEdit={onEdit} />);
  expect(screen.getByLabelText("Workout Markdown")).toHaveValue(raw);
  fireEvent.click(screen.getByRole("button", { name: "Copy chat prompt" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(MARKDOWN_PROMPT));
  fireEvent.click(screen.getByRole("button", { name: "Review import" }));
  expect(screen.getByText("<script>alert('no')</script>")).toBeVisible();
  expect(document.querySelector("script")).toBeNull();
  expect(onEdit).not.toHaveBeenCalled();
});
