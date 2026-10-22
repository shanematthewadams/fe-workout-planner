// @vitest-environment jsdom
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import App from "../src/App";
beforeEach(() => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://production.example");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-public");
  localStorage.clear();
  sessionStorage.clear();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
it("builds an offline formal plan, saves it, and leads the same plan in the field", () => {
  render(<App />);
  expect(screen.getByRole("button", { name: /Surprise Me!/ })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /Formal Builder/ }));
  fireEvent.change(screen.getByLabelText("Plan title"), {
    target: { value: "Digging for gold" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Use offline template" }));
  expect(
    screen.getByRole("heading", { name: "Digging for gold" }),
  ).toBeVisible();
  expect(screen.getByLabelText("45-minute Q timeline")).toHaveTextContent(
    "29 min",
  );
  fireEvent.click(screen.getByRole("button", { name: "Save workout" }));
  fireEvent.click(screen.getByRole("button", { name: "Preview & print" }));
  const saved = JSON.parse(localStorage.getItem("fe-planner:v1")!).workouts[0];
  expect(location.hash).toBe(`#workout/${saved.id}`);
  expect(
    screen.getByRole("heading", { name: "Digging for gold" }),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Lead workout" }));
  expect(screen.queryByRole("timer")).toBeNull();
  expect(screen.queryByText("Four-count cadence")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Session timer" }));
  expect(screen.getByRole("timer")).toHaveTextContent("45:00");
  expect(screen.getByRole("combobox", { name: "Timer sound" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "← Back to plan" }));
  fireEvent.click(screen.getByRole("link", { name: "My Workouts" }));
  expect(
    screen.getByRole("button", { name: "Digging for gold" }),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("link", { name: "Saving & recovery" }));
  expect(
    screen.queryByRole("button", { name: "Connect my devices" }),
  ).toBeNull();
  expect(localStorage.getItem("fe-sync:v1")).not.toBeNull();
});
it("skipping Mary yields 35 minutes of The Thang and searchable reference terms", () => {
  render(<App />);
  fireEvent.click(screen.getByText("Session preferences"));
  fireEvent.click(screen.getByLabelText("Include closing Mary"));
  fireEvent.click(screen.getByRole("button", { name: "Use offline template" }));
  expect(screen.getByLabelText("45-minute Q timeline")).toHaveTextContent(
    "35 min",
  );
  fireEvent.click(screen.getByRole("link", { name: "Exicon & Lexicon" }));
  fireEvent.click(screen.getByRole("button", { name: "Lexicon" }));
  fireEvent.change(screen.getByLabelText("Search reference"), {
    target: { value: "mumblechatter" },
  });
  expect(screen.getByRole("heading", { name: "Mumblechatter" })).toBeVisible();
});
