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
  fireEvent.click(screen.getByRole("button", { name: "Save a private copy" }));
  fireEvent.click(screen.getByRole("button", { name: "Preview & print" }));
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
  fireEvent.click(screen.getByRole("button", { name: "My Workouts" }));
  expect(
    screen.getByRole("button", { name: "Digging for gold" }),
  ).toBeVisible();
  fireEvent.click(screen.getByText("More", { selector: "summary" }));
  fireEvent.click(screen.getByRole("button", { name: "Saving & devices" }));
  expect(
    screen.getByRole("button", { name: "Connect my devices" }),
  ).toBeVisible();
});
it("skipping Mary yields 35 minutes of The Thang and searchable reference terms", () => {
  render(<App />);
  fireEvent.click(screen.getByText("Session preferences"));
  fireEvent.click(screen.getByLabelText("Include closing Mary"));
  fireEvent.click(screen.getByRole("button", { name: "Use offline template" }));
  expect(screen.getByLabelText("45-minute Q timeline")).toHaveTextContent(
    "35 min",
  );
  fireEvent.click(screen.getByText("More", { selector: "summary" }));
  fireEvent.click(screen.getByRole("button", { name: "Exicon & Lexicon" }));
  fireEvent.click(screen.getByRole("button", { name: "Lexicon" }));
  fireEvent.change(screen.getByLabelText("Search reference"), {
    target: { value: "mumblechatter" },
  });
  expect(screen.getByRole("heading", { name: "Mumblechatter" })).toBeVisible();
});
