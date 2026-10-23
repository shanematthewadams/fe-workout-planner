// @vitest-environment jsdom
import { useState, createRef } from "react";
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
import { PlannerDraft } from "../src/PlannerDraft";
import { Planner } from "../src/Planner";
import { Weinke, makeWeinke } from "../src/Weinke";
import { fallbackPlan } from "../src/fallback";
import { resolveRequest, type PlannerResponse } from "../src/planner-contract";
import { FieldTimer } from "../src/FieldTimer";
import { newExercise, readState, writeState } from "../src/model";
import { attributeWorkout } from "../src/attribution";
import App from "../src/App";
const click = (name: string | RegExp) =>
  fireEvent.click(screen.getByRole("button", { name }));
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
it("undoes swaps and removals without changing identity or other sections", () => {
  const original = fallbackPlan(
    resolveRequest({ prompt: "Synthetic workout" }),
  );
  let latest = original;
  function Harness() {
    const [result, setResult] = useState(original);
    return (
      <PlannerDraft
        result={result}
        resultRef={createRef()}
        busy={false}
        saved={true}
        saveError={false}
        onChange={(next) => {
          latest = next;
          setResult(next);
        }}
        revision=""
        setRevision={vi.fn()}
        ask={vi.fn()}
        onSave={() => true}
        onEdit={vi.fn()}
        onPreview={vi.fn()}
        onReference={vi.fn()}
        onSetup={vi.fn()}
      />
    );
  }
  render(<Harness />);
  const exercise = original.workout.sections[0].blocks[0].exercises[0];
  click(`Edit ${exercise.name}`);
  const editor = screen.getByRole("group", { name: "Edit this exercise" });
  fireEvent.click(within(editor).getByText("Swap from movement guide"));
  fireEvent.change(within(editor).getByLabelText("Find a movement"), {
    target: { value: "merkin" },
  });
  fireEvent.click(within(editor).getByRole("button", { name: "Swap Merkin" }));
  expect(latest.workout.sections[0].blocks[0].exercises[0]).toMatchObject({
    id: exercise.id,
    name: "Merkin",
    amount: exercise.amount,
    counting: exercise.counting,
  });
  expect(latest.workout.sections[1]).toEqual(original.workout.sections[1]);
  click("Undo last edit");
  expect(latest.workout).toMatchObject({
    id: original.workout.id,
    sections: original.workout.sections,
  });
  click(`Edit ${exercise.name}`);
  click("Remove exercise");
  expect(latest.workout.sections[0].blocks[0].exercises).toHaveLength(
    original.workout.sections[0].blocks[0].exercises.length - 1,
  );
  click("Undo last edit");
  expect(latest.workout.sections).toEqual(original.workout.sections);
});
it("puts timer choices behind a disclosure and keeps counting explicit", () => {
  const workout = fallbackPlan(resolveRequest({ prompt: "Synthetic" })).workout;
  render(
    <FieldTimer
      workout={workout}
      onExit={vi.fn()}
      notice={<p role="status">Offline catalog</p>}
    />,
  );
  expect(
    screen.getByText("Timer options", { exact: true }).closest("details"),
  ).not.toHaveAttribute("open");
  expect(screen.getByLabelText("Workout to lead")).toHaveTextContent(
    workout.sections[1].blocks[0].exercises[0].counting,
  );
  fireEvent.click(screen.getByText("Timer options", { exact: true }));
  expect(screen.getByRole("button", { name: "Session timer" })).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent("Offline catalog");
});
it("recovers optional blocks, rounds and exercise order without losing literal notes", () => {
  const save = vi.fn((w) => w);
  const props = {
    storageKey: "synthetic:blocks",
    onSave: save,
    onBack: vi.fn(),
  };
  const first = render(<Weinke {...props} />);
  fireEvent.change(screen.getByLabelText("The Thang"), {
    target: { value: "Keep this note exactly." },
  });
  fireEvent.click(screen.getByText(/Organize The Thang/));
  click("Add block");
  fireEvent.change(screen.getByLabelText("Rounds (optional)"), {
    target: { value: "3, together" },
  });
  click("Add exercise");
  fireEvent.change(screen.getByLabelText("Exercise name"), {
    target: { value: "Hammers" },
  });
  fireEvent.change(screen.getByLabelText("Counting"), {
    target: { value: "2=1" },
  });
  first.unmount();
  render(<Weinke {...props} />);
  fireEvent.click(screen.getByText(/Organize The Thang/));
  expect(screen.getByLabelText("Rounds (optional)")).toHaveValue("3, together");
  click("Add exercise");
  const names = screen.getAllByLabelText("Exercise name");
  fireEvent.change(names[1], { target: { value: "Merkins" } });
  fireEvent.click(
    screen.getAllByRole("button", { name: "Move exercise up" })[1],
  );
  click("Preview my Weinke");
  click("Save & open Weinke");
  const w = save.mock.calls[0][0];
  expect(w.sections[0].blocks[0].instructions).toBe("Keep this note exactly.");
  expect(w.sections[0].blocks[1].instructions).toBe("Rounds: 3, together");
  expect(
    w.sections[0].blocks[1].exercises.map((e: { name: string }) => e.name),
  ).toEqual(["Merkins", "Hammers"]);
  expect(w.sections[0].blocks[1].exercises[1].counting).toBe("2=1");
  expect(w.duration).toBeNull();
});
it("accepts structured-only Weinkes and keeps workout backup version 1", () => {
  const w = makeWeinke({
    title: "",
    thang: "",
    warmup: "",
    mary: "",
    cot: "",
    blocks: [
      {
        id: "block",
        title: "Partners",
        rounds: "4",
        minutes: null,
        instructions: "Swap each round",
        exercises: [newExercise()],
      },
    ],
  });
  expect(w.schemaVersion).toBe(1);
  expect(w.sections[0].blocks).toHaveLength(1);
  expect(w.sections[0].blocks[0].minutes).toBeNull();
});
it("provides direct personal Lead/Edit/Duplicate while preserving the saved original", () => {
  const w = makeWeinke({
    title: "Synthetic saved sheet",
    thang: "Merkins x17",
    warmup: "",
    mary: "",
    cot: "",
  });
  writeState({ workouts: [attributeWorkout(w)], favorites: [] });
  render(<App />);
  fireEvent.click(screen.getByRole("link", { name: "My Workouts" }));
  const card = screen
    .getByRole("heading", { name: w.title })
    .closest("article")!;
  expect(card).toHaveTextContent("AO not set · Edited");
  const original = readState().workouts.find((item) => item.id === w.id);
  fireEvent.click(within(card).getByRole("button", { name: "Duplicate" }));
  expect(readState().workouts).toHaveLength(2);
  expect(readState().workouts.find((item) => item.id === w.id)).toEqual(
    original,
  );
  expect(screen.getByLabelText("Workout title")).toHaveValue(
    `${w.title} · my copy`,
  );
});
it("keeps an edited fallback when an explicit AI retry fails, retaining the original idea", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("{}", { status: 503 }),
  );
  let latest: PlannerResponse["workout"] | undefined;
  render(
    <Planner
      onSave={(w) => w}
      onDraft={(w) => {
        latest = w;
      }}
      onEdit={vi.fn()}
      onPreview={vi.fn()}
      onReference={vi.fn()}
    />,
  );
  click("I have an idea");
  fireEvent.change(screen.getByLabelText("Describe your Q"), {
    target: { value: "Gold mining partners with no running" },
  });
  click("Build my workout");
  await screen.findByLabelText("Generation recovery");
  fireEvent.click(screen.getByText("Your original idea"));
  expect(screen.getByLabelText("Generation recovery")).toHaveTextContent(
    "Gold mining partners with no running",
  );
  fireEvent.change(screen.getByLabelText("Workout name"), {
    target: { value: "Keep my edits" },
  });
  const id = latest!.id;
  click("Try AI again");
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Your previous draft is safe",
    ),
  );
  expect(latest).toMatchObject({ id, title: "Keep my edits" });
  expect(screen.getByLabelText("Generation recovery")).toHaveTextContent(
    "Gold mining partners with no running",
  );
});
it("does not overwrite an unreadable structured recovery record", () => {
  const record = JSON.stringify({
    fields: {
      title: "Recovered",
      thang: "Keep my literal notes",
      blocks: [{ id: "bad", exercises: "unreadable" }],
    },
  });
  sessionStorage.setItem("synthetic:damaged", record);
  const save = vi.fn();
  render(
    <Weinke storageKey="synthetic:damaged" onBack={vi.fn()} onSave={save} />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "original recovery record is untouched",
  );
  fireEvent.change(screen.getByLabelText("The Thang"), {
    target: { value: "Open edits" },
  });
  expect(sessionStorage.getItem("synthetic:damaged")).toBe(record);
  expect(
    screen.getByRole("button", { name: "Preview my Weinke" }),
  ).toBeDisabled();
  expect(save).not.toHaveBeenCalled();
});

it("keeps block identities distinct when adding plain notes to a structured-only saved Weinke", () => {
  const fields = {
    title: "Synthetic",
    thang: "",
    warmup: "",
    mary: "",
    cot: "",
    blocks: [
      {
        id: "structured",
        title: "Rounds",
        rounds: "3",
        minutes: null,
        instructions: "Partners",
        exercises: [newExercise()],
      },
    ],
  };
  const original = makeWeinke(fields);
  const edited = makeWeinke(
    { ...fields, thang: "Keep these opening notes" },
    original,
  );
  expect(edited.id).toBe(original.id);
  expect(edited.sections[0].blocks.map((b) => b.id)).toEqual([
    expect.any(String),
    "structured",
  ]);
  expect(new Set(edited.sections[0].blocks.map((b) => b.id)).size).toBe(2);
  expect(
    makeWeinke({ ...fields, thang: "Updated notes" }, edited).sections[0]
      .blocks[0].id,
  ).toBe(edited.sections[0].blocks[0].id);
});
