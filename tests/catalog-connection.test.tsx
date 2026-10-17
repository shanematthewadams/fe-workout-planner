// @vitest-environment jsdom
import React from "react";
import { afterEach, it, expect, vi } from "vitest";
import {
  render as renderUI,
  screen,
  cleanup,
  fireEvent,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import App from "../src/App";
import { catalog } from "../src/catalog";
import { copyWorkout, writeState, readState } from "../src/model";
function render(element: React.ReactElement) {
  const view = renderUI(element);
  fireEvent.click(screen.getByRole("button", { name: "Library" }));
  return view;
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  localStorage.clear();
});
function configure() {
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
}
it("confirms a loaded published library after a validated remote response", async () => {
  configure();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(catalog.map((data) => ({ data })))),
  );
  render(<App />);
  expect(
    await screen.findByText(/Latest published library loaded\./),
  ).toBeVisible();
  expect(screen.getAllByRole("button", { name: "View workout" })).toHaveLength(
    35,
  );
});
it("keeps the bundled library and private saved copy when configured upstream fails", async () => {
  configure();
  const personal = copyWorkout(catalog[0]);
  personal.title = "Private offline plan";
  writeState(
    { workouts: [personal], favorites: [catalog[0].id] },
    localStorage,
  );
  vi.spyOn(globalThis, "fetch").mockRejectedValue(
    new Error("upstream unavailable"),
  );
  render(<App />);
  expect(
    await screen.findByText(
      "Shared catalog unavailable. Showing the bundled catalog snapshot.",
    ),
  ).toBeVisible();
  expect(screen.getAllByRole("button", { name: "View workout" })).toHaveLength(
    35,
  );
  fireEvent.click(screen.getByRole("button", { name: /My workouts/i }));
  expect(
    screen.getByRole("button", { name: "Private offline plan" }),
  ).toBeVisible();
  expect(readState(localStorage).workouts).toEqual([personal]);
});
