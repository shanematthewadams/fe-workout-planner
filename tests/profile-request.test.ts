import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { getAuthClient } from "../src/auth";
import { requestProfile } from "../src/profile";
vi.mock("../src/auth", () => ({ getAuthClient: vi.fn() }));
const owner = "11111111-1111-4111-8111-111111111111";
const row = {
  user_id: owner,
  display_name: "Rug Burn",
  home_region: "The FE",
  home_ao: "Overdraft",
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-19T00:00:00Z",
};
let fetcher: ReturnType<typeof vi.fn<typeof fetch>>;
let getSession: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetcher = vi.fn<typeof fetch>();
  const real = createClient("https://profile.invalid", "public-fixture", {
    accessToken: async () => "fixture-token",
    global: { fetch: fetcher },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  getSession = vi
    .fn()
    .mockResolvedValue({
      data: { session: { user: { id: owner } } },
      error: null,
    });
  vi.mocked(getAuthClient).mockReturnValue({
    auth: { getSession },
    from: real.from.bind(real),
  } as unknown as NonNullable<ReturnType<typeof getAuthClient>>);
});
afterEach(() => vi.clearAllMocks());
it("reads only the active account profile through the real Supabase query builder", async () => {
  fetcher.mockResolvedValue(new Response(JSON.stringify([row])));
  expect(await requestProfile(owner)).toEqual(row);
  const [url, options] = fetcher.mock.calls[0];
  expect(String(url)).toContain("user_id=eq." + owner);
  expect(new Headers(options?.headers).get("Authorization")).toBe(
    "Bearer fixture-token",
  );
});
it("saves trimmed F3 identity with an immutable session owner and no email or supplied timestamps", async () => {
  fetcher.mockResolvedValue(new Response(JSON.stringify(row)));
  await requestProfile(owner, {
    display_name: "  Rug Burn  ",
    home_region: "The FE",
    home_ao: "Overdraft",
  });
  const [, options] = fetcher.mock.calls[0];
  expect(options?.method).toBe("POST");
  expect(JSON.parse(options?.body as string)).toEqual({
    user_id: owner,
    display_name: "Rug Burn",
    home_region: "The FE",
    home_ao: "Overdraft",
  });
});
it("does not write after an account change or for whitespace-only names", async () => {
  getSession.mockResolvedValueOnce({
    data: { session: { user: { id: "other" } } },
    error: null,
  });
  await expect(
    requestProfile(owner, {
      display_name: "Rug Burn",
      home_region: "",
      home_ao: "",
    }),
  ).rejects.toThrow("Sign in again");
  await expect(
    requestProfile(owner, {
      display_name: "   ",
      home_region: "",
      home_ao: "",
    }),
  ).rejects.toThrow("Enter your F3 Name");
  expect(fetcher).not.toHaveBeenCalled();
});
it("distinguishes missing profiles from unavailable or malformed storage", async () => {
  fetcher.mockResolvedValueOnce(new Response("[]"));
  expect(await requestProfile(owner)).toBeNull();
  fetcher.mockResolvedValueOnce(
    new Response(
      JSON.stringify({ message: "relation does not exist", code: "42P01" }),
      { status: 404 },
    ),
  );
  await expect(requestProfile(owner)).rejects.toThrow("Couldn’t open or save");
  fetcher.mockResolvedValueOnce(
    new Response(JSON.stringify([{ user_id: owner }])),
  );
  await expect(requestProfile(owner)).rejects.toThrow("could not be read");
});
