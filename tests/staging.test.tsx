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
it("marks staging and disables cloud entry points without a request", async () => {
  vi.stubEnv("VITE_APP_ENV", "staging");
  const fetcher = vi.spyOn(globalThis, "fetch");
  render(
    <>
      <StagingNotice />
      <CloudSync workouts={[]} onMerge={() => true} onStudio={() => true} />
    </>,
  );
  expect(screen.getByLabelText("Staging version")).toBeVisible();
  expect(
    screen.getByLabelText("Cloud sync unavailable in staging"),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Enable cloud sync" }),
  ).toBeNull();
  await expect(cloudRequest("a".repeat(64), "put", 0, [])).rejects.toThrow(
    "disabled",
  );
  await expect(cloudRequest("a".repeat(64), "get")).rejects.toThrow("disabled");
  expect(fetcher).not.toHaveBeenCalled();
});
it("retains production cloud controls and omits the staging label", () => {
  vi.stubEnv("VITE_APP_ENV", "production");
  localStorage.clear();
  render(
    <>
      <StagingNotice />
      <CloudSync workouts={[]} onMerge={() => true} onStudio={() => true} />
    </>,
  );
  expect(screen.queryByLabelText("Staging version")).toBeNull();
  expect(
    screen.getByRole("button", { name: "Enable cloud sync" }),
  ).toBeVisible();
});
