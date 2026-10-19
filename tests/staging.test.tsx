// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { CloudSync } from "../src/CloudSync";
import { cloudRequest } from "../src/cloud";
import { StagingNotice } from "../src/StagingNotice";
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
it("marks staging and handles missing cloud configuration without a request", async () => {
  vi.stubEnv("VITE_APP_ENV", "staging");
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
  const fetcher = vi.spyOn(globalThis, "fetch");
  render(
    <>
      <StagingNotice />
      <CloudSync workouts={[]} onMerge={() => true} onStudio={() => true} />
    </>,
  );
  expect(screen.getByLabelText("Staging version")).toBeVisible();
  expect(screen.getByLabelText("Saving and recovery")).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Connect my devices" }),
  ).toBeNull();
  await expect(cloudRequest("a".repeat(64), "put", 0, [])).rejects.toThrow(
    "not configured",
  );
  await expect(cloudRequest("a".repeat(64), "get")).rejects.toThrow(
    "not configured",
  );
  expect(fetcher).not.toHaveBeenCalled();
});
it("saves automatically without connection setup and omits the staging label in production", () => {
  vi.stubEnv("VITE_APP_ENV", "production");
  localStorage.clear();
  vi.stubEnv("VITE_SUPABASE_URL", "https://production.example");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-public");
  render(
    <>
      <StagingNotice />
      <CloudSync workouts={[]} onMerge={() => true} onStudio={() => true} />
    </>,
  );
  expect(screen.queryByLabelText("Staging version")).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Connect my devices" }),
  ).toBeNull();
  expect(screen.getByText("Workouts save automatically")).toBeVisible();
});
