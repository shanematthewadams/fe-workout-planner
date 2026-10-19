// @vitest-environment jsdom
import React from "react";
import App from "../src/App";
import { readState, writeState } from "../src/model";
import {
  act,
  cleanup,
  renderHook,
  render,
  screen,
  fireEvent,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cloudRequest, cloudConnection } from "../src/cloud";
import { useCloudSave, SYNC_SETTINGS } from "../src/useCloudSave";
import { newWorkout } from "../src/model";
vi.mock("../src/cloud", async (original) => ({
  ...(await original<typeof import("../src/cloud")>()),
  cloudRequest: vi.fn(),
}));
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.stubEnv("VITE_APP_ENV", "production");
  vi.stubEnv("VITE_SUPABASE_URL", "https://production.example");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-test");
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(900);
  });
}
it("automatically saves after connecting and after a saved workout changes, with no manual sync step", async () => {
  const w = newWorkout();
  let remote = { version: 0, workouts: [] as (typeof w)[] };
  vi.mocked(cloudRequest).mockImplementation(
    async (_code, op, _version, items) => {
      if (op === "put")
        remote = { version: remote.version + 1, workouts: items! };
      return remote;
    },
  );
  const merge = vi.fn(() => true);
  const hook = renderHook(
    ({ workouts }) => useCloudSave(workouts, merge, false),
    { initialProps: { workouts: [w] } },
  );
  act(() => hook.result.current.connect("a".repeat(64)));
  await settle();
  expect(remote.workouts).toEqual([w]);
  expect(hook.result.current.status).toBe("Saved to cloud");
  const edited = { ...w, title: "Edited Q" };
  hook.rerender({ workouts: [edited] });
  await settle();
  expect(remote.workouts).toEqual([edited]);
  expect(remote.version).toBe(2);
  await settle();
  expect(remote.version).toBe(2);
});
it("does not loop on a failed connection, retries on reconnect, and preserves the device copy", async () => {
  const w = newWorkout();
  localStorage.setItem(
    SYNC_SETTINGS,
    JSON.stringify({ code: "b".repeat(64), base: [w] }),
  );
  vi.mocked(cloudRequest).mockRejectedValue(
    new Error("Connection unavailable"),
  );
  const merge = vi.fn(() => true);
  const hook = renderHook(() => useCloudSave([w], merge, false));
  await settle();
  expect(merge).not.toHaveBeenCalled();
  expect(hook.result.current.status).toBe("Connection unavailable");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30000);
  });
  expect(cloudRequest).toHaveBeenCalledTimes(1);
  vi.mocked(cloudRequest).mockResolvedValue({ version: 1, workouts: [w] });
  act(() => window.dispatchEvent(new Event("online")));
  await settle();
  expect(hook.result.current.status).toBe("Saved to cloud");
  expect(cloudRequest).toHaveBeenCalledTimes(2);
});
it("never applies a cloud merge after newer local edits arrive in flight", async () => {
  const w = newWorkout();
  localStorage.setItem(
    SYNC_SETTINGS,
    JSON.stringify({ code: "c".repeat(64), base: [w] }),
  );
  let finish!: (value: { version: number; workouts: (typeof w)[] }) => void;
  vi.mocked(cloudRequest).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const merge = vi.fn(() => true);
  const hook = renderHook(
    ({ workouts }) => useCloudSave(workouts, merge, false),
    { initialProps: { workouts: [w] } },
  );
  await settle();
  hook.rerender({ workouts: [{ ...w, title: "New local edit" }] });
  await act(async () => {
    finish({ version: 2, workouts: [{ ...w, title: "Remote edit" }] });
  });
  expect(merge).not.toHaveBeenCalled();
  expect(cloudRequest).toHaveBeenCalledTimes(1);
});
it("pauses cloud work while storage recovery or unsaved edits need attention", async () => {
  const w = newWorkout();
  localStorage.setItem(
    SYNC_SETTINGS,
    JSON.stringify({ code: "d".repeat(64), base: [w] }),
  );
  vi.mocked(cloudRequest).mockResolvedValue({ version: 1, workouts: [w] });
  const hook = renderHook(
    ({ blocked }) => useCloudSave([w], () => true, blocked),
    { initialProps: { blocked: true } },
  );
  await settle();
  expect(cloudRequest).not.toHaveBeenCalled();
  hook.rerender({ blocked: false });
  await settle();
  expect(cloudRequest).toHaveBeenCalledTimes(1);
});
it("uses the existing private cloud store on staging while keeping browser connections explicit", () => {
  vi.stubEnv("VITE_APP_ENV", "staging");
  expect(cloudConnection()).toEqual({
    url: "https://production.example",
    key: "public-test",
    rpc: "fe_sync_plans",
  });
  vi.stubEnv("VITE_SUPABASE_URL", "http://production.example");
  expect(cloudConnection()).toBeNull();
  vi.stubEnv("VITE_SUPABASE_URL", "https://production.example");
  localStorage.setItem(
    SYNC_SETTINGS,
    JSON.stringify({ code: "e".repeat(64), base: [] }),
  );
  const hook = renderHook(() => useCloudSave([], () => true, false));
  expect(hook.result.current.config).toBeNull();
});

it("keeps both versions when cloud changes arrive before edits to an already-open editor", async () => {
  const w = newWorkout();
  w.title = "Initial Q";
  writeState({ workouts: [w], favorites: [] });
  localStorage.setItem(
    SYNC_SETTINGS,
    JSON.stringify({ code: "a".repeat(64), base: [w] }),
  );
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.spyOn(globalThis, "fetch").mockRejectedValue(
    new Error("Catalog unavailable"),
  );
  vi.mocked(cloudRequest).mockResolvedValue({
    version: 2,
    workouts: [{ ...w, title: "Remote version" }],
  });
  history.replaceState({}, "", `/#edit/${w.id}`);
  render(<App />);
  await settle();
  fireEvent.change(screen.getByLabelText("Workout title"), {
    target: { value: "My late edit" },
  });
  fireEvent.click(screen.getAllByRole("button", { name: "Save workout" })[0]);
  const saved = readState().workouts;
  expect(saved).toHaveLength(2);
  expect(saved.find((value) => value.id === w.id)?.title).toBe(
    "Remote version",
  );
  expect(
    saved.some((value) => value.title === "My late edit · conflict copy"),
  ).toBe(true);
});
