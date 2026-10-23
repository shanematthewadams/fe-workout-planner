// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { useCloudSave } from "../src/useCloudSave";
import { accountRequest } from "../src/auth";
import { cloudRequest } from "../src/cloud";
import { newWorkout } from "../src/model";
vi.mock("../src/auth", async (original) => ({
  ...(await original<typeof import("../src/auth")>()),
  accountRequest: vi.fn(),
}));
vi.mock("../src/cloud", async (original) => ({
  ...(await original<typeof import("../src/cloud")>()),
  cloudRequest: vi.fn(),
}));
const owner = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.stubEnv("VITE_APP_ENV", "staging");
  vi.stubEnv("VITE_SUPABASE_URL", "https://auth.invalid");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-fixture");
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
it("loads an account library onto an empty device without creating a guest recovery collection", async () => {
  const plan = newWorkout();
  vi.mocked(accountRequest).mockResolvedValue({ version: 1, workouts: [plan] });
  const merge = vi.fn(() => true);
  const { result } = renderHook(() => useCloudSave([], merge, false, owner));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(900);
  });
  expect(accountRequest).toHaveBeenCalledWith(
    owner,
    "get",
    0,
    [],
    expect.any(AbortSignal),
  );
  expect(merge).toHaveBeenCalledWith([plan]);
  expect(result.current.config?.code).toBe(owner);
  expect(localStorage.getItem("fe-sync:staging:v1")).toBeNull();
  expect(cloudRequest).not.toHaveBeenCalled();
});
it("never falls back to guest storage when an account session expires", async () => {
  const plan = newWorkout();
  vi.mocked(accountRequest).mockRejectedValue(
    Error(
      "Sign in again to upload your account workouts. Your device copy is safe.",
    ),
  );
  const merge = vi.fn(() => true);
  const { result } = renderHook(() =>
    useCloudSave([plan], merge, false, owner),
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(900);
  });
  expect(result.current.status).toMatch(/Sign in again/);
  expect(merge).not.toHaveBeenCalled();
  expect(cloudRequest).not.toHaveBeenCalled();
  expect(localStorage.getItem("fe-sync:staging:v1")).toBeNull();
});
