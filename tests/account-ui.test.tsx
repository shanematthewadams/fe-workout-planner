// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";
import App from "../src/App";
import { AccountWorkspace } from "../src/AccountContext";
import { getAuthClient, accountRequest, accountStorageKey } from "../src/auth";
import { newWorkout, readState, writeState, STORAGE_KEY } from "../src/model";
vi.mock("../src/auth", async (original) => ({
  ...(await original<typeof import("../src/auth")>()),
  getAuthClient: vi.fn(),
  accountRequest: vi.fn(),
}));
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
let session: Session | null;
let listener: (event: string, value: Session | null) => void;
const signedIn = (id: string) =>
  ({
    access_token: "fixture",
    refresh_token: "fixture",
    expires_in: 3600,
    token_type: "bearer",
    user: { id, email: `${id[0]}@example.test` },
  }) as Session;
let send: ReturnType<typeof vi.fn>;
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  session = null;
  vi.stubEnv("VITE_SUPABASE_URL", "https://auth.invalid");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-fixture");
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  send = vi.fn().mockResolvedValue({ error: null });
  vi.mocked(getAuthClient).mockReturnValue({
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      onAuthStateChange: (callback: typeof listener) => {
        listener = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      signInWithOtp: send,
      signOut: async () => {
        session = null;
        listener("SIGNED_OUT", null);
        return { error: null };
      },
    },
  } as unknown as NonNullable<ReturnType<typeof getAuthClient>>);
  vi.mocked(accountRequest).mockResolvedValue({ version: 0, workouts: [] });
  history.replaceState({}, "", "/#settings");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
it("keeps guest use open and sends only an email link with a same-origin redirect", async () => {
  render(
    <AccountWorkspace>
      <App />
    </AccountWorkspace>,
  );
  await screen.findByRole("heading", { name: "Keep your workouts" });
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "q@example.test" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Email me a sign-in link" }),
  );
  await screen.findByText(/Check your email/);
  expect(send).toHaveBeenCalledWith({
    email: "q@example.test",
    options: {
      emailRedirectTo: location.origin + "/?signin=1#my-workouts",
      shouldCreateUser: true,
    },
  });
  expect(screen.getByRole("button", { name: /Send again in/ })).toBeDisabled();
  expect(screen.getByRole("link", { name: "Build" })).toHaveAttribute(
    "href",
    "#build",
  );
});
it("separates account caches, imports guest copies explicitly and restores guest view after sign-out", async () => {
  const guest = newWorkout();
  guest.title = "Guest original";
  const account = newWorkout();
  account.title = "Account A only";
  writeState({ workouts: [guest], favorites: [] });
  writeState(
    { workouts: [account], favorites: [] },
    localStorage,
    accountStorageKey(a),
  );
  session = signedIn(a);
  render(
    <AccountWorkspace>
      <App />
    </AccountWorkspace>,
  );
  await screen.findByText("1@example.test");
  expect(readState().workouts).toEqual([guest]);
  fireEvent.click(
    screen.getByRole("button", { name: "Add guest workouts to my account" }),
  );
  expect(
    readState(localStorage, accountStorageKey(a)).workouts.map((w) => w.title),
  ).toEqual(["Account A only", "Guest original"]);
  expect(readState().workouts).toEqual([guest]);
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  await screen.findByRole("heading", { name: "Keep your workouts" });
  fireEvent.click(screen.getByRole("link", { name: "My Workouts" }));
  expect(screen.getByRole("button", { name: "Guest original" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Account A only" })).toBeNull();
  await act(async () => {
    session = signedIn(b);
    listener("SIGNED_IN", session);
  });
  expect(screen.queryByRole("button", { name: "Account A only" })).toBeNull();
  expect(readState(localStorage, accountStorageKey(b)).workouts).toEqual([]);
  expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
});
it("keeps dirty edits in their account when another tab signs out", async () => {
  session = signedIn(a);
  render(
    <AccountWorkspace>
      <App />
    </AccountWorkspace>,
  );
  await screen.findByText("1@example.test");
  fireEvent.click(screen.getByRole("link", { name: "My Workouts" }));
  fireEvent.click(
    screen.getAllByRole("button", { name: "Create a workout" })[0],
  );
  fireEvent.change(screen.getByLabelText("Workout title"), {
    target: { value: "Unsaved private edits" },
  });
  await act(async () => {
    session = null;
    listener("SIGNED_OUT", null);
  });
  expect(screen.getByLabelText("Workout title")).toHaveValue(
    "Unsaved private edits",
  );
  await waitFor(() =>
    expect(
      screen.getByText(/Your sign-in changed in another tab/),
    ).toBeVisible(),
  );
  expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
});
it("reports failed delivery without claiming a link was sent", async () => {
  send.mockResolvedValue({ error: { status: 429 } });
  render(
    <AccountWorkspace>
      <App />
    </AccountWorkspace>,
  );
  await screen.findByRole("heading", { name: "Keep your workouts" });
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "q@example.test" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Email me a sign-in link" }),
  );
  await screen.findByText(/Please wait a minute/);
  expect(screen.queryByText(/Check your email/)).toBeNull();
});

it("opens the scoped account cache offline even when the stored token needs a refresh", async () => {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  localStorage.setItem("fe-auth:v1", JSON.stringify(signedIn(a)));
  const plan = newWorkout();
  plan.title = "Offline account Q";
  writeState(
    { workouts: [plan], favorites: [] },
    localStorage,
    accountStorageKey(a),
  );
  const client = getAuthClient()!;
  client.auth.getSession = vi.fn().mockResolvedValue({
    data: { session: null },
    error: { name: "AuthRetryableFetchError" },
  });
  render(
    <AccountWorkspace>
      <App />
    </AccountWorkspace>,
  );
  await screen.findByText("1@example.test");
  await act(async () => listener("INITIAL_SESSION", null));
  fireEvent.click(screen.getByRole("link", { name: "My Workouts" }));
  expect(
    screen.getByRole("button", { name: "Offline account Q" }),
  ).toBeVisible();
  expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
});
