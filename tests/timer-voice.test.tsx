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
import { intervalVoiceCue } from "../src/interval-voice";
import { TABATA } from "../src/interval-timer";
import { cancelTimerVoice, speakTimerCue } from "../src/utils/timer-voice";
import { FieldTimer } from "../src/FieldTimer";
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
let spoken: SpeechSynthesisUtterance[];
let synth: {
  speak: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
  getVoices: ReturnType<typeof vi.fn>;
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 18, 5, 30));
  localStorage.clear();
  vi.clearAllMocks();
  spoken = [];
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      constructor(public text: string) {}
    },
  );
  synth = {
    speak: vi.fn((utterance: SpeechSynthesisUtterance) => {
      spoken.push(utterance);
      utterance.onstart?.(new Event("start") as SpeechSynthesisEvent);
    }),
    cancel: vi.fn(),
    getVoices: vi.fn(() => []),
  };
  vi.stubGlobal("speechSynthesis", synth);
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  cancelTimerVoice();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const texts = () => spoken.map((utterance) => utterance.text);
const advance = (seconds: number) => {
  for (let left = seconds * 1000; left > 0; left -= 100)
    act(() => {
      vi.advanceTimersByTime(Math.min(100, left));
    });
};
function launch() {
  render(<FieldTimer workout={newWorkout()} onExit={() => {}} />);
  if (!screen.queryByRole("button", { name: "Intervals" }))
    fireEvent.click(screen.getByText("Timer options", { exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Intervals" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Timer sound" }), {
    target: { value: "voice" },
  });
}
it("says three-two-one-go, halfway, five-to-one-stop, and the next go at the correct boundaries", () => {
  expect(
    [7, 8, 9, 10, 20, 25, 26, 27, 28, 29, 30, 37, 38, 39, 40].map((t) =>
      intervalVoiceCue(TABATA, t - 0.1, t),
    ),
  ).toEqual([
    "Three",
    "Two",
    "One",
    "Go",
    "Halfway",
    "Five",
    "Four",
    "Three",
    "Two",
    "One",
    "Stop",
    "Three",
    "Two",
    "One",
    "Go",
  ]);
  expect(intervalVoiceCue(TABATA, 249.9, 250)).toBe("Stop. Set complete.");
});
it("drops stale phase, halfway and countdown cues rather than reciting missed commands", () => {
  expect(intervalVoiceCue(TABATA, 9, 14)).toBeNull();
  expect(intervalVoiceCue(TABATA, 18, 22)).toBeNull();
  expect(intervalVoiceCue(TABATA, 23, 25.8)).toBeNull();
  expect(intervalVoiceCue(TABATA, 240, 270)).toBeNull();
  expect(intervalVoiceCue(TABATA, 25, 27)).toBe("Three");
});
it("keeps short intervals and zero-rest round changes free of competing halfway/stop commands", () => {
  const short = { work: 10, rest: 0, rounds: 2, prepare: 0 };
  expect(intervalVoiceCue(short, 4.9, 5)).toBe("Five");
  expect(intervalVoiceCue(short, 9.9, 10)).toBe("Go");
  expect(intervalVoiceCue({ ...short, work: 12 }, 5.9, 6)).toBe("Halfway");
});
it("replaces old speech, prefers a local English voice, and ignores stale error callbacks", () => {
  const remote = { lang: "en-US", localService: false, default: true };
  const local = { lang: "en-US", localService: true, default: false };
  synth.getVoices.mockReturnValue([remote, local]);
  const fallback = vi.fn();
  speakTimerCue("Halfway", fallback);
  const old = spoken[0];
  expect(old.voice).toBe(local);
  speakTimerCue("Five", fallback);
  expect(synth.cancel).toHaveBeenCalledTimes(2);
  old.onerror?.(new Event("error") as SpeechSynthesisErrorEvent);
  expect(fallback).not.toHaveBeenCalled();
  expect(texts()).toEqual(["Halfway", "Five"]);
});
it("cancels a voice that cannot start promptly and falls back once", () => {
  synth.speak.mockImplementation((utterance: SpeechSynthesisUtterance) =>
    spoken.push(utterance),
  );
  const fallback = vi.fn();
  speakTimerCue("Go", fallback);
  advance(0.71);
  expect(fallback).toHaveBeenCalledTimes(1);
  expect(synth.cancel).toHaveBeenCalledTimes(2);
  advance(5);
  expect(fallback).toHaveBeenCalledTimes(1);
});
it("clears a waiting voice on mute without a late fallback", () => {
  synth.speak.mockImplementation(() => {});
  const fallback = vi.fn();
  speakTimerCue("Go", fallback);
  cancelTimerVoice();
  advance(1);
  expect(fallback).not.toHaveBeenCalled();
});
it("previews voice and runs spoken intervals without layering beeps", () => {
  launch();
  fireEvent.click(screen.getByRole("button", { name: "Preview sound" }));
  expect(texts()).toEqual(["Voice on", "Three, two, one, go"]);
  fireEvent.click(screen.getByRole("button", { name: "Start intervals" }));
  advance(10);
  expect(texts().slice(-5)).toEqual(["Get ready", "Three", "Two", "One", "Go"]);
  advance(20);
  expect(texts().slice(-7)).toEqual([
    "Halfway",
    "Five",
    "Four",
    "Three",
    "Two",
    "One",
    "Stop",
  ]);
  expect(playCadenceBeep).not.toHaveBeenCalled();
  expect(playCountdownPip).not.toHaveBeenCalled();
  expect(playSectionWhistle).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Preview sound" })).toBeDisabled();
});
it("cancels on pause, mute, reset and exit without changing elapsed time", () => {
  launch();
  fireEvent.click(screen.getByRole("button", { name: "Start intervals" }));
  advance(12);
  synth.cancel.mockClear();
  fireEvent.click(screen.getByRole("button", { name: "Pause intervals" }));
  expect(synth.cancel).toHaveBeenCalled();
  const frozen = screen.getByRole("timer").textContent;
  const count = spoken.length;
  advance(30);
  expect(spoken).toHaveLength(count);
  expect(screen.getByRole("timer").textContent).toBe(frozen);
  fireEvent.change(screen.getByRole("combobox", { name: "Timer sound" }), {
    target: { value: "off" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Resume intervals" }));
  advance(10);
  expect(spoken).toHaveLength(count);
  fireEvent.click(screen.getByRole("button", { name: "Reset intervals" }));
  expect(screen.getByRole("timer")).toHaveTextContent("00:10");
  synth.cancel.mockClear();
  cleanup();
  expect(synth.cancel).toHaveBeenCalled();
});
it("shows a readable fallback and switches to beeps if the device rejects speech", () => {
  launch();
  act(() => {
    spoken[0].onerror?.(new Event("error") as SpeechSynthesisErrorEvent);
  });
  expect(screen.getByRole("status")).toHaveTextContent("Using beeps instead");
  expect(screen.getByRole("combobox", { name: "Timer sound" })).toHaveValue(
    "beeps",
  );
  expect(playCadenceBeep).toHaveBeenCalledTimes(1);
});

it("cancels hidden speech and discards old cues on return", () => {
  launch();
  fireEvent.click(screen.getByRole("button", { name: "Start intervals" }));
  advance(9);
  const count = spoken.length;
  const visibility = vi
    .spyOn(document, "visibilityState", "get")
    .mockReturnValue("hidden");
  fireEvent(document, new Event("visibilitychange"));
  act(() => {
    vi.setSystemTime(Date.now() + 35000);
    vi.advanceTimersByTime(100);
  });
  expect(spoken).toHaveLength(count);
  visibility.mockReturnValue("visible");
  fireEvent(document, new Event("visibilitychange"));
  expect(spoken).toHaveLength(count);
  expect(screen.getByRole("heading", { name: "Work" })).toBeVisible();
});
it("supports session voice without changing its schedule and cancels on pause", () => {
  render(<FieldTimer workout={newWorkout()} onExit={() => {}} />);
  if (!screen.queryByRole("button", { name: "Session timer" }))
    fireEvent.click(screen.getByText("Timer options", { exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Session timer" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Use standard 45-minute timer" }),
  );
  fireEvent.change(screen.getByRole("combobox", { name: "Timer sound" }), {
    target: { value: "voice" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Start timer" }));
  expect(texts()).toEqual(["Voice on", "Timer started"]);
  advance(1);
  synth.cancel.mockClear();
  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  expect(synth.cancel).toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Resume" })).toBeEnabled();
});
