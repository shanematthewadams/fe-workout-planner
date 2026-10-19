// @vitest-environment jsdom
import {
  fireEvent,
  render,
  screen,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ProfileWorkspace, ProfileEditor } from "../src/ProfileContext";
import { requestProfile } from "../src/profile";
import { useAccount } from "../src/AccountContext";
vi.mock("../src/AccountContext", () => ({ useAccount: vi.fn() }));
vi.mock("../src/profile", async (original) => ({
  ...(await original<typeof import("../src/profile")>()),
  requestProfile: vi.fn(),
}));
const owner = "11111111-1111-4111-8111-111111111111";
const profile = {
  user_id: owner,
  display_name: "Rug Burn",
  home_region: "The FE",
  home_ao: "Overdraft",
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-19T00:00:00Z",
};
beforeEach(() => {
  vi.mocked(useAccount).mockReturnValue({
    user: { id: owner, email: "private@example.test" },
    available: true,
    switching: false,
    blocked: false,
    setBlocked: vi.fn(),
    error: "",
    clearError: vi.fn(),
  });
  vi.mocked(requestProfile).mockResolvedValue(null);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("prompts a new account for its F3 Name and saves profile fields", async () => {
  render(
    <ProfileWorkspace>
      <ProfileEditor />
    </ProfileWorkspace>,
  );
  await screen.findByText("Complete profile");
  fireEvent.change(screen.getByLabelText("Display Name"), {
    target: { value: "Rug Burn" },
  });
  fireEvent.change(screen.getByLabelText("Home AO (optional)"), {
    target: { value: "Overdraft" },
  });
  vi.mocked(requestProfile).mockResolvedValue(profile);
  fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
  await screen.findByText("Your F3 profile");
  expect(screen.getByText("Profile saved.")).toBeTruthy();
  expect(requestProfile).toHaveBeenLastCalledWith(owner, {
    display_name: "Rug Burn",
    home_region: "The FE",
    home_ao: "Overdraft",
  });
  expect(screen.queryByText("Complete profile")).toBeNull();
  expect(screen.queryByText("private@example.test")).toBeNull();
});
it("loads a returning profile without prompting and allows editing", async () => {
  vi.mocked(requestProfile).mockResolvedValue(profile);
  render(
    <ProfileWorkspace>
      <ProfileEditor />
    </ProfileWorkspace>,
  );
  await screen.findByDisplayValue("Rug Burn");
  expect(screen.queryByText("Complete profile")).toBeNull();
  fireEvent.change(screen.getByLabelText("Display Name"), {
    target: { value: "New F3 Name" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
  await waitFor(() =>
    expect(requestProfile).toHaveBeenLastCalledWith(
      owner,
      expect.objectContaining({ display_name: "New F3 Name" }),
    ),
  );
});
it("leaves guest access alone and makes no profile request", () => {
  vi.mocked(useAccount).mockReturnValue(null);
  render(
    <ProfileWorkspace>
      <p>Guest planner</p>
      <ProfileEditor />
    </ProfileWorkspace>,
  );
  expect(screen.getByText("Guest planner")).toBeTruthy();
  expect(requestProfile).not.toHaveBeenCalled();
});
it("shows a retry path without a misleading first-login prompt when storage is unavailable", async () => {
  vi.mocked(requestProfile).mockRejectedValue(Error("Profile unavailable"));
  render(
    <ProfileWorkspace>
      <ProfileEditor />
    </ProfileWorkspace>,
  );
  await screen.findByText(/Profile unavailable/);
  expect(screen.queryByText("Complete profile")).toBeNull();
  vi.mocked(requestProfile).mockResolvedValue(profile);
  fireEvent.click(screen.getByRole("button", { name: "Retry profile" }));
  await screen.findByDisplayValue("Rug Burn");
});

it("does not offer editable blank fields while a stored profile is still loading", async () => {
  let finish: (value: typeof profile) => void = () => {};
  vi.mocked(requestProfile).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  render(
    <ProfileWorkspace>
      <ProfileEditor />
    </ProfileWorkspace>,
  );
  expect(screen.getByText("Opening your F3 profile…")).toBeTruthy();
  expect(screen.queryByLabelText("Display Name")).toBeNull();
  finish(profile);
  await screen.findByDisplayValue("Rug Burn");
});
