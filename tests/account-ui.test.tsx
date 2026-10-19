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
let verify: ReturnType<typeof vi.fn>;
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  session = null;
  vi.stubEnv("VITE_SUPABASE_URL", "https://auth.invalid");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-fixture");
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  send = vi.fn().mockResolvedValue({ error: null });
  verify = vi.fn().mockResolvedValue({
    data: { session: null },
    error: { status: 403, code: "otp_expired" },
  });
  vi.mocked(getAuthClient).mockReturnValue({
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      onAuthStateChange: (callback: typeof listener) => {
        listener = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      signInWithOtp: send,
      verifyOtp: verify,
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
it("keeps guest use open and requests an email code and preserves a safe return for old link templates", async () => {
  render(
    <AccountWorkspace>
      <App />
    </AccountWorkspace>,
  );
  await screen.findByRole("heading", { name: "Keep your workouts" });
  fireEvent.click(
    screen.getByRole("button", { name: "Already have an account? Sign in" }),
  );
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "q@example.test" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Email me a sign-in code" }),
  );
  await screen.findByText(/Check your email/);
  expect(send).toHaveBeenCalledWith({
    email: "q@example.test",
    options: {
      emailRedirectTo: location.origin + "/?signin=1#my-workouts",
      shouldCreateUser: false,
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
  // Leaving and reopening settings remounts its import button; metadata must not duplicate the original.
  fireEvent.click(screen.getByRole("link", { name: "My Workouts" }));
  fireEvent.click(screen.getByRole("link", { name: "Saving & recovery" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Add guest workouts to my account" }),
  );
  expect(readState(localStorage, accountStorageKey(a)).workouts).toHaveLength(
    2,
  );
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
it("reports failed delivery without claiming a code was sent", async () => {
  send.mockResolvedValue({ error: { status: 429 } });
  render(
    <AccountWorkspace>
      <App />
    </AccountWorkspace>,
  );
  await screen.findByRole("heading", { name: "Keep your workouts" });
  fireEvent.click(
    screen.getByRole("button", { name: "Already have an account? Sign in" }),
  );
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "q@example.test" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Email me a sign-in code" }),
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

async function requestCode() {
  render(
    <AccountWorkspace>
      <App />
    </AccountWorkspace>,
  );
  await screen.findByRole("heading", { name: "Keep your workouts" });
  fireEvent.click(
    screen.getByRole("button", { name: "Already have an account? Sign in" }),
  );
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "q@example.test" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Email me a sign-in code" }),
  );
  return screen.findByLabelText("Sign-in code");
}
it("verifies a pasted email code and opens the signed-in workout library", async () => {
  verify.mockImplementation(async () => {
    session = signedIn(a);
    listener("SIGNED_IN", session);
    return { data: { session }, error: null };
  });
  const input = await requestCode();
  expect(input).toHaveFocus();
  expect(input).toHaveAttribute("autocomplete", "one-time-code");
  fireEvent.change(input, { target: { value: "12 34 56 78" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify & sign in" }));
  await screen.findByRole("heading", { name: "My workouts" });
  expect(verify).toHaveBeenCalledWith({
    email: "q@example.test",
    token: "12345678",
    type: "email",
  });
  expect(location.hash).toBe("#my-workouts");
  expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
});
it("keeps the code form usable after a wrong or expired code and prevents short submissions", async () => {
  const input = await requestCode();
  fireEvent.change(input, { target: { value: "123" } });
  expect(
    screen.getByRole("button", { name: "Verify & sign in" }),
  ).toBeDisabled();
  fireEvent.change(input, { target: { value: "000000" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify & sign in" }));
  await screen.findByText(/That code is incorrect or has expired/);
  expect(input).toHaveFocus();
  expect(input).toHaveValue("000000");
  expect(verify).toHaveBeenCalledTimes(1);
  expect(
    screen.getByRole("button", { name: "Use a different email" }),
  ).toBeEnabled();
});
it("lets someone correct their email while preserving the resend limit", async () => {
  await requestCode();
  fireEvent.click(
    screen.getByRole("button", { name: "Use a different email" }),
  );
  const input = screen.getByLabelText("Email address");
  expect(input).toHaveFocus();
  fireEvent.change(input, { target: { value: "correct@example.test" } });
  expect(screen.getByRole("button", { name: /Send again in/ })).toBeDisabled();
  expect(send).toHaveBeenCalledTimes(1);
  expect(screen.queryByLabelText("Sign-in code")).toBeNull();
});
it("throttles verification attempts after the server rate limit", async () => {
  verify.mockResolvedValue({ data: { session: null }, error: { status: 429 } });
  const input = await requestCode();
  fireEvent.change(input, { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify & sign in" }));
  await screen.findByText(/Too many attempts/);
  expect(screen.getByRole("button", { name: /Try again in/ })).toBeDisabled();
  fireEvent.submit(input.closest("form")!);
  expect(verify).toHaveBeenCalledTimes(1);
});

it("keeps the signed-in editor open when a session refreshes in the background", async () => {
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
    target: { value: "Still editing after refresh" },
  });
  await act(async () => {
    session = { ...signedIn(a), access_token: "refreshed-fixture" };
    listener("TOKEN_REFRESHED", session);
  });
  expect(screen.getByLabelText("Workout title")).toHaveValue(
    "Still editing after refresh",
  );
  expect(screen.queryByText(/Your sign-in changed in another tab/)).toBeNull();
  expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
});

it("collects an F3 Name during signup and explains email confirmation without a code form", async () => {
  render(
    <AccountWorkspace>
      <App />
    </AccountWorkspace>,
  );
  await screen.findByRole("heading", { name: "Create your account" });
  fireEvent.change(screen.getByLabelText("F3 Name"), {
    target: { value: "  Rug Burn  " },
  });
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "new@example.test" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
  await screen.findByText(/Open the confirmation link/);
  expect(send).toHaveBeenCalledWith({
    email: "new@example.test",
    options: {
      emailRedirectTo: location.origin + "/?signin=1#my-workouts",
      shouldCreateUser: true,
      data: { f3_name: "Rug Burn" },
    },
  });
  expect(screen.queryByLabelText("Sign-in code")).toBeNull();
  expect(screen.getByRole("link", { name: "Build" })).toHaveAttribute(
    "href",
    "#build",
  );
});
