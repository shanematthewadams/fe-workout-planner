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
import App from "../src/App";
import { Planner } from "../src/Planner";
import { SESSION_KEY } from "../src/planner-session";
import { fallbackPlan } from "../src/fallback";
import { resolveRequest } from "../src/planner-contract";
import { qSheet } from "../src/session";
import { Weinke, makeWeinke } from "../src/Weinke";
import { STORAGE_KEY, type Workout } from "../src/model";
const fields = {
  title: "Motherfeeks",
  warmup: "SSH x10 IC",
  thang: "11s: heavy squats and merkins.\nHammers 2=1. Down and back x4.",
  mary: "",
  cot: "What do you sacrifice for community?",
};
const click = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("keeps literal words, order and unknown timing without inventing exercises or optional sections", () => {
  const w = makeWeinke(fields);
  expect(w.sections.map((s) => s.kind)).toEqual(["warmup", "thang"]);
  expect(w.sections[1].blocks[0]).toMatchObject({
    instructions: fields.thang,
    exercises: [],
    minutes: null,
  });
  expect(w.duration).toBeNull();
  expect(w.adaptationNotes).toBe(fields.cot);
  expect(qSheet(w).split(fields.cot)).toHaveLength(2);
  expect(w.provenance.issues?.join(" ")).toContain("not inferred");
  expect(() => makeWeinke({ ...fields, thang: "  " })).toThrow(/Add The Thang/);
  const changed = makeWeinke({ ...fields, thang: "Merkins x17 OMD" }, w);
  expect(changed.id).toBe(w.id);
  expect(changed.sections[0].id).toBe(w.sections[0].id);
});
it("recovers account-scoped text and leaves it intact when saving fails", () => {
  const save = vi.fn(() => false as const);
  const lead = vi.fn();
  const props = {
    storageKey: "synthetic-user:weinke",
    onBack: vi.fn(),
    onSave: save,
    onLead: lead,
  };
  const view = render(<Weinke {...props} />);
  fireEvent.change(screen.getByLabelText("The Thang"), {
    target: { value: fields.thang },
  });
  view.unmount();
  render(<Weinke {...props} />);
  expect(screen.getByLabelText("The Thang")).toHaveValue(fields.thang);
  click("Preview my Weinke");
  expect(save).not.toHaveBeenCalled();
  click("Save & open Weinke");
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Couldn’t save on this device",
  );
  expect(lead).not.toHaveBeenCalled();
  click("Keep editing");
  expect(screen.getByLabelText("The Thang")).toHaveValue(fields.thang);
});
it("creates, saves, reopens and leads a literal sheet with no AI calls and no timer", async () => {
  const fetcher = vi.spyOn(globalThis, "fetch");
  const view = render(<App />);
  click("Make a Weinke");
  fireEvent.change(screen.getByLabelText("Workout name (optional)"), {
    target: { value: fields.title },
  });
  fireEvent.change(screen.getByLabelText("The Thang"), {
    target: { value: fields.thang },
  });
  fireEvent.change(screen.getByLabelText("COT / reminders (optional)"), {
    target: { value: fields.cot },
  });
  click("Preview my Weinke");
  click("Save & open Weinke");
  await waitFor(() =>
    expect(screen.getByRole("heading", { name: fields.title })).toBeVisible(),
  );
  expect(screen.getByLabelText("Workout to lead")).toHaveTextContent(
    "Hammers 2=1",
  );
  expect(screen.getByRole("button", { name: "No timer" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const workouts: Workout[] = JSON.parse(
    localStorage.getItem(STORAGE_KEY)!,
  ).workouts;
  expect(workouts).toHaveLength(1);
  expect(workouts[0].sections[0].blocks[0].instructions).toBe(fields.thang);
  expect(fetcher).not.toHaveBeenCalled();
  view.unmount();
  render(<App />);
  expect(screen.getByLabelText("Workout to lead")).toHaveTextContent(
    "Hammers 2=1",
  );
  click("← Back to plan");
  expect(screen.getByText("Equipment unknown", { exact: true })).toBeVisible();
  expect(screen.getByText("Running unknown", { exact: true })).toBeVisible();
});
it("updates the saved identity and starts a separate sheet without deleting the first", () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  const stored: Workout[] = [];
  const save = vi.fn((w: Workout) => {
    const existing = stored.findIndex((item) => item.id === w.id);
    if (existing < 0) stored.push(w);
    else stored[existing] = w;
    return w;
  });
  const lead = vi.fn();
  render(
    <Weinke
      storageKey="synthetic:weinke"
      onBack={vi.fn()}
      onSave={save}
      onLead={lead}
    />,
  );
  fireEvent.change(screen.getByLabelText("The Thang"), {
    target: { value: fields.thang },
  });
  click("Preview my Weinke");
  click("Save & open Weinke");
  const first = stored[0];
  click("Keep editing");
  fireEvent.change(screen.getByLabelText("The Thang"), {
    target: { value: "Merkins x17 OMD" },
  });
  click("Preview my Weinke");
  click("Save & open Weinke");
  expect(stored).toHaveLength(1);
  expect(stored[0].id).toBe(first.id);
  expect(save.mock.calls[1][0].sections[0].blocks[0].instructions).toBe(
    "Merkins x17 OMD",
  );
  click("Start a new Weinke");
  expect(screen.getByLabelText("The Thang")).toHaveValue("");
  expect(stored).toHaveLength(1);
  fireEvent.change(screen.getByLabelText("The Thang"), {
    target: { value: "Partner carries" },
  });
  click("Preview my Weinke");
  click("Save & open Weinke");
  expect(stored).toHaveLength(2);
  expect(stored[1].id).not.toBe(first.id);
});

it("restores the chosen Weinke form while retaining a previous generated draft", () => {
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      result: fallbackPlan(resolveRequest({ prompt: "test" })),
    }),
  );
  sessionStorage.setItem(
    SESSION_KEY + ":flow",
    JSON.stringify({ step: "weinke" }),
  );
  sessionStorage.setItem(SESSION_KEY + ":weinke", JSON.stringify({ fields }));
  render(
    <Planner
      onSave={(w) => w}
      onEdit={vi.fn()}
      onPreview={vi.fn()}
      onReference={vi.fn()}
    />,
  );
  expect(screen.getByLabelText("The Thang")).toHaveValue(fields.thang);
  expect(
    JSON.parse(sessionStorage.getItem(SESSION_KEY)!).result,
  ).not.toBeNull();
});
