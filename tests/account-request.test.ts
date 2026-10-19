// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from "vitest";
const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { getSession } }),
}));
import {
  accountRequest,
  accountStorageKey,
  scopedDraftKey,
  cleanSignInUrl,
} from "../src/auth";
const owner = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://auth.invalid");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-fixture");
  getSession.mockResolvedValue({
    data: { session: { user: { id: owner }, access_token: "fixture-token" } },
    error: null,
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it("sends a current session token to the account RPC without any client-selected owner or guest recovery code", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ version: 0, workouts: [] })),
    );
  vi.stubGlobal("fetch", fetcher);
  expect(await accountRequest(owner, "get")).toEqual({
    version: 0,
    workouts: [],
  });
  const [url, request] = fetcher.mock.calls[0];
  expect(String(url)).toBe("https://auth.invalid/rest/v1/rpc/fe_account_plans");
  expect(request.headers.Authorization).toBe("Bearer fixture-token");
  expect(JSON.parse(request.body)).toEqual({
    operation: "get",
    expected_version: 0,
    payload: [],
  });
});
it("stops an old workspace request after signing out or changing accounts", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  getSession.mockResolvedValue({ data: { session: null }, error: null });
  await expect(accountRequest(owner, "put")).rejects.toThrow("Sign in again");
  getSession.mockResolvedValue({
    data: { session: { user: { id: "other" }, access_token: "other" } },
    error: null,
  });
  await expect(accountRequest(owner, "get")).rejects.toThrow("Sign in again");
  expect(fetcher).not.toHaveBeenCalled();
});
it("reports a conflict or malformed cloud data without overwriting local state", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response("{}", { status: 409 }))
    .mockResolvedValueOnce(new Response('{"version":1,"workouts":[{}]}'));
  vi.stubGlobal("fetch", fetcher);
  await expect(accountRequest(owner, "put")).rejects.toThrow(
    "changed on another device",
  );
  await expect(accountRequest(owner, "get")).rejects.toThrow(
    "unreadable record",
  );
});
it("keeps guest and account draft keys separate and removes failed callback details", () => {
  expect(accountStorageKey()).toBe("fe-planner:v1");
  expect(accountStorageKey(owner)).not.toBe(accountStorageKey());
  expect(scopedDraftKey("draft", owner)).not.toBe(scopedDraftKey("draft"));
  history.replaceState({}, "", "/?code=one-use&signin=1#my-workouts");
  cleanSignInUrl();
  expect(location.search).toBe("");
  expect(location.hash).toBe("#my-workouts");
  history.replaceState(
    {},
    "",
    "/#error=access_denied&error_description=expired",
  );
  cleanSignInUrl();
  expect(location.hash).toBe("#settings");
});
