// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { FieldTimer } from "../src/FieldTimer";
import {
  intervalElapsed,
  intervalPhase,
  intervalSettingsSchema,
  intervalTotal,
  TABATA,
} from "../src/interval-timer";
import { newWorkout } from "../src/model";
import {
  playCadenceBeep,
  playCountdownPip,
  playSectionWhistle,
} from "../src/utils/sound";
vi.mock("../src/utils/sound", () => ({
  playCadenceBeep: vi.fn(),
  playCountdownPip: vi.fn(),
  playSectionWhistle: vi.fn(),
}));
const workout = () => {
  const w = newWorkout();
  w.title = "Test interval Q";
  w.sections = [w.sections[1]];
  w.sections[0].blocks[0].instructions =
    "Alternate stations. Take recovery as needed.";
  return w;
};
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 18, 5, 30));
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
function jump(seconds: number) {
  act(() => {
    vi.setSystemTime(Date.now() + seconds * 1000);
    vi.advanceTimersByTime(100);
  });
}
function launch(w = workout()) {
  render(<FieldTimer workout={w} onExit={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "Intervals" }));
  return w;
}
it("runs an exact eight-round 20/10 set with a separate get-ready period", () => {
  expect(intervalTotal(TABATA)).toBe(250);
  expect(intervalPhase(TABATA, 0)).toMatchObject({
    stage: "Get ready",
    round: 0,
    remaining: 10,
  });
  expect(intervalPhase(TABATA, 10)).toMatchObject({
    stage: "Work",
    round: 1,
    remaining: 20,
  });
  expect(intervalPhase(TABATA, 30)).toMatchObject({
    stage: "Rest",
    round: 1,
    remaining: 10,
  });
  expect(intervalPhase(TABATA, 40)).toMatchObject({
    stage: "Work",
    round: 2,
    remaining: 20,
  });
  expect(intervalPhase(TABATA, 220)).toMatchObject({
    stage: "Work",
    round: 8,
    remaining: 20,
  });
  expect(intervalPhase(TABATA, 240)).toMatchObject({
    stage: "Rest",
    round: 8,
    remaining: 10,
  });
  expect(intervalPhase(TABATA, 250)).toMatchObject({
    stage: "Complete",
    round: 8,
    remaining: 0,
  });
});
it("supports zero rest and zero preparation without empty phases", () => {
  const s = { ...TABATA, rest: 0, prepare: 0, rounds: 2 };
  expect(intervalPhase(s, 0)).toMatchObject({
    stage: "Work",
    round: 1,
    remaining: 20,
  });
  expect(intervalPhase(s, 20)).toMatchObject({
    stage: "Work",
    round: 2,
    remaining: 20,
  });
  expect(intervalPhase(s, 40).stage).toBe("Complete");
});
it.each([
  { work: 0 },
  { rest: -1 },
  { rounds: 0 },
  { rounds: 1.5 },
  { work: 301 },
  { prepare: 61 },
  { work: 300, rest: 300, rounds: 100 },
])("rejects invalid or excessive intervals %j", (bad) => {
  expect(intervalSettingsSchema.safeParse({ ...TABATA, ...bad }).success).toBe(
    false,
  );
});
it("catches up from real elapsed time and preserves a paused value", () => {
  expect(
    intervalElapsed({ settings: TABATA, elapsed: 12, anchor: 1000 }, 9000),
  ).toBe(20);
  expect(
    intervalElapsed({ settings: TABATA, elapsed: 12, anchor: null }, 9999999),
  ).toBe(12);
  expect(
    intervalElapsed({ settings: TABATA, elapsed: 12, anchor: 1000 }, 9999999),
  ).toBe(250);
});
it("opens a readable workout with no clock or cadence trainer", () => {
  render(<FieldTimer workout={workout()} onExit={() => {}} />);
  expect(screen.queryByRole("timer")).toBeNull();
  expect(
    screen.getByText("Alternate stations. Take recovery as needed."),
  ).toBeVisible();
  expect(screen.queryByText(/Four-count cadence/)).toBeNull();
  expect(playCadenceBeep).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Session timer" }));
  expect(screen.getByRole("button", { name: "Start timer" })).toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", {
      name: "Use standard 45-minute timer",
    }),
  );
  expect(screen.getByRole("button", { name: "Start timer" })).toBeEnabled();
});
it("keeps sounds opt-in, cues the final countdown and transitions, then stops at completion", () => {
  launch();
  fireEvent.change(screen.getByRole("combobox", { name: "Timer sound" }), {
    target: { value: "beeps" },
  });
  expect(playCadenceBeep).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Start intervals" }));
  expect(screen.getByRole("button", { name: "Session timer" })).toBeDisabled();
  expect(
    screen.getByRole("combobox", { name: "Interval style" }),
  ).toBeDisabled();
  jump(7);
  expect(playCountdownPip).toHaveBeenCalledWith();
  jump(3);
  expect(screen.getByRole("heading", { name: "Work" })).toBeVisible();
  expect(playCountdownPip).toHaveBeenCalledWith(true);
  jump(20);
  expect(screen.getByRole("heading", { name: "Rest" })).toBeVisible();
  expect(playCadenceBeep).toHaveBeenCalledWith(440, 0.25);
  jump(220);
  expect(screen.getByRole("heading", { name: "Complete" })).toBeVisible();
  expect(playSectionWhistle).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("timer")).toHaveTextContent("00:00");
  expect(
    screen.getByRole("button", { name: "Resume intervals" }),
  ).toBeDisabled();
  jump(100);
  expect(playSectionWhistle).toHaveBeenCalledTimes(1);
});
it("pauses without drift or sound and resumes from the same second", () => {
  launch();
  fireEvent.click(screen.getByRole("button", { name: "Start intervals" }));
  jump(12);
  fireEvent.click(screen.getByRole("button", { name: "Pause intervals" }));
  const value = screen.getByRole("timer").textContent;
  jump(60);
  expect(screen.getByRole("timer")).toHaveTextContent(value!);
  expect(playCountdownPip).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Resume intervals" }));
  jump(5);
  expect(screen.getByRole("timer").textContent).not.toBe(value);
});
it("keeps a paused set on exit and restores it without starting sounds", () => {
  const w = launch();
  fireEvent.click(screen.getByRole("button", { name: "Start intervals" }));
  jump(15);
  cleanup();
  jump(120);
  launch(w);
  expect(screen.getByRole("heading", { name: "Work" })).toBeVisible();
  expect(screen.getByRole("timer")).toHaveTextContent("00:15");
  expect(
    screen.getByRole("button", { name: "Resume intervals" }),
  ).toBeEnabled();
  expect(playCadenceBeep).not.toHaveBeenCalled();
  cleanup();
  vi.setSystemTime(new Date(2026, 9, 19, 5, 30));
  launch(w);
  expect(screen.getByRole("timer")).toHaveTextContent("00:10");
  expect(screen.getByRole("button", { name: "Start intervals" })).toBeEnabled();
});
it("validates custom blanks and requires reset before changing an active set", () => {
  launch();
  fireEvent.change(screen.getByRole("combobox", { name: "Interval style" }), {
    target: { value: "custom" },
  });
  fireEvent.change(screen.getByLabelText("Work (seconds)"), {
    target: { value: "" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Start intervals" }));
  expect(screen.getByRole("alert")).toHaveTextContent("1–300");
  fireEvent.change(screen.getByLabelText("Work (seconds)"), {
    target: { value: "5" },
  });
  fireEvent.change(screen.getByLabelText("Rest (seconds)"), {
    target: { value: "0" },
  });
  fireEvent.change(screen.getByLabelText("Rounds"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Get ready (seconds)"), {
    target: { value: "0" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Start intervals" }));
  jump(1);
  expect(screen.getByLabelText("Work (seconds)")).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Pause intervals" }));
  expect(screen.getByLabelText("Work (seconds)")).toBeDisabled();
  vi.mocked(window.confirm).mockReturnValueOnce(false);
  fireEvent.click(screen.getByRole("button", { name: "Reset intervals" }));
  expect(screen.getByLabelText("Work (seconds)")).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Reset intervals" }));
  expect(screen.getByLabelText("Work (seconds)")).toBeEnabled();
  expect(screen.getByRole("timer")).toHaveTextContent("00:05");
});

it("focuses on start, keeps escape harmless, and supports space without double toggling", () => {
  launch();
  fireEvent.click(screen.getByRole("button", { name: "Start intervals" }));
  const timer = screen.getByRole("region", { name: "Interval timer" });
  expect(timer).toHaveFocus();
  jump(12);
  fireEvent.keyDown(timer, { code: "Space", key: " " });
  expect(
    screen.getByRole("button", { name: "Resume intervals" }),
  ).toBeEnabled();
  const value = screen.getByRole("timer").textContent;
  fireEvent.keyDown(timer, { code: "Space", key: " ", repeat: true });
  jump(20);
  expect(screen.getByRole("timer").textContent).toBe(value);
  fireEvent.keyDown(timer, { code: "Space", key: " " });
  expect(screen.getByRole("button", { name: "Pause intervals" })).toBeVisible();
  fireEvent.keyDown(timer, { key: "Escape" });
  expect(screen.getByRole("button", { name: "Focus timer" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(screen.getByRole("button", { name: "Pause intervals" })).toBeEnabled();
});
it("pauses a page-cache interruption rather than silently advancing on return", () => {
  launch();
  fireEvent.click(screen.getByRole("button", { name: "Start intervals" }));
  jump(12);
  fireEvent(window, new Event("pagehide"));
  jump(120);
  fireEvent(window, new Event("pageshow"));
  expect(screen.getByRole("timer")).toHaveTextContent("00:18");
  expect(
    screen.getByRole("button", { name: "Resume intervals" }),
  ).toBeEnabled();
});
it("previews the next phase and runs the 40/20 preset without changing the plan", () => {
  const w = launch();
  const original = JSON.stringify(w);
  fireEvent.change(screen.getByRole("combobox", { name: "Interval style" }), {
    target: { value: "steady" },
  });
  expect(screen.getByText("Next: Work · 00:40")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Start intervals" }));
  jump(10);
  expect(screen.getByRole("timer")).toHaveTextContent("00:40");
  expect(screen.getByText("Next: Rest · 00:20")).toBeVisible();
  jump(40);
  expect(screen.getByRole("heading", { name: "Rest" })).toBeVisible();
  expect(JSON.stringify(w)).toBe(original);
});

it("catches up after a hidden tab without replaying missed sound cues", () => {
  launch();
  fireEvent.change(screen.getByRole("combobox", { name: "Timer sound" }), {
    target: { value: "beeps" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Start intervals" }));
  vi.clearAllMocks();
  const visibility = vi.spyOn(document, "visibilityState", "get");
  visibility.mockReturnValue("hidden");
  jump(45);
  visibility.mockReturnValue("visible");
  fireEvent(document, new Event("visibilitychange"));
  expect(screen.getByRole("timer")).toHaveTextContent("00:15");
  expect(screen.getByRole("heading", { name: "Work" })).toBeVisible();
  expect(playCountdownPip).not.toHaveBeenCalled();
  expect(playCadenceBeep).not.toHaveBeenCalled();
  jump(12);
  expect(playCountdownPip).toHaveBeenCalledTimes(1);
});
